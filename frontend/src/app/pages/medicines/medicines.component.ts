import { Component, OnDestroy, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MedicineService } from '../../core/medicine.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { SettingsService } from '../../core/settings.service';
import { TenantService } from '../../core/tenant.service';
import { Medicine } from '../../core/models';
import { apiErrorMessage } from '../../core/api-error';
import { ToastService } from '../../core/toast.service';
import { fitLogoOnWhite } from '../../core/logo-fit';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import { productSlug } from '../../core/product-slug';

interface CustomerCard {
  id: number;
  name: string;
  email: string;
  phone: string;
  slug: string;
  orderCount: number;
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
  category = '';
  categories: string[] = [];
  page = 1;
  pages = 1;
  total = 0;

  customers: CustomerCard[] = [];
  customersLoading = false;
  selectedId: number | null = null;
  displayLogo = '';

  private fittedSource = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private medicineService: MedicineService,
    public cart: CartService,
    public auth: AuthService,
    public settings: SettingsService,
    private tenants: TenantService,
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

  /** Customers other than the selected one, shown below the current-customer card. */
  get otherCustomers(): CustomerCard[] {
    return this.customers.filter((c) => c.id !== this.selectedId);
  }

  selectCustomer(id: number): void {
    if (this.selectedId === id && this.medicines.length) return;
    this.selectedId = id;
    this.page = 1;
    this.query = '';
    this.category = '';
    this.loadCategories();
    this.load();
  }

  onCategory(): void {
    this.page = 1;
    this.load();
  }

  private loadCategories(): void {
    if (!this.selectedId) {
      this.categories = [];
      return;
    }
    this.medicineService.categories(this.selectedId).subscribe({
      next: (groups) => { this.categories = groups; },
      error: () => { this.categories = []; },
    });
  }

  openMall(): void {
    if (this.auth.isLoggedIn() && !this.auth.isAdmin() && !this.auth.isSuperAdmin()) {
      this.router.navigate(['/cart']);
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
    this.medicineService.list({
      q: this.query.trim(),
      category: this.category,
      page: this.page,
      limit: 12,
      tenantId: this.selectedId ?? undefined,
    }).subscribe({
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

  productLink(medicine: Medicine): string[] {
    const slug = this.selected?.slug;
    if (!slug) return ['/'];
    return ['/store', slug, productSlug(medicine.name, medicine.id)];
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
          slug: store.slug || '',
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

}
