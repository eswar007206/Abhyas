import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  getCallerProfile,
  isOrganizationAdmin,
  jsonResponse,
} from "../_shared/admin.ts";

interface ResetPasswordPayload {
  studentId?: string;
  newPassword?: string;
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

    const payload = (await req.json()) as ResetPasswordPayload;
    const studentId = payload.studentId?.trim();
    const newPassword = payload.newPassword;

    if (!studentId || !newPassword) {
      return jsonResponse({ error: "studentId and newPassword are required." }, 400);
    }

    const { data: student, error: studentError } = await caller.supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", studentId)
      .single();

    if (studentError || !student || student.role !== "student" || !student.organization_id) {
      return jsonResponse({ error: "Organization student not found." }, 404);
    }

    const allowed =
      caller.profile.role === "developer" ||
      (caller.profile.role === "organization_admin" &&
        (await isOrganizationAdmin(caller.supabase, caller.user.id, student.organization_id)));

    if (!allowed) {
      return jsonResponse({ error: "You are not allowed to reset this student password." }, 403);
    }

    const { error: updateError } = await caller.supabase.auth.admin.updateUserById(studentId, {
      password: newPassword,
    });

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      500,
    );
  }
});
