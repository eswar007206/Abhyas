export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    email: string | null;
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginAliasSupport {
  buildInternalAuthEmail(userId: string): string;
  buildAliasLoginEmail(aliasLocal: string, subdomain: string): string;
}
