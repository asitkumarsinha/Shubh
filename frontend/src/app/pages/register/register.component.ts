import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { PublicSiteService } from '../../core/public-site.service';
import { SettingsService } from '../../core/settings.service';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import { HomeLoginComponent } from '../../shared/home-login/home-login.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent, HomeLoginComponent],
  templateUrl: './register.component.html',
  styleUrls: ['../login/login.component.scss', './register.component.scss'],
})
export class RegisterComponent implements OnInit, OnDestroy {
  name = '';
  email = '';
  phone = '';
  remark = '';
  error = '';
  sent = false;
  loading = false;

  constructor(
    private publicSite: PublicSiteService,
    private toast: ToastService,
    private i18n: TranslationService,
    public settings: SettingsService
  ) {}

  ngOnInit(): void {
    document.documentElement.classList.add('hub-login');
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-login');
  }

  submit(): void {
    this.error = '';
    this.sent = false;
    this.loading = true;
    this.publicSite
      .sendContact({
        name: this.name,
        email: this.email,
        phone: this.phone,
        remark: this.remark,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.sent = true;
          this.toast.success(this.i18n.t('register.sent'));
          this.name = '';
          this.email = '';
          this.phone = '';
          this.remark = '';
        },
        error: (err) => {
          this.loading = false;
          const msg = apiErrorMessage(err, 'Could not send the request');
          this.error = msg;
          this.toast.error(msg);
        },
      });
  }
}
