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

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LanguageSwitcherComponent, TranslatePipe],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss',
})
export class AdminShellComponent implements OnInit, OnDestroy {
  readonly sections: DeskSection[] = [
    {
      links: [
        { label: 'desk.addClient', path: '/admin/users', icon: 'plus' },
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
        { label: 'desk.lowStock', path: '/admin/Products', icon: 'alert' },
        { label: 'desk.payment', path: '/admin/orders', icon: 'card', disabled: true },
      ],
    },
    {
      links: [{ label: 'desk.cloneClient', path: '/admin/users', icon: 'copy', disabled: true }],
    },
  ];

  constructor(
    public auth: AuthService,
    public settings: SettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    document.documentElement.classList.add('hub-admin');
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-admin');
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
