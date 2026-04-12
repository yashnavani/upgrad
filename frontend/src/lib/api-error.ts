/**
 * Custom API error class with detailed error information.
 */
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
    public requestId?: string
  ) {
    super(message);
    this.name = "APIError";
  }

  /**
   * Check if error is due to authentication failure.
   */
  isAuthError(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if error is due to authorization failure.
   */
  isForbiddenError(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Check if error is due to resource not found.
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Check if error is due to validation failure.
   */
  isValidationError(): boolean {
    return this.statusCode === 422;
  }

  /**
   * Check if error is due to rate limiting.
   */
  isRateLimitError(): boolean {
    return this.statusCode === 429;
  }

  /**
   * Check if error is a server error.
   */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /**
   * Get user-friendly error message.
   */
  getUserMessage(): string {
    if (this.isAuthError()) {
      return "Your session has expired. Please log in again.";
    }
    if (this.isForbiddenError()) {
      return "You don't have permission to perform this action.";
    }
    if (this.isNotFoundError()) {
      return "The requested resource was not found.";
    }
    if (this.isValidationError()) {
      return "Please check your input and try again.";
    }
    if (this.isRateLimitError()) {
      return "Too many requests. Please try again later.";
    }
    if (this.isServerError()) {
      return "A server error occurred. Please try again later.";
    }
    return this.message;
  }
}
