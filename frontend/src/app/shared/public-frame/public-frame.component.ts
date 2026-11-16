import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SettingsService } from '../../core/settings.service';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { HomeLoginComponent } from '../home-login/home-login.component';
import { LeaveLinkDirective } from '../leave-link.directive';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-public-frame',
  standalone: true,
  imports: [RouterLink, LanguageSwitcherComponent, ThemeToggleComponent, TranslatePipe, HomeLoginComponent, LeaveLinkDirective],
  templateUrl: './public-frame.component.html',
  styleUrl: './public-frame.component.scss',
})
export class PublicFrameComponent {
  constructor(public auth: AuthService, public settings: SettingsService) {}
}
