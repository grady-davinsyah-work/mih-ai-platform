declare global {
  namespace Express {
    interface Request {
      auth?: { tokenId: number | null; userId: number; scope: string };
      session?: Record<string, any>;
    }
  }
}

export {};
