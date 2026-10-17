import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MedicineService } from '../../core/medicine.service';
import { TenantService } from '../../core/tenant.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
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
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './store-front.component.html',
  styleUrl: './store-front.component.scss',
})
export class StoreFrontComponent implements OnInit, OnDestroy {
  store: PublicStore | null = null;
  medicines: Medicine[] = [];
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private tenants: TenantService,
    private medicinesApi: MedicineService,
    public cart: CartService,
    public auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    document.documentElement.classList.add('hub-mall');
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.tenants.store(slug).subscribe({
      next: (store) => {
        this.store = store;
        this.medicinesApi.list({ tenantId: store.id, page: 1, limit: 24 }).subscribe({
          next: (data) => {
            this.medicines = data.items;
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            this.error = 'Unable to load products';
          },
        });
      },
      error: () => {
        this.loading = false;
        this.error = 'missing';
      },
    });
  }

  ngOnDestroy(): void {
    document.documentElement.classList.remove('hub-mall');
  }

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
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
