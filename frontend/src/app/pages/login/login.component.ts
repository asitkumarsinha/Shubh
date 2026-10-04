import { Component, OnDestroy, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';
import { SettingsService } from '../../core/settings.service';
import { ToastService } from '../../core/toast.service';
import { fitLogoOnWhite } from '../../core/logo-fit';

import { PublicCtaComponent } from '../../shared/public-cta/public-cta.component';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicCtaComponent, LanguageSwitcherComponent, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  email = '';
  password = '';
  remember = false;
  error = '';
  loading = false;
  displayLogo = '';
  private fittedSource = '';
  private loginInitialTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private auth: AuthService,
    private router: Router,
    public settings: SettingsService,
    private toast: ToastService
  ) {
    effect(() => {
      const logo = this.settings.current().logo;
      if (!logo || logo === this.fittedSource) return;
      this.displayLogo = logo;
    });
  }

  ngOnInit(): void {
    document.documentElement.classList.add('hub-login');
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-login');
  }

  submit(): void {
    this.error = '';
    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        this.settings.load();
        this.router.navigate([
          res.user.role === 'super_admin' ? '/settings' : res.user.role === 'admin' ? '/admin/customers_tenats' : '/account',
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

  forgotPassword(): void {
    this.toast.info('Password reset isn\u2019t available yet. Please contact your admin.');
  }

  onLogoLoad(event: Event): void {
    const source = this.settings.current().logo;
    if (!source || this.fittedSource === source) return;
    const img = event.target as HTMLImageElement;
    this.fittedSource = source;
    try {
      const fitted = fitLogoOnWhite(img);
      if (fitted) this.displayLogo = fitted;
    } catch {
      this.displayLogo = source;
    }
  }
}
