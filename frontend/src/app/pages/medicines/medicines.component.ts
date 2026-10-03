import { Component, OnDestroy, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MedicineService } from '../../core/medicine.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { OrderService } from '../../core/order.service';
import { UserService } from '../../core/user.service';
import { SettingsService } from '../../core/settings.service';
import { TenantService } from '../../core/tenant.service';
import { Medicine, Order } from '../../core/models';
import { apiErrorMessage } from '../../core/api-error';
import { ToastService } from '../../core/toast.service';
import { fitLogoOnWhite } from '../../core/logo-fit';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

interface CustomerCard {
  id: number;
  name: string;
  email: string;
  phone: string;
  orderCount: number;
}

interface PurchaseLine {
  key: string;
  name: string;
  image: string | null;
  price: number;
  quantity: number;
  date: string;
}

const AVATAR_COLOURS = ['#2563eb', '#0f766e', '#9333ea', '#c2410c', '#be123c', '#0369a1', '#4d7c0f'];

@Component({
  selector: 'app-medicines',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './medicines.component.html',
  styleUrl: './medicines.component.scss',
})
export class MedicinesComponent implements OnInit, OnDestroy {
  medicines: Medicine[] = [];
  loading = true;
  error = '';
  query = '';
  page = 1;
  pages = 1;
  total = 0;

  view: 'purchased' | 'shop' = 'shop';
  customers: CustomerCard[] = [];
  customersLoading = false;
  selectedId: number | null = null;
  displayLogo = '';

  private ordersByUser = new Map<number, Order[]>();
  private fittedSource = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private medicineService: MedicineService,
    private orderService: OrderService,
    private userService: UserService,
    public cart: CartService,
    public auth: AuthService,
    public settings: SettingsService,
    private tenants: TenantService,
    private i18n: TranslationService,
    private toast: ToastService,
    private router: Router
  ) {
    effect(() => {
      const logo = this.settings.current().logo;
      if (!logo || logo === this.fittedSource) return;
      this.displayLogo = logo;
    });
  }

  ngOnInit(): void {
    document.documentElement.classList.add('hub-mall');
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-mall');
  }

  get selected(): CustomerCard | null {
    return this.customers.find((c) => c.id === this.selectedId) ?? null;
  }

  get purchases(): PurchaseLine[] {
    if (this.selectedId == null) return [];
    const lines: PurchaseLine[] = [];
    for (const order of this.ordersByUser.get(this.selectedId) ?? []) {
      if (order.status === 'cancelled' || order.status === 'rejected') continue;
      for (const item of order.items) {
        lines.push({
          key: `${order.id}-${item.id}`,
          name: item.medicine_name,
          image: item.medicine_image,
          price: item.price,
          quantity: item.quantity,
          date: order.created_at,
        });
      }
    }
    return lines;
  }

  /** Customers other than the selected one, shown below the current-customer card. */
  get otherCustomers(): CustomerCard[] {
    return this.customers.filter((c) => c.id !== this.selectedId);
  }

  selectCustomer(id: number): void {
    if (this.selectedId === id && this.medicines.length) {
      this.view = 'shop';
      return;
    }
    this.selectedId = id;
    this.view = 'shop';
    this.page = 1;
    this.query = '';
    this.load();
  }

  showShop(): void {
    this.view = 'shop';
  }

  openMall(): void {
    if (this.auth.isLoggedIn() && !this.auth.isAdmin() && !this.auth.isSuperAdmin()) {
      this.router.navigate(['/cart']);
    } else {
      this.view = 'shop';
    }
  }

  logout(): void {
    this.auth.logout();
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('');
  }

  avatarColour(id: number): string {
    return AVATAR_COLOURS[id % AVATAR_COLOURS.length];
  }

  formatDate(value: string): string {
    const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(this.i18n.lang(), { day: '2-digit', month: 'short', year: 'numeric' });
  }

  onLogoLoad(event: Event): void {
    const source = this.settings.current().logo;
    if (!source || this.fittedSource === source) return;
    this.fittedSource = source;
    try {
      const fitted = fitLogoOnWhite(event.target as HTMLImageElement);
      if (fitted) this.displayLogo = fitted;
    } catch {
      this.displayLogo = source;
    }
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.load();
    }, 300);
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) return;
    this.page = page;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.medicineService.list({ q: this.query.trim(), page: this.page, limit: 12, tenantId: this.selectedId ?? undefined }).subscribe({
      next: (data) => {
        this.medicines = data.items;
        this.total = data.total;
        this.pages = data.pages;
        this.page = data.page;
        this.loading = false;
      },
      error: (err) => {
        this.error = apiErrorMessage(err, 'Unable to load products');
        this.loading = false;
      },
    });
  }

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
  }

  addToCart(m: Medicine): void {
    if (!this.auth.isLoggedIn()) {
      this.toast.error('Please login as a user to add products to cart');
      this.error = 'Please login as a user to add products to cart';
      return;
    }
    if (this.auth.isAdmin()) {
      this.error = 'Admin cannot purchase. Switch to a user account.';
      this.toast.error(this.error);
      return;
    }
    try {
      this.cart.add(m, 1);
      this.error = '';
      this.toast.success(`${m.name} added to cart`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add to cart';
      this.error = msg;
      this.toast.error(msg);
    }
  }

  private loadCustomers(): void {
    this.customersLoading = true;
    this.tenants.directory().subscribe({
      next: (stores) => {
        this.customers = stores.map((store) => ({
          id: store.id,
          name: store.name,
          email: store.contact_email || '',
          phone: store.contact_phone || '',
          orderCount: store.orderCount,
        }));
        this.customersLoading = false;
        const first = this.customers[0];
        if (first) this.selectCustomer(first.id);
        else this.load();
      },
      error: () => {
        this.customersLoading = false;
        this.load();
      },
    });
  }

  private groupOrders(orders: Order[]): void {
    const grouped = new Map<number, Order[]>();
    for (const order of orders) {
      const list = grouped.get(order.user_id) ?? [];
      list.push(order);
      grouped.set(order.user_id, list);
    }
    this.ordersByUser = grouped;
  }
}
