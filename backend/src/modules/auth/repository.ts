import type { SupabaseClient } from "@supabase/supabase-js";

export interface LoginAliasRow {
  user_id: string;
  organization_id: string;
  login_email: string;
}

export class AuthRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findAliasByLoginEmail(loginEmail: string): Promise<LoginAliasRow | null> {
    const { data, error } = await this.supabase
      .from("user_login_aliases")
      .select("user_id, organization_id, login_email")
      .eq("login_email", loginEmail)
      .maybeSingle();

    if (error) throw error;
    return data as LoginAliasRow | null;
  }

  async findAuthEmailByUserId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("auth_email, email")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return (data.auth_email as string | null) ?? (data.email as string);
  }

  async findAuthEmailByAliasOrEmail(email: string): Promise<string> {
    const alias = await this.findAliasByLoginEmail(email);
    if (alias) {
      const authEmail = await this.findAuthEmailByUserId(alias.user_id);
      if (authEmail) return authEmail;
    }

    const { data, error } = await this.supabase
      .from("profiles")
      .select("auth_email, email")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return (data.auth_email as string | null) ?? (data.email as string);
    }

    return email;
  }

  async insertLoginAlias(input: {
    userId: string;
    organizationId: string;
    aliasLocal: string;
    loginEmail: string;
  }): Promise<void> {
    const { error } = await this.supabase.from("user_login_aliases").insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      alias_local: input.aliasLocal,
      login_email: input.loginEmail,
      is_primary: true,
    });
    if (error) throw error;
  }
}
