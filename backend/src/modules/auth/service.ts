import type { SupabaseClient } from "@supabase/supabase-js";
import { unauthorized } from "../../http/errors.js";
import { parseSubdomainFromAliasEmail } from "../tenant/parse-subdomain.js";
import type { AuthRepository } from "./repository.js";
import type { AuthSessionResult, LoginInput } from "./types.js";

export class AuthService {
  constructor(
    private readonly authClient: SupabaseClient,
    private readonly repository: AuthRepository,
    private readonly platformRootDomain: string,
  ) {}

  async login(input: LoginInput): Promise<AuthSessionResult> {
    const email = input.email.trim().toLowerCase();
    const alias = parseSubdomainFromAliasEmail(email, this.platformRootDomain);

    let authEmail: string;
    if (alias) {
      const row = await this.repository.findAliasByLoginEmail(email);
      if (row) {
        const resolved = await this.repository.findAuthEmailByUserId(row.user_id);
        if (!resolved) {
          throw unauthorized("Invalid email or password.");
        }
        authEmail = resolved;
      } else {
        // e.g. admin@nw.abhyas.in stored as the real auth email, not a student alias
        authEmail = await this.repository.findAuthEmailByAliasOrEmail(email);
      }
    } else {
      authEmail = await this.repository.findAuthEmailByAliasOrEmail(email);
    }
    const { data, error } = await this.authClient.auth.signInWithPassword({
      email: authEmail,
      password: input.password,
    });

    if (error || !data.session || !data.user) {
      throw unauthorized("Invalid email or password.");
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in ?? 3600,
      tokenType: data.session.token_type ?? "bearer",
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
      },
    };
  }

  buildInternalAuthEmail(userId: string): string {
    return `${userId}@users.internal.abhyas`;
  }

  buildAliasLoginEmail(aliasLocal: string, subdomain: string): string {
    return `${aliasLocal}@${subdomain}.${this.platformRootDomain}`;
  }
}
