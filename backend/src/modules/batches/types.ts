export interface Batch {
  id: string;
  organizationId: string;
  name: string;
  examSlug: string | null;
  teacherId: string | null;
  academicYear: string | null;
  status: "active" | "archived";
  createdAt: string;
}

export interface CreateBatchInput {
  organizationId: string;
  name: string;
  examSlug?: string | null;
  teacherId?: string | null;
  academicYear?: string | null;
}

export interface EnrollStudentInput {
  batchId: string;
  studentId: string;
}
