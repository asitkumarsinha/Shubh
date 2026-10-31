import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { BOT_PHRASES, botPhrase } from './help-bot-phrases';

interface BotLink {
  label?: string;
  labelKey?: string;
  path: string;
}

interface BotLine {
  from: 'bot' | 'user';
  text?: string;
  key?: string;
  links?: BotLink[];
}

const HINT_ANSWERS: Record<string, string> = {
  'hint.browse': 'mall',
  'hint.order': 'order',
  'hint.hub': 'openHub',
  'hint.admin': 'adminValues',
};

@Component({
  selector: 'app-help-bot',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './help-bot.component.html',
  styleUrl: './help-bot.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpBotComponent {
  hidden = false;
  open = false;
  draft = '';
  @ViewChild('askBox') askBox?: ElementRef<HTMLInputElement>;
  readonly hintKeys = ['hint.browse', 'hint.order', 'hint.hub'];
  readonly adminHintKey = 'hint.admin';
  readonly lines: BotLine[] = [
    {
      from: 'bot',
      key: 'greet',
      links: [
        { label: 'Boutique', path: '/store/boutique' },
        { label: 'Handicraft', path: '/store/handicraft' },
        { label: 'Spices', path: '/store/spices' },
      ],
    },
  ];

  constructor(
    public auth: AuthService,
    public i18n: TranslationService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.hidden = localStorage.getItem('msh_bot_hidden') === '1';
  }

  uploadWorkbook(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    this.lines.push({ from: 'user', text: file.name });
    this.http.post<{ name: string; slug: string; clients: number; employees: number }>('/api/tenants/workbook', body).subscribe({
      next: (created) => {
        this.lines.push({
          from: 'bot',
          text: `Created ${created.name}. ${created.clients} clients and ${created.employees} employees are ready. Open Hubs to see the new store.`,
          links: [{ label: 'Hubs', path: '/hubs' }],
        });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.lines.push({
          from: 'bot',
          text: err?.error?.message || 'The workbook could not create the store.',
        });
        this.cdr.markForCheck();
      },
    });
    this.cdr.markForCheck();
  }

  phrase(key: string): string {
    return botPhrase(this.i18n.lang(), key);
  }

  get boxHint(): string {
    return this.phrase(this.auth.isSuperAdmin() ? this.adminHintKey : this.hintKeys[0]);
  }

  get shownHints(): string[] {
    return this.auth.isSuperAdmin() ? [this.adminHintKey, ...this.hintKeys] : this.hintKeys;
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open && this.auth.isSuperAdmin() && !this.draft) {
      this.draft = this.phrase(this.adminHintKey);
    }
  }

  hide(): void {
    this.open = false;
    this.hidden = true;
    localStorage.setItem('msh_bot_hidden', '1');
  }

  ask(event: Event): void {
    event.preventDefault();
    this.reply(this.draft);
  }

  useHint(hintKey: string): void {
    this.draft = this.phrase(hintKey);
    this.cdr.markForCheck();
    setTimeout(() => {
      const box = this.askBox?.nativeElement;
      if (!box) return;
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    });
  }

  private reply(raw: string): void {
    const text = raw.trim();
    if (!text) return;
    this.draft = '';
    const key = this.keyForQuestion(text);
    this.lines.push({ from: 'user', text });
    this.lines.push({ from: 'bot', key, links: this.linksFor(key) });
    this.cdr.markForCheck();
  }

  private keyForQuestion(raw: string): string {
    const folded = raw.trim().toLowerCase();
    for (const [hint, answer] of Object.entries(HINT_ANSWERS)) {
      for (const pack of Object.values(BOT_PHRASES)) {
        if ((pack[hint] || '').trim().toLowerCase() === folded) return answer;
      }
    }
    return this.answerKey(folded);
  }

  private linksFor(key: string): BotLink[] | undefined {
    if (key === 'boutique') return [{ label: 'Boutique', path: '/store/boutique' }];
    if (key === 'handicraft') return [{ label: 'Handicraft', path: '/store/handicraft' }];
    if (key === 'spices' || key === 'group' || key === 'share') return [{ label: 'Spices', path: '/store/spices' }];
    if (key === 'openHub' || key === 'mall') return [{ labelKey: 'link.mall', path: '/' }];
    if (key === 'login') {
      return [
        { labelKey: 'link.login', path: '/login' },
        { labelKey: 'link.register', path: '/register' },
      ];
    }
    return undefined;
  }

  private answerKey(text: string): string {
    const has = (...words: string[]) => words.some((word) => text.includes(word));
    if (has('hello', 'hi', 'hey', 'namaste', 'नमस्ते', 'hola', 'bonjour', '你好')) return 'hello';
    if (has('boutique', 'saree', 'kurta', 'necklace', 'tote', 'साड़ी', '纱丽')) return 'boutique';
    if (has('handicraft', 'pottery', 'handmade', 'elephant', 'diya', 'scarf', 'हस्तशिल्प', '手工艺')) return 'handicraft';
    if (has('spice', 'turmeric', 'haldi', 'chilli', 'chili', 'cardamom', 'masala', 'हल्दी', '姜黄', 'cúrcuma', 'curcuma')) return 'spices';
    if (has('open a hub', 'open a store', 'start a business', 'start a store', 'create a hub', 'new hub', 'negocio', 'entreprise', 'हब कैसे', '开设枢纽')) return 'openHub';
    if (has('template', 'upload excel', 'employee values', 'client values')) return 'adminValues';
    if (has('product page', 'own page', 'share link')) return 'product';
    if (has('category', 'group', 'clothing', 'jewellery', 'blend', 'grupo', 'groupe', '分组')) return 'group';
    if (has('delivery', 'pickup', 'collect', 'address', 'entrega', 'livraison', '配送', 'डिलीवरी')) return 'delivery';
    if (has('invoice', 'bill download', 'factura', 'facture', '发票', 'बिल')) return 'invoice';
    if (has('spreadsheet', 'csv', 'upload many', 'import', 'स्प्रेडशीट')) return 'sheet';
    if (has('share', 'instagram', 'google business', 'compartir', 'partager')) return 'share';
    if (has('order', 'cart', 'buy', 'checkout', 'dispatch', 'payment', 'pedido', 'commande', '订单', 'ऑर्डर')) return 'order';
    if (has('login', 'log in', 'sign in', 'register', 'password', 'account', 'iniciar', 'connexion', '登录', 'लॉगिन')) return 'login';
    if (has('mall', 'browse', 'catalogue', 'catalog', 'product', 'stock', 'price', 'tienda', 'boutique', '商店', 'स्टोर', 'parcourir')) return 'mall';
    if (has('contact', 'support', 'email', 'phone', 'help', 'ayuda', 'aide', '帮助', 'मदद')) return 'contact';
    if (has('what is', 'who are', 'mystores', 'my stores', 'website', 'hub', 'qué es', 'qu est', '是什么')) return 'about';
    return 'unsure';
  }
}
