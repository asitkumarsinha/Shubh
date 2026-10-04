import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../core/order.service';
import { Order } from '../../core/models';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ClientShellComponent } from '../../shared/client-shell/client-shell.component';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, ClientShellComponent],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.scss',
})
export class MyOrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = true;

  constructor(
    private orderService: OrderService,
    private dialog: DialogService,
    private toast: ToastService
  ) {}

  async cancel(order: Order): Promise<void> {
    const confirmed = await this.dialog.confirm(
      `Cancel ${order.bill_number}? This is only possible before approval.`,
      'Cancel order'
    );
    if (!confirmed) return;
    this.orderService.cancelOwn(order.id).subscribe({
      next: (updated) => {
        this.orders = this.orders.map((item) => item.id === updated.id ? updated : item);
        this.toast.success('Order cancelled');
      },
      error: (err) => this.toast.error(err.error?.message || 'Could not cancel order'),
    });
  }

  ngOnInit(): void {
    this.orderService.myOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
  }
}
