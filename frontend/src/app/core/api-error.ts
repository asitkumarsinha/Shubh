import { HttpErrorResponse } from '@angular/common/http';

/** User-facing message for API failures, including offline / proxy issues. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'Connection failed. Make sure the Shubh Surgical API is running on port 3000, then refresh.';
    }
    if (typeof err.error?.message === 'string' && err.error.message) {
      return err.error.message;
    }
  }
  return fallback;
}
