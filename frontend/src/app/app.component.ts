import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { SettingsService } from './core/settings.service';
import { PublicSiteService } from './core/public-site.service';
import { AppDialogComponent } from './shared/app-dialog/app-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AppDialogComponent],
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

  onLoginPage(): boolean {
    return this.router.url.split('?')[0] === '/login';
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
