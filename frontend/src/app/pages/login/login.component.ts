import { Component, HostListener, OnDestroy, OnInit, effect } from '@angular/core';
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
import { TranslationService } from '../../core/i18n/translation.service';
import { FeatureShowcaseComponent } from '../../shared/feature-showcase/feature-showcase.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicCtaComponent, LanguageSwitcherComponent, TranslatePipe, FeatureShowcaseComponent, ThemeToggleComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  email = '';
  password = '';
  remember = false;
  error = '';
  loading = false;
  showReset = false;
  resetName = '';
  resetEmail = '';
  resetPhone = '';
  resetPassword = '';
  resetError = '';
  resetSaving = false;
  displayLogo = '';
  private fittedSource = '';
  private loginInitialTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private auth: AuthService,
    private router: Router,
    public settings: SettingsService,
    private toast: ToastService,
    private i18n: TranslationService
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
    this.resetError = '';
    this.showReset = true;
  }

  @HostListener('document:keydown.escape')
  closeResetOnEscape(): void {
    if (this.showReset) this.showReset = false;
  }

  closeReset(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.showReset = false;
  }

  submitReset(): void {
    this.resetError = '';
    if (!this.resetName.trim() || !this.resetEmail.trim() || !this.resetPhone.trim() || !this.resetPassword) {
      this.resetError = this.i18n.t('reset.required');
      return;
    }
    this.resetSaving = true;
    this.auth
      .resetPassword({
        name: this.resetName.trim(),
        email: this.resetEmail.trim(),
        phone: this.resetPhone.trim(),
        password: this.resetPassword,
      })
      .subscribe({
        next: () => {
          this.resetSaving = false;
          this.showReset = false;
          this.resetPassword = '';
          this.toast.success(this.i18n.t('reset.success'));
        },
        error: (err) => {
          this.resetSaving = false;
          this.resetError = apiErrorMessage(err, this.i18n.t('reset.mismatch'));
        },
      });
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
