export interface CustomRequest extends Request {
  user?: {
    email: string | null;
    role: string;
    userId: number;
    type?: string;
    wallet?: {
      walletId: string;
      walletAddress: string;
    } | null;
  };
  token?: string;
  cookies?: any;
}
