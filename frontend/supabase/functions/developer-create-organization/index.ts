import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, getCallerProfile, jsonResponse } from "../_shared/admin.ts";

interface CreateOrganizationPayload {
  name?: string;
  contactEmail?: string;
  seatLimit?: number;
  adminFullName?: string;
  adminEmail?: string;
  adminPassword?: string;
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

    if (caller.profile.role !== "developer") {
      return jsonResponse({ error: "Only developers can create organizations." }, 403);
    }

    const payload = (await req.json()) as CreateOrganizationPayload;
    const name = payload.name?.trim();
    const contactEmail = payload.contactEmail?.trim().toLowerCase();
    const adminFullName = payload.adminFullName?.trim();
    const adminEmail = payload.adminEmail?.trim().toLowerCase();
    const adminPassword = payload.adminPassword;
    const seatLimit = Number(payload.seatLimit ?? 0);

    if (
      !name ||
      !contactEmail ||
      !adminFullName ||
      !adminEmail ||
      !adminPassword ||
      seatLimit < 1
    ) {
      return jsonResponse(
        {
          error:
            "name, contactEmail, seatLimit, adminFullName, adminEmail, and adminPassword are required.",
        },
        400,
      );
    }

    const { data: organization, error: organizationError } = await caller.supabase
      .from("organizations")
      .insert({ name, contact_email: contactEmail, seat_limit: seatLimit, status: "active" })
      .select("id, name, seat_limit")
      .single();

    if (organizationError || !organization) throw organizationError;

    const { data: createdUser, error: createError } = await caller.supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: "organization_admin" },
      user_metadata: { full_name: adminFullName },
    });

    if (createError || !createdUser.user) {
      return jsonResponse(
        { error: createError?.message ?? "Could not create organization admin." },
        400,
      );
    }

    const adminId = createdUser.user.id;
    const { error: profileError } = await caller.supabase.from("profiles").upsert({
      id: adminId,
      email: adminEmail,
      full_name: adminFullName,
      role: "organization_admin",
      account_type: "organization",
      organization_id: organization.id,
      free_test_limit: 999,
      subscription_status: "active",
    });

    if (profileError) throw profileError;

    const { error: membershipError } = await caller.supabase
      .from("organization_memberships")
      .upsert({
        organization_id: organization.id,
        user_id: adminId,
        role: "admin",
        status: "active",
      });

    if (membershipError) throw membershipError;

    return jsonResponse({
      organization,
      admin: {
        id: adminId,
        email: adminEmail,
        fullName: adminFullName,
      },
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      500,
    );
  }
});
