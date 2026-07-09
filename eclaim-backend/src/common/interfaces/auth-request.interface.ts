export interface KeyCloackAuthenticatedRequest extends Request {
  cookies: {
    authToken?: string;
    refreshToken?: string;
  };
  user?: {
    sub: string;
    email: string;
    preferred_username: string;
    name: string;
  };
}
