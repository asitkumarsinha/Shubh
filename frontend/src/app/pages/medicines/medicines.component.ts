import { Component, OnDestroy, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MallGroup, MallStore, MedicineService } from '../../core/medicine.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { SettingsService } from '../../core/settings.service';
import { Medicine } from '../../core/models';
import { apiErrorMessage } from '../../core/api-error';
import { ToastService } from '../../core/toast.service';
import { fitLogoOnWhite } from '../../core/logo-fit';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import { HomeLoginComponent } from '../../shared/home-login/home-login.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';
import { productSlug } from '../../core/product-slug';
import { LeaveService } from '../../core/leave.service';

type MallSort = 'popular' | 'price' | 'price-desc' | 'newest' | 'stock';

interface CustomerCard {
  id: number;
  name: string;
  slug: string;
  slogan: string;
  products: number;
  image: string;
  categories: string;
}

const AVATAR_COLOURS = ['#2563eb', '#0f766e', '#9333ea', '#c2410c', '#be123c', '#0369a1', '#4d7c0f'];

@Component({
  selector: 'app-medicines',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent, HomeLoginComponent, ThemeToggleComponent],
  templateUrl: './medicines.component.html',
  styleUrl: './medicines.component.scss',
})
export class MedicinesComponent implements OnInit, OnDestroy {
  medicines: Medicine[] = [];
  loading = true;
  error = '';
  query = '';
  category = '';
  groups: MallGroup[] = [];
  page = 1;
  pages = 1;
  total = 0;
  storeCount = 0;
  productTotal = 0;
  sortBy: MallSort = 'popular';
  hubsOpen = true;
  readonly skeletonCards = [1, 2, 3, 4, 5, 6];
  readonly sorts: { id: MallSort; label: string }[] = [
    { id: 'popular', label: 'mall.sortPopular' },
    { id: 'price', label: 'mall.sortPrice' },
    { id: 'price-desc', label: 'mall.sortPriceDesc' },
    { id: 'newest', label: 'mall.sortNewest' },
    { id: 'stock', label: 'mall.sortStock' },
  ];

  customers: CustomerCard[] = [];
  selected: CustomerCard | null = null;
  customersLoading = false;
  selectedId: number | null = null;
  displayLogo = '';

  private fittedSource = '';
  private searchTimer?: ReturnType<typeof setTimeout>;
  private groupsReady = false;
  private storesReady = false;
  private opened = false;
  browseAll = false;

  constructor(
    private medicineService: MedicineService,
    public cart: CartService,
    public auth: AuthService,
    public settings: SettingsService,
    private toast: ToastService,
    private leave: LeaveService
  ) {
    effect(() => {
      const logo = this.settings.current().logo;
      if (!logo || logo === this.fittedSource) return;
      this.displayLogo = logo;
    });
  }

  ngOnInit(): void {
    document.documentElement.classList.add('hub-mall');
    this.loadGroups();
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-mall');
  }

  /** Search or a group filter shows products from every store in the mall. */
  get searchingAll(): boolean {
    return this.browseAll || this.query.trim().length > 0 || this.category !== '';
  }

  storeName(medicine: Medicine): string {
    return medicine.store_name || this.selected?.name || '';
  }

  private rememberSelection(): void {
    this.selected = this.customers.find((c) => c.id === this.selectedId) ?? null;
  }

  isStoreActive(id: number): boolean {
    return this.selectedId === id && !this.searchingAll;
  }

  pickGroup(name: string): void {
    this.category = this.category === name ? '' : name;
    this.page = 1;
    this.query = '';
    this.browseAll = !this.category && this.selectedId == null;
    this.load();
  }

  selectCustomer(id: number): void {
    if (this.isStoreActive(id) && this.medicines.length) return;
    this.selectedId = id;
    this.rememberSelection();
    this.page = 1;
    this.query = '';
    this.category = '';
    this.browseAll = false;
    this.load();
  }

  showAllStores(): void {
    this.category = '';
    this.query = '';
    this.selectedId = null;
    this.selected = null;
    this.browseAll = true;
    this.hubsOpen = true;
    this.page = 1;
    this.load();
    setTimeout(() => document.getElementById('mall-stores')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  onCategory(): void {
    this.page = 1;
    this.browseAll = !this.category && !this.query.trim() && this.selectedId == null;
    this.load();
  }

  setSort(sort: MallSort): void {
    if (this.sortBy === sort) return;
    this.sortBy = sort;
    this.page = 1;
    this.load();
  }

  badge(name: string): string {
    return (name.trim()[0] || '?').toUpperCase();
  }

  private loadGroups(): void {
    this.medicineService.mallGroups().subscribe({
      next: (groups) => {
        this.groups = groups;
        this.productTotal = groups.reduce((sum, group) => sum + Number(group.count || 0), 0);
        this.groupsReady = true;
        this.openFirstView();
      },
      error: () => {
        this.groups = [];
        this.groupsReady = true;
        this.openFirstView();
      },
    });
  }

  private openFirstView(): void {
    if (this.opened || !this.groupsReady || !this.storesReady) return;
    this.opened = true;
    const top = [...this.groups].sort((a, b) => b.count - a.count)[0];
    if (top) {
      this.category = top.name;
      this.browseAll = false;
      this.load();
      return;
    }
    const first = this.customers[0];
    if (first) this.selectCustomer(first.id);
    else this.load();
  }

  openMall(): void {
    if (this.auth.isLoggedIn()) {
      void this.leave.go('/shoppingmall');
      return;
    }
  }

  logout(): void {
    this.auth.logout();
  }

  avatarColour(id: number): string {
    return AVATAR_COLOURS[id % AVATAR_COLOURS.length];
  }

  onLogoLoad(event: Event): void {
    const source = this.settings.current().logo;
    if (!source || source.includes('mystoreshubs-logo')) {
      this.displayLogo = source;
      return;
    }
    if (this.fittedSource === source) return;
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
    this.searchTimer = setTimeout(() => this.runSearch(), 300);
  }

  runSearch(): void {
    clearTimeout(this.searchTimer);
    this.page = 1;
    this.browseAll = !this.query.trim() && !this.category && this.selectedId == null;
    this.load();
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) return;
    this.page = page;
    this.load();
  }

  load(): void {
    this.loading = true;
    const q = this.query.trim();
    const request = this.searchingAll
      ? this.medicineService.mall({ q, category: this.category, page: this.page, limit: 12, sort: this.sortBy })
      : this.medicineService.list({
          page: this.page,
          limit: 12,
          tenantId: this.selectedId ?? undefined,
          sort: this.sortBy,
        });
    request.subscribe({
      next: (data) => {
        this.medicines = data.items;
        this.total = data.total;
        this.pages = data.pages;
        this.page = data.page;
        this.storeCount = data.stores || (this.selectedId ? 1 : 0);
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

  storeSlug(medicine: Medicine): string {
    return medicine.store_slug || this.selected?.slug || '';
  }

  productLink(medicine: Medicine): string[] {
    const slug = this.storeSlug(medicine);
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
    this.medicineService.mallStores().subscribe({
      next: (stores) => {
        this.customers = stores.map((store) => this.toCard(store));
        this.rememberSelection();
        this.customersLoading = false;
        this.storesReady = true;
        this.openFirstView();
      },
      error: () => {
        this.customersLoading = false;
        this.storesReady = true;
        this.openFirstView();
      },
    });
  }

  private toCard(store: MallStore): CustomerCard {
    return {
      id: store.id,
      name: store.name,
      slug: store.slug || '',
      slogan: store.slogan || '',
      products: Number(store.products || 0),
      image: store.image || '',
      categories: store.categories || '',
    };
  }

}
