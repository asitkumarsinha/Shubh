import { Injectable, signal } from '@angular/core';

export interface DialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  input: { type: string; placeholder: string } | null;
  resolve: (value: string | boolean | null) => void;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<DialogState | null>(null);

  confirm(message: string, title = 'Please confirm'): Promise<boolean> {
    return new Promise((resolve) => {
      this.current.set({
        title,
        message,
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        danger: true,
        input: null,
        resolve: (value) => resolve(value === true),
      });
    });
  }

  prompt(
    message: string,
    title = 'Enter a value',
    input: { type?: string; placeholder?: string; danger?: boolean } = {}
  ): Promise<string | null> {
    return new Promise((resolve) => {
      this.current.set({
        title,
        message,
        confirmLabel: 'Continue',
        cancelLabel: 'Cancel',
        danger: Boolean(input.danger),
        input: { type: input.type || 'text', placeholder: input.placeholder || '' },
        resolve: (value) => resolve(typeof value === 'string' ? value : null),
      });
    });
  }

  close(value: string | boolean | null): void {
    const dialog = this.current();
    this.current.set(null);
    dialog?.resolve(value);
  }
}
