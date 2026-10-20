import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PageTitleService {
  /** A short title for the open page. Empty means the usual site title. */
  readonly custom = signal('');
  /** Search description for the open page. Empty means the usual site sentence. */
  readonly detail = signal('');

  set(title: string, detail = ''): void {
    this.custom.set(title.trim());
    this.detail.set(detail.trim());
  }

  clear(): void {
    this.custom.set('');
    this.detail.set('');
  }
}
