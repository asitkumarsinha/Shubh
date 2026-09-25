import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { SettingsService } from './core/settings.service';
import { PublicSiteService } from './core/public-site.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly helpManualUrl = 'assets/help/Shubh-Surgical-Training-Manual.pdf?v=7';

  constructor(
    public auth: AuthService,
    public cart: CartService,
    public settings: SettingsService,
    private publicSite: PublicSiteService
  ) {}

  ngOnInit(): void {
    this.settings.load();
    if (!sessionStorage.getItem('site_hit')) {
      this.publicSite.recordHit().subscribe({
        next: () => sessionStorage.setItem('site_hit', '1'),
      });
    }
  }
}
