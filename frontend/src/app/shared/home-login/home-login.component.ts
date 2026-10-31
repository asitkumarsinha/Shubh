import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-home-login',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <button type="button" class="action-chip" (click)="go()" [attr.aria-label]="'title.home' | t">
      <span class="icon-circle">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M4 11.5 12 4l8 7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M6 10v9h12v-9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
        </svg>
      </span>
      <span class="chip-label">{{ 'title.home' | t }}</span>
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .action-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0;
      border: 0;
      background: none;
      color: #5b6472;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    .icon-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.05rem;
      height: 2.05rem;
      border-radius: 50%;
      background: #e5e7eb;
      color: #374151;
    }
    @media (max-width: 560px) {
      .chip-label { display: none; }
    }
  `,
})
export class HomeLoginComponent {
  constructor(private auth: AuthService, private router: Router) {}

  go(): void {
    if (this.auth.isLoggedIn()) this.auth.logout();
    else this.router.navigate(['/login']);
  }
}
