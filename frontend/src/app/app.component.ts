import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { SettingsService } from './core/settings.service';
import { PublicSiteService } from './core/public-site.service';
import { AppDialogComponent } from './shared/app-dialog/app-dialog.component';
import { LanguageSwitcherComponent } from './shared/language-switcher/language-switcher.component';
import { TranslatePipe } from './core/i18n/translate.pipe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AppDialogComponent,
    LanguageSwitcherComponent,
    TranslatePipe,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly helpManualUrl = 'assets/help/My-Store-Hub-Training-Manual.pdf?v=8';

  constructor(
    public auth: AuthService,
    public cart: CartService,
    public settings: SettingsService,
    private publicSite: PublicSiteService,
    private router: Router
  ) {}

  /** These routes draw their own header, footer, and page background. */
  onLoginPage(): boolean {
    const path = this.router.url.split('?')[0];
    return (
      path === '/login' ||
      path === '/demo' ||
      path === '/settings' ||
      path === '/tenants' ||
      path === '/feedback' ||
      path === '/shoppingmall' ||
      path === '/' ||
      path.startsWith('/admin')
    );
  }

  ngOnInit(): void {
    this.settings.load();
    if (!sessionStorage.getItem('site_hit')) {
      this.publicSite.recordHit().subscribe({
        next: () => sessionStorage.setItem('site_hit', '1'),
      });
    }
  }
}
