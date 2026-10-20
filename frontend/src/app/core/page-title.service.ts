import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PageTitleService {
  /** A short title for the open page. Empty means the usual site title. */
  readonly custom = signal('');

  set(title: string): void {
    this.custom.set(title.trim());
  }

  clear(): void {
    this.custom.set('');
  }
}
