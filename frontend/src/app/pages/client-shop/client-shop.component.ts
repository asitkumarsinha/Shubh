import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MedicineService } from '../../core/medicine.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { Medicine } from '../../core/models';
import { GridSection, inr } from '../../core/grid-export';
import { GridActionsComponent } from '../../shared/grid-actions/grid-actions.component';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ClientShellComponent } from '../../shared/client-shell/client-shell.component';

@Component({
  selector: 'app-client-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ClientShellComponent, GridActionsComponent],
  templateUrl: './client-shop.component.html',
  styleUrl: './client-shop.component.scss',
})
export class ClientShopComponent implements OnInit {
  medicines: Medicine[] = [];
  categories: string[] = [];
  loading = true;
  query = '';
  category = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  get gridSections(): GridSection[] {
    return [{
      title: 'Shop',
      headers: ['Product', 'Price', 'Stock'],
      rows: this.medicines.map((medicine) => [medicine.name, inr(medicine.price), String(medicine.stock)]),
    }];
  }

  constructor(
    private medicineService: MedicineService,
    public cart: CartService,
    public auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.medicineService.categories().subscribe({
      next: (groups) => this.categories = groups,
      error: () => this.categories = [],
    });
    this.load();
  }

  pick(group: string): void {
    this.category = group;
    this.load();
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  load(): void {
    this.loading = true;
    this.medicineService.list({ q: this.query.trim(), category: this.category, page: 1, limit: 24 }).subscribe({
      next: (data) => {
        this.medicines = data.items;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
  }

  addToCart(medicine: Medicine): void {
    try {
      this.cart.add(medicine, 1);
      this.toast.success(`${medicine.name} added to cart`);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Could not add to cart');
    }
  }
}
