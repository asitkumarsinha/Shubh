import { Component, OnInit, effect } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { SettingsService } from './core/settings.service';
import { PublicSiteService } from './core/public-site.service';
import { AppDialogComponent } from './shared/app-dialog/app-dialog.component';
import { LanguageSwitcherComponent } from './shared/language-switcher/language-switcher.component';
import { WelcomeOverlayComponent } from './shared/welcome-overlay/welcome-overlay.component';
import { TranslatePipe } from './core/i18n/translate.pipe';
import { TranslationService } from './core/i18n/translation.service';
import { ThemeService } from './core/theme.service';
import { PageTitleService } from './core/page-title.service';

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
    WelcomeOverlayComponent,
    TranslatePipe,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly helpManualUrl = 'assets/help/My-Store-Hub-Training-Manual.pdf?v=8';
  private lastLoggedPath = '';

  constructor(
    public auth: AuthService,
    public cart: CartService,
    public settings: SettingsService,
    private publicSite: PublicSiteService,
    private router: Router,
    private i18n: TranslationService,
    private pageTitle: PageTitleService,
    _theme: ThemeService
  ) {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.notePage(event.urlAfterRedirects));
    effect(() => {
      const custom = this.pageTitle.custom();
      const brand = this.settings.current().title || 'My Stores Hubs';
      const user = this.auth.user();
      this.i18n.lang();
      document.title = custom || (user ? `${user.name} - ${this.i18n.t(this.auth.categoryKey())}` : brand);
    });
  }

  /** These routes draw their own header, footer, and page background. */
  onLoginPage(): boolean {
    const path = this.router.url.split('?')[0];
    return (
      path === '/login' ||
      path === '/register' ||
      path === '/demo' ||
      path === '/settings' ||
      path === '/hubs' ||
      path === '/tenants' ||
      path === '/feedback' ||
      path === '/shoppingmall' ||
      path.startsWith('/store/') ||
      path === '/account' ||
      path === '/shop' ||
      path === '/cart' ||
      path.startsWith('/orders') ||
      path === '/' ||
      path.startsWith('/admin')
    );
  }

  ngOnInit(): void {
    this.settings.load();
  }

  private notePage(url: string): void {
    const path = (url || '/').split('?')[0] || '/';
    if (path === this.lastLoggedPath) return;
    this.lastLoggedPath = path;
    if (!sessionStorage.getItem('site_hit')) {
      sessionStorage.setItem('site_hit', '1');
      this.publicSite.recordHit(path).subscribe({ error: () => undefined });
      return;
    }
    this.publicSite.recordPage(path).subscribe({ error: () => undefined });
  }
}
