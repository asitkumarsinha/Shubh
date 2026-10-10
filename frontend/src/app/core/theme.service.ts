import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'white' | 'black';

const STORAGE_KEY = 'msh_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.readStored());

  constructor() {
    this.apply(this.mode());
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    this.apply(mode);
  }

  toggle(): void {
    this.set(this.mode() === 'black' ? 'white' : 'black');
  }

  private apply(mode: ThemeMode): void {
    document.documentElement.classList.toggle('theme-black', mode === 'black');
    document.querySelectorAll('iframe').forEach((frame) => {
      frame.contentWindow?.postMessage({ type: 'msh-theme', mode }, window.location.origin);
    });
  }

  private readStored(): ThemeMode {
    return localStorage.getItem(STORAGE_KEY) === 'black' ? 'black' : 'white';
  }
}
