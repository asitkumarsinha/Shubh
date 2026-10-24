import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrderService, saveDownload } from '../../core/order.service';
import { Order } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { itemCount, matchesOrderQuery, receivingState, receivingText, sortOrders } from './order-grid';
import { GridSection, inr } from '../../core/grid-export';
import { GridActionsComponent } from '../../shared/grid-actions/grid-actions.component';

type ActionStatus = 'pending' | 'approved' | 'dispatched' | 'rejected';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GridActionsComponent],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss',
})
export class AdminOrdersComponent implements OnInit {
  orders: Order[] = [];
  filter = '';
  error = '';
  loading = true;
  updatingId: number | null = null;
  couponsEnabled = false;
  coupons: Array<{ id: number; code: string; kind: 'percent' | 'amount'; value: number }> = [];
  couponCode = '';
  couponKind: 'percent' | 'amount' = 'percent';
  couponValue = 10;
  query = '';
  newestFirst = true;
  readonly itemCount = itemCount;
  readonly receivingText = receivingText;
  readonly receivingState = receivingState;

  get gridSections(): GridSection[] {
    return [{
      title: 'Orders',
      headers: ['Bill', 'Date', 'Client', 'Contact', 'Total', 'Items', 'Receiving', 'State', 'Status', 'Payment'],
      rows: this.visibleOrders.map((order) => [
        order.bill_number,
        order.created_at,
        order.user?.name || '',
        order.user?.phone || order.user?.email || '',
        inr(order.total),
        String(itemCount(order.items)),
        receivingText(order),
        receivingState(order),
        order.status,
        order.payment_status || '',
      ]),
    }];
  }

  readonly actionOptions: Array<{ value: ActionStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'dispatched', label: 'Dispatch' },
    { value: 'rejected', label: 'Reject' },
  ];

  constructor(private orderService: OrderService, private toast: ToastService) {}

  download(order: Order): void {
    this.orderService.downloadInvoice(order.id).subscribe({
      next: (blob) => saveDownload(blob, `${order.bill_number}.html`),
      error: () => this.toast.error('Could not download the invoice'),
    });
  }

  ngOnInit(): void {
    this.reload();
    this.loadCoupons();
  }

  markPaid(order: Order): void {
    if (order.payment_status === 'paid') return;
    this.updatingId = order.id;
    this.orderService.markPaid(order.id).subscribe({
      next: (saved) => {
        this.updatingId = null;
        this.orders = this.orders.map((row) => (row.id === saved.id ? saved : row));
        this.toast.success(`${saved.bill_number} marked paid`);
      },
      error: (err) => {
        this.updatingId = null;
        this.toast.error(err.error?.message || 'Could not mark the payment');
      },
    });
  }

  loadCoupons(): void {
    this.orderService.coupons().subscribe({
      next: (result) => {
        this.couponsEnabled = result.enabled;
        this.coupons = result.coupons;
      },
    });
  }

  addCoupon(): void {
    this.orderService.createCoupon(this.couponCode.trim(), this.couponKind, Number(this.couponValue)).subscribe({
      next: () => {
        this.couponCode = '';
        this.toast.success('Discount code saved');
        this.loadCoupons();
      },
      error: (err) => this.toast.error(err.error?.message || 'Could not save discount code'),
    });
  }

  removeCoupon(id: number): void {
    this.orderService.deleteCoupon(id).subscribe({
      next: () => this.loadCoupons(),
      error: (err) => this.toast.error(err.error?.message || 'Could not remove discount code'),
    });
  }

  reload(status = this.filter): void {
    this.loading = true;
    this.orderService.all(status || undefined).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  get visibleOrders(): Order[] {
    return sortOrders(
      this.orders.filter((order) => matchesOrderQuery(order, this.query)),
      this.newestFirst
    );
  }

  setFilter(status: string): void {
    this.filter = status;
    this.reload(status);
  }

  actionValue(o: Order): ActionStatus {
    if (o.status === 'cancelled') return 'rejected';
    return o.status as ActionStatus;
  }

  onActionChange(o: Order, status: ActionStatus): void {
    if (!status || status === o.status) return;
    this.updatingId = o.id;
    this.error = '';
    this.toast.beginSave();
    this.orderService.setStatus(o.id, status).subscribe({
      next: (updated) => {
        this.updatingId = null;
        this.toast.success(`${updated.bill_number} status changed to ${updated.status}`);
        if ((updated.status === 'approved' || updated.status === 'dispatched') && updated.whatsapp?.url) {
          window.open(updated.whatsapp.url, '_blank', 'noopener');
        }
        this.reload();
      },
      error: (err) => {
        this.updatingId = null;
        const msg = err.error?.message || 'Failed to update status';
        this.error = msg;
        this.toast.error(msg);
        this.reload();
      },
    });
  }
}
