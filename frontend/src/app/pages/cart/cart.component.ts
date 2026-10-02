import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { OrderService } from '../../core/order.service';
import { AuthService } from '../../core/auth.service';
import { SavePhase, ToastService, saveButtonLabel } from '../../core/toast.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  loading = false;
  savePhase: SavePhase = 'idle';
  error = '';
  paymentMethod: 'upi' | 'cod' | 'counter' = 'upi';
  couponCode = '';
  readonly saveButtonLabel = saveButtonLabel;

  constructor(
    public cart: CartService,
    private orders: OrderService,
    private auth: AuthService,
    private router: Router,
    private toast: ToastService
  ) {}

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
  }

  checkout(): void {
    if (!this.auth.isLoggedIn() || this.auth.isAdmin()) {
      this.error = 'Please login as a customer to checkout';
      this.toast.error(this.error);
      return;
    }
    const items = this.cart.items().map((i) => ({
      medicineId: i.medicineId,
      quantity: i.quantity,
    }));
    this.loading = true;
    this.savePhase = 'saving';
    this.error = '';
    this.toast.beginSave();
    this.orders.checkout(items, this.paymentMethod, this.couponCode.trim()).subscribe({
      next: (order) => {
        this.cart.clear();
        this.loading = false;
        this.savePhase = 'saved';
        this.toast.success(`Order saved · bill ${order.bill_number}`);
        this.router.navigate(['/orders', order.id]);
      },
      error: (err) => {
        this.loading = false;
        this.savePhase = 'failed';
        const msg = err.error?.message || 'Checkout failed';
        this.error = msg;
        this.toast.error(msg);
        setTimeout(() => (this.savePhase = 'idle'), 2500);
      },
    });
  }
}
