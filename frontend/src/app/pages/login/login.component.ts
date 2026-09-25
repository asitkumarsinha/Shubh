import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';
import { SettingsService } from '../../core/settings.service';

import { PublicCtaComponent } from '../../shared/public-cta/public-cta.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicCtaComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;
  private loginInitialTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private auth: AuthService,
    private router: Router,
    public settings: SettingsService
  ) {}

  submit(): void {
    this.error = '';
    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        this.settings.load();
        this.router.navigate([
          res.user.role === 'super_admin' ? '/settings' : res.user.role === 'admin' ? '/admin' : '/medicines',
        ]);
      },
      error: (err) => {
        this.loading = false;
        this.error = apiErrorMessage(err, 'Login failed');
      },
    });
  }

  loadCustomerBranding(): void {
    clearTimeout(this.loginInitialTimer);
    const email = this.email.trim().toLowerCase();
    if (!email.includes('@')) return;
    this.loginInitialTimer = setTimeout(() => this.settings.loadForLoginEmail(email), 250);
  }

  fillDemo(role: 'admin' | 'user'): void {
    if (role === 'admin') {
      this.email = 'admin@shubhsurgical.com';
      this.password = 'admin123';
    } else {
      this.email = 'user@shubhsurgical.com';
      this.password = 'user123';
    }
    this.loadCustomerBranding();
  }
}
