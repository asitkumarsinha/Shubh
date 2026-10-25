import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';
import { SettingsService } from '../../core/settings.service';
import { ToastService } from '../../core/toast.service';
import { PublicCtaComponent } from '../../shared/public-cta/public-cta.component';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicCtaComponent, LanguageSwitcherComponent, TranslatePipe, ThemeToggleComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  email = '';
  password = '';
  showPassword = false;
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
  architectureHeight = 1200;
  private loginInitialTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private auth: AuthService,
    private router: Router,
    public settings: SettingsService,
    private toast: ToastService,
    private i18n: TranslationService
  ) {}

  ngOnInit(): void {
    document.documentElement.classList.add('hub-login');
    if (!this.email.trim()) this.settings.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.loginInitialTimer);
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
          res.user.role === 'super_admin' ? '/settings' : res.user.role === 'admin' ? '/admin/hubs' : '/account',
        ]);
      },
      error: (err) => {
        this.loading = false;
        this.error = apiErrorMessage(err, this.i18n.t('login.failed'));
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

  @HostListener('window:message', ['$event'])
  onArchitectureHeight(event: MessageEvent): void {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'msh-architecture-height') return;
    const height = Number(event.data.height);
    if (height > 240) this.architectureHeight = Math.ceil(height);
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

}
