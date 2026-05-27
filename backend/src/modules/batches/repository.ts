import type { SupabaseClient } from "@supabase/supabase-js";
import type { Batch, CreateBatchInput } from "./types.js";

function toBatch(row: Record<string, unknown>): Batch {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    examSlug: row.exam_slug ? String(row.exam_slug) : null,
    teacherId: row.teacher_id ? String(row.teacher_id) : null,
    academicYear: row.academic_year ? String(row.academic_year) : null,
    status: row.status as Batch["status"],
    createdAt: String(row.created_at),
  };
}

export class BatchesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByOrganization(organizationId: string): Promise<Batch[]> {
    const { data, error } = await this.supabase
      .from("batches")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toBatch(row as Record<string, unknown>));
  }

  async listForStudent(studentId: string, organizationId: string): Promise<Batch[]> {
    const { data, error } = await this.supabase
      .from("batch_enrollments")
      .select("batches(*)")
      .eq("student_id", studentId)
      .eq("status", "active")
      .eq("batches.organization_id", organizationId)
      .order("created_at", { ascending: false, referencedTable: "batches" });

    if (error) throw error;
    return (data ?? [])
      .map((row) => {
        const batches = (row as unknown as { batches?: Record<string, unknown> | null }).batches;
        return batches ?? null;
      })
      .filter(Boolean)
      .map((row) => toBatch(row as Record<string, unknown>));
  }

  async insert(input: CreateBatchInput): Promise<Batch> {
    const { data, error } = await this.supabase
      .from("batches")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        exam_slug: input.examSlug ?? null,
        teacher_id: input.teacherId ?? null,
        academic_year: input.academicYear ?? null,
      })
      .select("*")
      .single();

    if (error || !data) throw error ?? new Error("Batch insert failed.");
    return toBatch(data as Record<string, unknown>);
  }

  async enrollStudent(batchId: string, studentId: string): Promise<void> {
    const { error } = await this.supabase.from("batch_enrollments").upsert({
      batch_id: batchId,
      student_id: studentId,
      status: "active",
    });
    if (error) throw error;
  }

  async findById(batchId: string): Promise<Batch | null> {
    const { data, error } = await this.supabase
      .from("batches")
      .select("*")
      .eq("id", batchId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toBatch(data as Record<string, unknown>);
  }

  async listAttendance(organizationId: string, batchId: string, sessionDate: string) {
    const { data, error } = await this.supabase
      .from("batch_attendance")
      .select("id, batch_id, student_id, session_date, status, notes, created_at")
      .eq("organization_id", organizationId)
      .eq("batch_id", batchId)
      .eq("session_date", sessionDate)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async upsertAttendance(input: {
    organizationId: string;
    batchId: string;
    studentId: string;
    sessionDate: string;
    status: "present" | "absent" | "late";
    markedBy: string;
    notes?: string;
  }) {
    const { data, error } = await this.supabase
      .from("batch_attendance")
      .upsert(
        {
          organization_id: input.organizationId,
          batch_id: input.batchId,
          student_id: input.studentId,
          session_date: input.sessionDate,
          status: input.status,
          marked_by: input.markedBy,
          notes: input.notes ?? null,
        },
        { onConflict: "batch_id,student_id,session_date" },
      )
      .select("*")
      .single();

    if (error || !data) throw error ?? new Error("Attendance upsert failed.");
    return data;
  }
}
