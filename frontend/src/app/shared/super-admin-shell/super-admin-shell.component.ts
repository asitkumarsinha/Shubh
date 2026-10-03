import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SettingsService } from '../../core/settings.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

interface SuperAdminLink {
  label: string;
  path: string;
  icon: 'home' | 'user-plus' | 'user';
}

@Component({
  selector: 'app-super-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './super-admin-shell.component.html',
  styleUrl: './super-admin-shell.component.scss',
})
export class SuperAdminShellComponent implements OnInit, OnDestroy {
  readonly links: SuperAdminLink[] = [
    { label: 'Settings', path: '/settings', icon: 'home' },
    { label: 'Tenants', path: '/tenants', icon: 'user-plus' },
    { label: 'Feedbacks', path: '/feedback', icon: 'user' },
  ];

  constructor(public auth: AuthService, public settings: SettingsService) {}

  ngOnInit(): void {
    document.documentElement.classList.add('hub-login');
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-login');
  }

  logout(): void {
    this.auth.logout();
  }
}
