import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MedicineService } from '../../core/medicine.service';
import { TenantService } from '../../core/tenant.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { PageTitleService } from '../../core/page-title.service';
import { Medicine } from '../../core/models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface PublicStore {
  id: number;
  name: string;
  slug: string;
  contact_email: string;
  contact_phone: string;
  title: string | null;
  slogan: string | null;
  logo: string | null;
}

@Component({
  selector: 'app-store-front',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './store-front.component.html',
  styleUrl: './store-front.component.scss',
})
export class StoreFrontComponent implements OnInit, OnDestroy {
  store: PublicStore | null = null;
  medicines: Medicine[] = [];
  loading = true;
  productsLoading = false;
  error = '';
  query = '';
  page = 1;
  pages = 1;
  total = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private route: ActivatedRoute,
    private tenants: TenantService,
    private medicinesApi: MedicineService,
    public cart: CartService,
    public auth: AuthService,
    private toast: ToastService,
    private pageTitle: PageTitleService
  ) {}

  get storeUrl(): string {
    if (!this.store) return '';
    return `${location.origin}/store/${this.store.slug}`;
  }

  ngOnInit(): void {
    document.documentElement.classList.add('hub-mall');
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.tenants.store(slug).subscribe({
      next: (store) => {
        this.store = store;
        this.pageTitle.set(store.name || store.title || 'Store');
        this.loading = false;
        this.loadProducts();
      },
      error: () => {
        this.loading = false;
        this.error = 'missing';
        this.pageTitle.set('Store');
      },
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    this.pageTitle.clear();
    document.documentElement.classList.remove('hub-mall');
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.loadProducts();
    }, 300);
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) return;
    this.page = page;
    this.loadProducts();
  }

  private loadProducts(): void {
    if (!this.store) return;
    this.productsLoading = true;
    this.medicinesApi.list({
      tenantId: this.store.id,
      q: this.query.trim(),
      page: this.page,
      limit: 12,
    }).subscribe({
      next: (data) => {
        this.medicines = data.items;
        this.total = data.total;
        this.pages = data.pages;
        this.page = data.page;
        this.productsLoading = false;
      },
      error: () => {
        this.productsLoading = false;
        this.error = 'Unable to load products';
      },
    });
  }

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
  }

  useFallback(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('assets/medicines/default.svg')) {
      img.src = 'assets/medicines/default.svg';
    }
  }

  copyLink(): void {
    const url = location.href;
    navigator.clipboard.writeText(url).then(
      () => this.toast.success('Store link copied'),
      () => this.toast.error(url)
    );
  }

  addToCart(medicine: Medicine): void {
    const user = this.auth.user();
    if (!user || user.role !== 'user' || user.tenant_id !== this.store?.id) {
      this.toast.error(
        user && user.role === 'user'
          ? 'Your cart belongs to your own store.'
          : 'Sign in as a client of this store to add products.'
      );
      return;
    }
    try {
      this.cart.add(medicine, 1);
      this.toast.success(`${medicine.name} added to cart`);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Could not add to cart');
    }
  }
}
