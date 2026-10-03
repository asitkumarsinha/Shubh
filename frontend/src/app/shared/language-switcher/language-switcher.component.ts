import { Component, ElementRef, HostListener, Input } from '@angular/core';
import { TranslationService } from '../../core/i18n/translation.service';
import { LanguageCode } from '../../core/i18n/translations';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
  host: { class: 'app-language-switcher' },
})
export class LanguageSwitcherComponent {
  /** 'light' for white cards (e.g. login page), 'dark' for the glassy navbar. */
  @Input() variant: 'light' | 'dark' = 'dark';

  open = false;

  constructor(public i18n: TranslationService, private el: ElementRef<HTMLElement>) {}

  toggle(): void {
    this.open = !this.open;
  }

  close(): void {
    this.open = false;
  }

  select(code: LanguageCode): void {
    this.i18n.use(code);
    this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
