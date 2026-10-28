import { Request, Response, NextFunction } from "express";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({
    error: "internal_error",
    message: "Something went wrong on the server. Please try again."
  });
}
