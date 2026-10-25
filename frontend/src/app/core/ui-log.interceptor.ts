import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

const recent = new Map<string, number>();
let rawClient: HttpClient | undefined;

function allow(key: string, gapMs: number): boolean {
  const now = Date.now();
  if (now - (recent.get(key) || 0) < gapMs) return false;
  recent.set(key, now);
  if (recent.size > 300) recent.clear();
  return true;
}

function pagePath(router: Router): string {
  return (router.url || '/').split('?')[0] || '/';
}

/** Record whether each API call on any page succeeded, failed, or errored. */
export const uiLogInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;
  if (!url.includes('/api/') || url.includes('/api/ui-log') || url.includes('/api/hits') || url.includes('/api/logs')) {
    return next(req);
  }
  const router = inject(Router);
  rawClient ??= new HttpClient(inject(HttpBackend));
  const client = rawClient;
  const apiPath = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const auth = req.headers.get('Authorization');
  const headers = auth ? { Authorization: auth } : undefined;

  const send = (outcome: 'success' | 'failure' | 'error', detail: string) => {
    client.post('/api/ui-log', {
      outcome,
      path: pagePath(router),
      detail: detail.slice(0, 240),
    }, { headers }).subscribe({ error: () => undefined });
  };

  return next(req).pipe(
    tap({
      next: () => {
        if (!allow(`ok|${req.method}|${apiPath}`, 20000)) return;
        send('success', `${req.method} ${apiPath} succeeded`);
      },
      error: (err: HttpErrorResponse) => {
        const outcome = !err.status || err.status >= 500 ? 'error' : 'failure';
        if (!allow(`${outcome}|${req.method}|${apiPath}|${err.status}`, 3000)) return;
        const message = (err.error && err.error.message) || err.statusText || 'Request failed';
        send(outcome, `${req.method} ${apiPath} ${err.status || 0}: ${message}`);
      },
    })
  );
};
