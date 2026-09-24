import { Injectable, signal } from '@angular/core';

export type ToastKind = 'ok' | 'bad';
export type SavePhase = 'idle' | 'saving' | 'saved' | 'failed';

export interface Toast {
  id: number;
  kind: ToastKind;
  status: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  readonly toasts = signal<Toast[]>([]);
  readonly saveStatus = signal<SavePhase>('idle');
  readonly saveMessage = signal('');

  beginSave(): void {
    this.clearReset();
    this.saveStatus.set('saving');
    this.saveMessage.set('Saving…');
    this.paint();
  }

  success(message: string): void {
    this.saveStatus.set('saved');
    this.saveMessage.set(message);
    this.push('ok', 'Saved', message);
    this.scheduleIdle();
  }

  error(message: string): void {
    this.saveStatus.set('failed');
    this.saveMessage.set(message);
    this.push('bad', 'Save failed', message);
    this.scheduleIdle();
  }

  info(message: string): void {
    this.push('ok', 'Done', message);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
    this.paint();
  }

  private push(kind: ToastKind, status: string, message: string): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, kind, status, message }]);
    this.paint();
    setTimeout(() => this.dismiss(id), 5500);
  }

  private scheduleIdle(): void {
    this.clearReset();
    this.resetTimer = setTimeout(() => {
      this.saveStatus.set('idle');
      this.saveMessage.set('');
      this.paint();
    }, 4000);
  }

  private clearReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  private paint(): void {
    if (typeof document === 'undefined') return;
    this.paintBar();
    this.paintToasts();
  }

  private paintBar(): void {
    const status = this.saveStatus();
    let bar = document.getElementById('global-save-status');
    if (status === 'idle') {
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'global-save-status';
      bar.className = 'save-status-bar';
      const header = document.querySelector('.topbar');
      if (header?.parentElement) {
        header.insertAdjacentElement('afterend', bar);
      } else {
        document.body.prepend(bar);
      }
    }
    bar.setAttribute('data-status', status);
    const label =
      status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save failed';
    const extra =
      status !== 'saving' && this.saveMessage() ? ` · ${this.saveMessage()}` : '';
    bar.textContent = label + extra;
  }

  private paintToasts(): void {
    let host = document.getElementById('global-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'global-toast-host';
      host.className = 'toast-host';
      host.setAttribute('aria-live', 'polite');
      host.setAttribute('aria-atomic', 'true');
      document.body.appendChild(host);
    }
    host.replaceChildren();
    for (const t of this.toasts()) {
      const card = document.createElement('div');
      card.className = `app-toast ${t.kind === 'ok' ? 'ok' : 'bad'}`;
      const status = document.createElement('strong');
      status.className = 'app-toast-status';
      status.textContent = t.status;
      const msg = document.createElement('span');
      msg.textContent = t.message;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'app-toast-close';
      close.setAttribute('aria-label', 'Dismiss');
      close.textContent = '×';
      close.addEventListener('click', () => this.dismiss(t.id));
      card.append(status, msg, close);
      host.appendChild(card);
    }
  }
}

export function saveButtonLabel(status: SavePhase, idle: string, saving = 'Saving…'): string {
  if (status === 'saving') return saving;
  if (status === 'saved') return 'Saved';
  if (status === 'failed') return 'Save failed';
  return idle;
}
