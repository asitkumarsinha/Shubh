import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { OrderService } from '../../core/order.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  loading = false;
  error = '';

  constructor(
    public cart: CartService,
    private orders: OrderService,
    private auth: AuthService,
    private router: Router
  ) {}

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
  }

  checkout(): void {
    if (!this.auth.isLoggedIn() || this.auth.isAdmin()) {
      this.error = 'Please login as a customer to checkout';
      return;
    }
    const items = this.cart.items().map((i) => ({
      medicineId: i.medicineId,
      quantity: i.quantity,
    }));
    this.loading = true;
    this.error = '';
    this.orders.checkout(items).subscribe({
      next: (order) => {
        this.cart.clear();
        this.loading = false;
        this.router.navigate(['/orders', order.id]);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Checkout failed';
      },
    });
  }
}
