import { Component } from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="theme-toggle" role="group" [attr.aria-label]="'theme.label' | t">
      <button
        type="button"
        [class.active]="theme.mode() === 'white'"
        [attr.aria-pressed]="theme.mode() === 'white'"
        [title]="'theme.white' | t"
        (click)="theme.set('white')"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path
            d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
        <span class="label">{{ 'theme.white' | t }}</span>
      </button>
      <button
        type="button"
        [class.active]="theme.mode() === 'black'"
        [attr.aria-pressed]="theme.mode() === 'black'"
        [title]="'theme.black' | t"
        (click)="theme.set('black')"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M19.5 14.6A7.6 7.6 0 0 1 9.4 4.5a7.6 7.6 0 1 0 10.1 10.1Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
        </svg>
        <span class="label">{{ 'theme.black' | t }}</span>
      </button>
    </div>
  `,
  styles: `
    .theme-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.2rem;
      border: 1px solid #e2e5ea;
      border-radius: 999px;
      background: #f6f7f9;
    }

    button {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.7rem;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #6b7280;
      font: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }

    button.active {
      background: #ffffff;
      color: #111827;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
    }

    @media (max-width: 560px) {
      .label {
        display: none;
      }
    }
  `,
})
export class ThemeToggleComponent {
  constructor(public theme: ThemeService) {}
}
