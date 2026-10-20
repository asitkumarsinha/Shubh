import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SettingsService } from '../../core/settings.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { PublicCtaComponent } from '../public-cta/public-cta.component';
import { PublicSiteService, SiteActivity } from '../../core/public-site.service';
import { APP_VERSION } from '../../version';

interface SuperAdminLink {
  label: string;
  path: string;
  icon: 'home' | 'user-plus' | 'user';
}

const PIN_KEY = 'msh_super_menu_pinned';

@Component({
  selector: 'app-super-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, LanguageSwitcherComponent, PublicCtaComponent],
  templateUrl: './super-admin-shell.component.html',
  styleUrl: './super-admin-shell.component.scss',
})
export class SuperAdminShellComponent implements OnInit, OnDestroy {
  pinned = true;
  logsOpen = false;
  logsLoading = false;
  logsError = '';
  logs: SiteActivity[] = [];
  readonly version = APP_VERSION;

  readonly links: SuperAdminLink[] = [
    { label: 'Settings', path: '/settings', icon: 'home' },
    { label: 'Hubs', path: '/hubs', icon: 'user-plus' },
    { label: 'Feedbacks', path: '/feedback', icon: 'user' },
  ];

  constructor(
    public auth: AuthService,
    public settings: SettingsService,
    private publicSite: PublicSiteService
  ) {}

  ngOnInit(): void {
    this.pinned = localStorage.getItem(PIN_KEY) !== '0';
    document.documentElement.classList.add('hub-login');
  }

  togglePin(): void {
    this.pinned = !this.pinned;
    localStorage.setItem(PIN_KEY, this.pinned ? '1' : '0');
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-login');
  }

  logout(): void {
    this.auth.logout();
  }

  openLogs(): void {
    this.logsOpen = true;
    this.logsLoading = true;
    this.logsError = '';
    this.publicSite.hitDetails().subscribe({
      next: (rows) => {
        this.logs = rows;
        this.logsLoading = false;
      },
      error: (err) => {
        this.logsLoading = false;
        this.logsError = err.error?.message || 'Could not load the log';
      },
    });
  }

  closeLogs(): void {
    this.logsOpen = false;
  }

  eventLabel(kind: string): string {
    if (kind === 'login') return 'Login';
    if (kind === 'page') return 'Page';
    return 'Visit';
  }

  roleLabel(role: string): string {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Customer';
    if (role === 'user') return 'Client';
    return role || 'Guest';
  }

  get visitors(): Array<{
    key: string;
    who: string;
    email: string;
    role: string;
    hits: number;
    lastAt: string;
    lastPath: string;
  }> {
    const people = new Map<string, {
      key: string;
      who: string;
      email: string;
      role: string;
      hits: number;
      lastAt: string;
      lastPath: string;
    }>();
    for (const row of this.logs) {
      const key = `${row.email || row.ip || 'guest'}|${row.role || ''}`;
      const current = people.get(key);
      if (!current) {
        people.set(key, {
          key,
          who: row.name || 'Guest',
          email: row.email || '—',
          role: this.roleLabel(row.role),
          hits: 1,
          lastAt: row.created_at,
          lastPath: row.path || '—',
        });
      } else {
        current.hits += 1;
      }
    }
    return [...people.values()];
  }

  browserLabel(agent: string): string {
    if (/Edg\//.test(agent)) return 'Edge';
    if (/Chrome\//.test(agent)) return 'Chrome';
    if (/Firefox\//.test(agent)) return 'Firefox';
    if (/Safari\//.test(agent)) return 'Safari';
    return agent ? 'Other browser' : '—';
  }
}
