import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  constructor(public settings: SettingsService) {}

  ngOnInit(): void {
    document.documentElement.classList.add('hub-login');
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-login');
  }
}
