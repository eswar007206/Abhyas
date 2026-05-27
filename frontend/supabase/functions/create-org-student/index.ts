import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  getCallerProfile,
  isOrganizationAdmin,
  jsonResponse,
} from "../_shared/admin.ts";

interface CreateStudentPayload {
  organizationId?: string;
  fullName?: string;
  email?: string;
  password?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const caller = await getCallerProfile(req);
    if ("error" in caller) return caller.error;

    const payload = (await req.json()) as CreateStudentPayload;
    const organizationId = payload.organizationId?.trim();
    const fullName = payload.fullName?.trim();
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;

    if (!organizationId || !fullName || !email || !password) {
      return jsonResponse(
        { error: "organizationId, fullName, email, and password are required." },
        400,
      );
    }

    const allowed =
      caller.profile.role === "developer" ||
      (caller.profile.role === "organization_admin" &&
        (await isOrganizationAdmin(caller.supabase, caller.user.id, organizationId)));

    if (!allowed) {
      return jsonResponse(
        { error: "You are not allowed to create students for this organization." },
        403,
      );
    }

    const { data: organization, error: organizationError } = await caller.supabase
      .from("organizations")
      .select("id, seat_limit")
      .eq("id", organizationId)
      .single();

    if (organizationError || !organization) {
      return jsonResponse({ error: "Organization not found." }, 404);
    }

    const { count, error: countError } = await caller.supabase
      .from("organization_memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role", "student")
      .eq("status", "active");

    if (countError) throw countError;

    if ((count ?? 0) >= organization.seat_limit) {
      return jsonResponse(
        {
          error: "Seat limit exceeded. Contact sales to add more seats.",
          usedSeats: count,
          seatLimit: organization.seat_limit,
        },
        409,
      );
    }

    const { data: createdUser, error: createError } = await caller.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !createdUser.user) {
      return jsonResponse({ error: createError?.message ?? "Could not create student." }, 400);
    }

    const userId = createdUser.user.id;
    const { error: profileError } = await caller.supabase.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      role: "student",
      account_type: "organization",
      organization_id: organizationId,
      free_test_limit: 999,
      subscription_status: "active",
    });

    if (profileError) throw profileError;

    const { error: membershipError } = await caller.supabase
      .from("organization_memberships")
      .upsert({
        organization_id: organizationId,
        user_id: userId,
        role: "student",
        status: "active",
      });

    if (membershipError) throw membershipError;

    return jsonResponse({
      student: {
        id: userId,
        email,
        fullName,
        organizationId,
      },
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      500,
    );
  }
});
