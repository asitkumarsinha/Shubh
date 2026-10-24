import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService, saveDownload } from '../../core/order.service';
import { Order } from '../../core/models';
import { GridSection, inr } from '../../core/grid-export';
import { GridActionsComponent } from '../../shared/grid-actions/grid-actions.component';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ClientShellComponent } from '../../shared/client-shell/client-shell.component';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, ClientShellComponent, GridActionsComponent],
  templateUrl: './my-orders.component.html',
  styleUrl: './my-orders.component.scss',
})
export class MyOrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = true;

  get gridSections(): GridSection[] {
    return [{
      title: 'My orders',
      headers: ['Bill', 'Status', 'Payment', 'PO', 'Total', 'Items'],
      rows: this.orders.map((order) => [
        order.bill_number,
        order.status,
        order.payment_status || '',
        order.po_number || '',
        inr(order.total),
        order.items.map((item) => `${item.medicine_name} x${item.quantity}`).join('; '),
      ]),
    }];
  }

  constructor(
    private orderService: OrderService,
    private dialog: DialogService,
    private toast: ToastService
  ) {}

  download(order: Order): void {
    this.orderService.downloadInvoice(order.id).subscribe({
      next: (blob) => saveDownload(blob, `${order.bill_number}.html`),
      error: () => this.toast.error('Could not download the invoice'),
    });
  }

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
