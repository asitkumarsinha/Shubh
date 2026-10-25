import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

/** Screen errors that are not already recorded as API results. */
@Injectable()
export class UiErrorHandler implements ErrorHandler {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly router = inject(Router);

  handleError(error: unknown): void {
    console.error(error);
    if (error instanceof HttpErrorResponse) return;
    const message = error instanceof Error ? error.message : 'Screen error';
    if (!message || message.includes('/api/ui-log')) return;
    const path = (this.router.url || '/').split('?')[0] || '/';
    this.http.post('/api/ui-log', {
      outcome: 'error',
      path,
      detail: `Screen: ${message}`.slice(0, 240),
    }).subscribe({ error: () => undefined });
  }
}
