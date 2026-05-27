import type { Profile } from "../../types/domain.js";

export interface AuthService {
  createUser(input: {
    email: string;
    password: string;
    fullName: string;
    role?: string;
  }): Promise<{ id: string; email: string; fullName: string }>;
  resetPassword(userId: string, password: string): Promise<void>;
  updateEmail(userId: string, email: string): Promise<void>;
}

export interface ProfileService {
  upsertProfile(profile: Profile & { authEmail?: string | null }): Promise<Profile>;
}
