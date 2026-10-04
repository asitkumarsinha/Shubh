import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { SettingsService } from '../../core/settings.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

const PIN_KEY = 'msh_client_menu_pinned';

@Component({
  selector: 'app-client-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './client-shell.component.html',
  styleUrl: './client-shell.component.scss',
})
export class ClientShellComponent implements OnInit, OnDestroy {
  pinned = true;

  constructor(
    public auth: AuthService,
    public cart: CartService,
    public settings: SettingsService
  ) {}

  get client(): boolean {
    return this.auth.user()?.role === 'user';
  }

  ngOnInit(): void {
    this.pinned = localStorage.getItem(PIN_KEY) !== '0';
    if (this.client) document.documentElement.classList.add('hub-login');
  }

  ngOnDestroy(): void {
    if (this.client) document.documentElement.classList.remove('hub-login');
  }

  togglePin(): void {
    this.pinned = !this.pinned;
    localStorage.setItem(PIN_KEY, this.pinned ? '1' : '0');
  }

  logout(): void {
    this.auth.logout();
  }
}
