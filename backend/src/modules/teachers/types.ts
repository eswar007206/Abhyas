export interface TeacherProfile {
  userId: string;
  organizationId: string;
  subjects: string[];
  bio: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateTeacherInput {
  organizationId: string;
  fullName: string;
  email: string;
  password: string;
  subjects?: string[];
  bio?: string | null;
}
