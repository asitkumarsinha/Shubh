import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface BotLink {
  label: string;
  path: string;
}

interface BotLine {
  from: 'bot' | 'user';
  text: string;
  links?: BotLink[];
}

const OUT_OF_SCOPE =
  'I can help with My Stores Hubs. Ask how to browse a store, place an order, or open a hub for a business.';

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
  readonly lines: BotLine[] = [
    {
      from: 'bot',
      text: 'Hello. I can answer questions about My Stores Hubs. Try the sample stores if you are planning a shop.',
      links: [
        { label: 'Boutique', path: '/store/boutique' },
        { label: 'Handicraft', path: '/store/handicraft' },
        { label: 'Spices', path: '/store/spices' },
      ],
    },
  ];

  constructor() {
    this.hidden = localStorage.getItem('msh_bot_hidden') === '1';
  }

  toggle(): void {
    this.open = !this.open;
  }

  hide(): void {
    this.open = false;
    this.hidden = true;
    localStorage.setItem('msh_bot_hidden', '1');
  }

  ask(event: Event): void {
    event.preventDefault();
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    this.lines.push({ from: 'user', text });
    this.lines.push({ from: 'bot', ...this.answer(text) });
  }

  private answer(question: string): Pick<BotLine, 'text' | 'links'> {
    const text = question.toLowerCase();
    const has = (...words: string[]) => words.some((word) => text.includes(word));
    if (has('hello', 'hi', 'hey', 'good morning', 'good evening')) {
      return { text: 'Hello. Ask me about stores, orders, or how a business opens a hub on My Stores Hubs.' };
    }
    if (has('boutique', 'saree', 'kurta', 'necklace', 'tote')) {
      return {
        text: 'Boutique is a sample clothing store. It shows sarees, kurtas, jewellery, and a tote, with prices and stock a shopper can browse.',
        links: [{ label: 'Open Boutique', path: '/store/boutique' }],
      };
    }
    if (has('handicraft', 'pottery', 'handmade', 'elephant', 'diya', 'scarf')) {
      return {
        text: 'Handicraft is a sample maker’s store. It shows pottery, wood, a printed scarf, and brass diyas.',
        links: [{ label: 'Open Handicraft', path: '/store/handicraft' }],
      };
    }
    if (has('spice', 'turmeric', 'haldi', 'chilli', 'chili', 'cardamom', 'masala')) {
      return {
        text: 'Spices is a sample grocery store. It shows turmeric, Kashmiri chilli, cardamom, and garam masala.',
        links: [{ label: 'Open Spices', path: '/store/spices' }],
      };
    }
    if (has('open a hub', 'open a store', 'start a business', 'start a store', 'create a hub', 'new hub', 'plan')) {
      return {
        text: 'A Super Admin creates a hub with a business name, user name, and mobile number. The store then gets its own page in the Shopping Mall, like Boutique, Handicraft, and Spices.',
        links: [{ label: 'Shopping Mall', path: '/' }],
      };
    }
    if (has('product page', 'own page', 'share link', 'whatsapp the product')) {
      return {
        text: 'Every product has its own page with a photo, price, description, and a link you can send on WhatsApp.',
        links: [{ label: 'Turmeric Powder', path: '/store/spices/turmeric-powder-46' }],
      };
    }
    if (has('category', 'group', 'clothing', 'jewellery', 'blend')) {
      return {
        text: 'A store can group its catalogue. Spices uses Whole spices and Blends. Boutique uses Clothing, Jewellery, and Bags.',
        links: [{ label: 'Spices', path: '/store/spices' }],
      };
    }
    if (has('delivery', 'pickup', 'collect', 'address')) {
      return {
        text: 'At checkout the client can enter a delivery address or choose to collect from the shop. The store sees that choice on the order.',
      };
    }
    if (has('invoice', 'bill download', 'download')) {
      return { text: 'After an order is placed, the client and the store can download a one-page invoice with the items, total, and payment status.' };
    }
    if (has('spreadsheet', 'csv', 'upload many', 'import')) {
      return { text: 'A store can upload a spreadsheet with columns for name, price, stock, description, and category, instead of typing each product.' };
    }
    if (has('share', 'instagram', 'google business')) {
      return {
        text: 'On the store page, Copy a message to share puts a short note and the public store link on the clipboard, ready for WhatsApp, Instagram, or a Google Business profile.',
        links: [{ label: 'Spices', path: '/store/spices' }],
      };
    }
    if (has('order', 'cart', 'buy', 'checkout', 'dispatch', 'payment', 'whatsapp')) {
      return {
        text: 'Sign in as a client, add a product, and choose delivery or pickup. When the order is placed, accepted, or dispatched, a WhatsApp note is ready for the shop or the client.',
      };
    }
    if (has('login', 'log in', 'sign in', 'register', 'password', 'account')) {
      return {
        text: 'Use Login to sign in, or Register to open a client account. Each store is also open to visitors without an account, so you can look through the catalogue first.',
        links: [{ label: 'Login', path: '/login' }, { label: 'Register', path: '/register' }],
      };
    }
    if (has('mall', 'browse', 'catalogue', 'catalog', 'product', 'stock', 'price')) {
      return {
        text: 'The Shopping Mall lists every hub. Open a store to see its products, prices, photos, and how many are in stock.',
        links: [{ label: 'Shopping Mall', path: '/' }],
      };
    }
    if (has('contact', 'support', 'email', 'phone', 'help')) {
      return { text: 'For help with My Stores Hubs, write to support@mystoreshubs.com.' };
    }
    if (has('what is', 'who are', 'mystores', 'my stores', 'website', 'hub')) {
      return {
        text: 'My Stores Hubs is a shopping mall of stores at www.mystoreshubs.com. Each business has its own link, products, and orders.',
      };
    }
    return { text: OUT_OF_SCOPE };
  }
}
