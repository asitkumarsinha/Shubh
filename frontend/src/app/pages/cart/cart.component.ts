import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { OrderService } from '../../core/order.service';
import { AuthService } from '../../core/auth.service';
import { SavePhase, ToastService, saveButtonLabel } from '../../core/toast.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ClientShellComponent } from '../../shared/client-shell/client-shell.component';
import { SettingsService } from '../../core/settings.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, ClientShellComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent implements OnInit {
  loading = false;
  savePhase: SavePhase = 'idle';
  error = '';
  quoteError = '';
  paymentMethod: 'upi' | 'cod' | 'counter' = 'upi';
  fulfillment: 'delivery' | 'pickup' = 'pickup';
  deliveryAddress = '';
  couponCode = '';
  quote = { subtotal: 0, discount: 0, total: 0, couponCode: null as string | null };
  readonly saveButtonLabel = saveButtonLabel;

  constructor(
    public cart: CartService,
    private orders: OrderService,
    public auth: AuthService,
    public settings: SettingsService,
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const saved = this.auth.user() as { address?: string } | null;
    this.deliveryAddress = saved?.address || '';
    this.refreshQuote();
  }

  changeQty(medicineId: number, quantity: number): void {
    this.cart.updateQty(medicineId, quantity);
    this.refreshQuote();
  }

  removeItem(medicineId: number): void {
    this.cart.remove(medicineId);
    this.refreshQuote();
  }

  refreshQuote(): void {
    const items = this.cart.items().map((item) => ({ medicineId: item.medicineId, quantity: item.quantity }));
    if (!items.length) {
      this.quote = { subtotal: 0, discount: 0, total: 0, couponCode: null };
      this.quoteError = '';
      return;
    }
    this.orders.quote(items, this.couponCode.trim()).subscribe({
      next: (quote) => {
        this.quote = quote;
        this.quoteError = '';
      },
      error: (err) => {
        this.quoteError = err.error?.message || 'Discount code is not valid';
        this.quote = {
          subtotal: this.cart.total(),
          discount: 0,
          total: this.cart.total(),
          couponCode: null,
        };
      },
    });
  }

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
  }

  checkout(): void {
    if (!this.auth.isLoggedIn() || this.auth.isAdmin()) {
      this.error = 'Please login as a customer to checkout';
      this.toast.error(this.error);
      return;
    }
    if (this.couponCode.trim() && this.quoteError) {
      this.error = this.quoteError;
      this.toast.error(this.error);
      return;
    }
    if (this.fulfillment === 'delivery' && this.deliveryAddress.trim().length < 5) {
      this.error = 'Enter the delivery address';
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
    this.orders.checkout(
      items,
      this.paymentMethod,
      this.couponCode.trim(),
      this.fulfillment,
      this.deliveryAddress.trim()
    ).subscribe({
      next: (order) => {
        this.cart.clear();
        this.loading = false;
        this.savePhase = 'saved';
        this.toast.success(`Order saved · bill ${order.bill_number}`);
        if (order.whatsapp?.url) window.open(order.whatsapp.url, '_blank', 'noopener');
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
