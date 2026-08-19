declare global {
  namespace Express {
    interface Request {
      auth?: { tokenId: number; userId: number; scope: string };
      session?: Record<string, any>;
    }
  }
}

export {};
