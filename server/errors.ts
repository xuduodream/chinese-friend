import type { Response } from 'express'

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function sendError(res: Response, error: unknown): void {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } })
    return
  }

  console.error(error)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } })
}
