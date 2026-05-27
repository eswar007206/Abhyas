export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function unauthorized(message = "Authentication required.") {
  return new HttpError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "You are not allowed to perform this action.") {
  return new HttpError(403, "FORBIDDEN", message);
}

export function notFound(message = "Resource not found.") {
  return new HttpError(404, "NOT_FOUND", message);
}

export function conflict(code: string, message: string, details?: Record<string, unknown>) {
  return new HttpError(409, code, message, details);
}

export function paymentRequired(code: string, message: string, details?: Record<string, unknown>) {
  return new HttpError(402, code, message, details);
}
