import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SettingsService } from '../../core/settings.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import { FeatureShowcaseComponent } from '../../shared/feature-showcase/feature-showcase.component';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [RouterLink, TranslatePipe, LanguageSwitcherComponent, FeatureShowcaseComponent],
  templateUrl: './demo.component.html',
  styleUrl: './demo.component.scss',
})
export class DemoComponent implements OnInit, OnDestroy {
  secondsLeft = 30;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    public settings: SettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    document.documentElement.classList.add('hub-login');
    this.timer = setInterval(() => {
      this.secondsLeft -= 1;
      if (this.secondsLeft <= 0) {
        clearInterval(this.timer);
        this.router.navigate(['/login']);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    document.documentElement.classList.remove('hub-login');
  }
}
