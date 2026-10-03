import { Injectable, signal } from '@angular/core';
import { LanguageCode, TRANSLATIONS } from './translations';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  native: string;
}

const STORAGE_KEY = 'msh_lang';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly languages: LanguageOption[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'es', label: 'Spanish', native: 'Español' },
    { code: 'fr', label: 'French', native: 'Français' },
  ];

  readonly lang = signal<LanguageCode>(this.initialLang());

  constructor() {
    this.applyDocumentLang(this.lang());
  }

  use(code: LanguageCode): void {
    if (!TRANSLATIONS[code] || code === this.lang()) return;
    this.lang.set(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* localStorage unavailable; language still applies for this session */
    }
    this.applyDocumentLang(code);
  }

  current(): LanguageOption {
    return this.languages.find((option) => option.code === this.lang()) ?? this.languages[0];
  }

  /** Translate a key, with optional {{placeholder}} substitutions, falling back to English then the key itself. */
  t(key: string, params?: Record<string, string | number>): string {
    const dict = TRANSLATIONS[this.lang()] ?? TRANSLATIONS.en;
    let text = dict[key] ?? TRANSLATIONS.en[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`{{\\s*${name}\\s*}}`, 'g'), String(value));
      }
    }
    return text;
  }

  private initialLang(): LanguageCode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (saved && TRANSLATIONS[saved]) return saved;
    } catch {
      /* ignore and fall back to browser language */
    }
    const browser = typeof navigator !== 'undefined' ? navigator.language?.slice(0, 2) : '';
    return (TRANSLATIONS as Record<string, unknown>)[browser] ? (browser as LanguageCode) : 'en';
  }

  private applyDocumentLang(code: LanguageCode): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code;
    }
  }
}
