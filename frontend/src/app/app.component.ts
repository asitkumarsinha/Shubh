import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { SettingsService } from './core/settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly helpManualUrl = 'assets/help/Shubh-Surgical-Training-Manual.pdf?v=4';

  constructor(
    public auth: AuthService,
    public cart: CartService,
    public settings: SettingsService
  ) {}

  ngOnInit(): void {
    this.settings.load();
  }
}
