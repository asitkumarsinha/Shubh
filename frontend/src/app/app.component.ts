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
import { HelpBotComponent } from './shared/help-bot/help-bot.component';

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
    HelpBotComponent,
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
      this.pageTitle.custom();
      this.pageTitle.detail();
      this.settings.current();
      this.auth.user();
      this.i18n.lang();
      this.syncSeo(this.router.url);
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
    this.syncSeo(path);
    if (path === this.lastLoggedPath) return;
    this.lastLoggedPath = path;
    if (!sessionStorage.getItem('site_hit')) {
      sessionStorage.setItem('site_hit', '1');
      this.publicSite.recordHit(path).subscribe({ error: () => undefined });
      return;
    }
    this.publicSite.recordPage(path).subscribe({ error: () => undefined });
  }

  /** Public pages are what Google should list for www.mystoreshubs.com. */
  private isPublicPage(path: string): boolean {
    return path === '/' || path === '/shoppingmall' || path === '/demo' || path.startsWith('/store/');
  }

  private syncSeo(url: string): void {
    const path = (url || '/').split('?')[0] || '/';
    const brand = this.settings.current().title || 'My Stores Hubs';
    const custom = this.pageTitle.custom();
    const indexed = this.isPublicPage(path);
    const user = this.auth.user();
    const title = indexed
      ? custom || brand
      : custom || (user ? `${user.name} - ${this.i18n.t(this.auth.categoryKey())}` : brand);
    const detail = this.pageTitle.detail();
    const description = detail
      || (path.startsWith('/store/') && custom && custom !== brand
        ? `${custom} on My Stores Hubs. Shop this store at www.mystoreshubs.com.`
        : 'My Stores Hubs at www.mystoreshubs.com is a shopping mall of stores. Browse products and open a store.');
    const canonical = path.startsWith('/store/')
      ? `https://www.mystoreshubs.com${path}`
      : path === '/demo'
        ? 'https://www.mystoreshubs.com/demo'
        : 'https://www.mystoreshubs.com/';
    document.title = title;
    this.setMeta('description', description);
    this.setMeta('robots', indexed ? 'index, follow' : 'noindex, nofollow');
    this.setMeta('og:title', title, 'property');
    this.setMeta('og:description', description, 'property');
    this.setMeta('og:url', canonical, 'property');
    let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
  }

  private setMeta(name: string, content: string, attr: 'name' | 'property' = 'name'): void {
    let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.content = content;
  }
}
