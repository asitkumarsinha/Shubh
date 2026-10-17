import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../core/order.service';
import { Order } from '../../core/models';
import { ToastService } from '../../core/toast.service';

type ActionStatus = 'pending' | 'approved' | 'dispatched' | 'rejected';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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

  readonly actionOptions: Array<{ value: ActionStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'dispatched', label: 'Dispatch' },
    { value: 'rejected', label: 'Reject' },
  ];

  constructor(private orderService: OrderService, private toast: ToastService) {}

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

  paymentLabel(method: Order['payment_method']): string {
    if (method === 'cod') return 'Cash on delivery';
    if (method === 'counter') return 'Pay at counter';
    return 'UPI QR';
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
