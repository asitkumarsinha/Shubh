import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TenantService } from '../../core/tenant.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { PageTitleService } from '../../core/page-title.service';
import { Medicine } from '../../core/models';

interface ProductStore {
  id: number;
  name: string;
  slug: string;
  title: string | null;
  slogan: string | null;
  logo: string | null;
}

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-page.component.html',
  styleUrl: './product-page.component.scss',
})
export class ProductPageComponent implements OnInit, OnDestroy {
  store: ProductStore | null = null;
  product: Medicine | null = null;
  slug = '';
  loading = true;
  missing = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tenants: TenantService,
    public cart: CartService,
    public auth: AuthService,
    private toast: ToastService,
    private pageTitle: PageTitleService
  ) {}

  ngOnInit(): void {
    document.documentElement.classList.add('hub-mall');
    this.route.paramMap.subscribe((params) => {
      this.load(params.get('slug') || '', params.get('product') || '');
    });
  }

  ngOnDestroy(): void {
    this.pageTitle.clear();
    document.documentElement.classList.remove('hub-mall');
  }

  get pageUrl(): string {
    if (!this.store || !this.slug) return '';
    return `${location.origin}/store/${this.store.slug}/${this.slug}`;
  }

  get whatsappUrl(): string {
    if (!this.product || !this.store) return '';
    const text = `${this.product.name} — ₹${this.product.price} at ${this.store.name}. ${this.pageUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
  }

  useFallback(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('assets/medicines/default.svg')) img.src = 'assets/medicines/default.svg';
  }

  copyLink(): void {
    const url = this.pageUrl;
    navigator.clipboard.writeText(url).then(
      () => this.toast.success('Product link copied'),
      () => this.toast.error(url)
    );
  }

  addToCart(): void {
    if (!this.product || !this.store) return;
    const user = this.auth.user();
    if (!user || user.role !== 'user' || user.tenant_id !== this.store.id) {
      this.toast.error(
        user && user.role === 'user'
          ? 'Your cart belongs to your own store.'
          : 'Sign in as a client of this store to add products.'
      );
      return;
    }
    try {
      this.cart.add(this.product, 1);
      this.toast.success(`${this.product.name} added to cart`);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Could not add to cart');
    }
  }

  private load(storeSlug: string, productSlug: string): void {
    this.loading = true;
    this.missing = false;
    this.tenants.product(storeSlug, productSlug).subscribe({
      next: (data) => {
        this.store = data.store;
        this.product = data.product;
        this.slug = data.slug;
        const storeName = data.store.title || data.store.name;
        this.pageTitle.set(
          `${data.product.name} · ${storeName}`,
          data.product.description || `${data.product.name} from ${storeName} on My Stores Hubs.`
        );
        this.loading = false;
        if (productSlug !== data.slug) {
          this.router.navigate(['/store', data.store.slug, data.slug], { replaceUrl: true });
        }
      },
      error: () => {
        this.loading = false;
        this.missing = true;
        this.pageTitle.set('Product');
      },
    });
  }
}
