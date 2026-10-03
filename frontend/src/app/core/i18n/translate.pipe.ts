import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from './translation.service';

/**
 * Usage: {{ 'login.heading' | t }} or {{ 'login.continueWith' | t:{ title: siteName } }}
 * Marked impure so it re-renders immediately when the active language changes.
 */
@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  constructor(private i18n: TranslationService) {}

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
