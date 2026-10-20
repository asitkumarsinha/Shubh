import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SettingsService } from '../../core/settings.service';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface DeskLink {
  label: string;
  path: string;
  icon: string;
  disabled?: boolean;
}

interface DeskSection {
  title?: string;
  links: DeskLink[];
}

const PIN_KEY = 'msh_admin_menu_pinned';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LanguageSwitcherComponent, TranslatePipe],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent implements OnInit, OnDestroy {
  pinned = true;
  readonly sections: DeskSection[] = [
    {
      links: [
        { label: 'desk.addClient', path: '/admin/stores', icon: 'plus' },
        { label: 'desk.addProduct', path: '/admin/Products', icon: 'box' },
        { label: 'desk.viewProduct', path: '/admin/orders', icon: 'box' },
        { label: 'desk.topProduct', path: '/admin/reports', icon: 'star' },
      ],
    },
    {
      title: 'desk.management',
      links: [{ label: 'desk.addEmployee', path: '/admin/employees', icon: 'user-plus' }],
    },
    {
      title: 'desk.reminder',
      links: [
        { label: 'desk.lowStock', path: '/admin/Products', icon: 'alert', disabled: true },
        { label: 'desk.payment', path: '/admin/orders', icon: 'card', disabled: true },
      ],
    },
    {
      links: [{ label: 'desk.cloneClient', path: '/admin/stores', icon: 'copy', disabled: true }],
    },
  ];

  constructor(
    public auth: AuthService,
    public settings: SettingsService,
    private router: Router
  ) {}

  get showHelp(): boolean {
    return this.router.url.split('?')[0].startsWith('/admin/customers_tenats');
  }

  ngOnInit(): void {
    this.pinned = localStorage.getItem(PIN_KEY) !== '0';
    document.documentElement.classList.add('hub-admin');
  }

  togglePin(): void {
    this.pinned = !this.pinned;
    localStorage.setItem(PIN_KEY, this.pinned ? '1' : '0');
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-admin');
  }

  logout(): void {
    this.auth.logout();
  }
}
