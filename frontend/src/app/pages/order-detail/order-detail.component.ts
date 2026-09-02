import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../../core/order.service';
import { AuthService } from '../../core/auth.service';
import { Order } from '../../core/models';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent implements OnInit {
  order: Order | null = null;
  error = '';
  message = '';
  loading = true;
  acting = false;

  constructor(
    private route: ActivatedRoute,
    private orders: OrderService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.orders.get(id).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Order not found';
        this.loading = false;
      },
    });
  }

  imageUrl(path: string | null): string {
    return path || 'assets/medicines/default.svg';
  }

  itemCount(): number {
    return this.order?.items.reduce((s, i) => s + i.quantity, 0) || 0;
  }

  pipelineSteps(): { key: string; label: string; state: 'done' | 'current' | 'failed' | 'todo' }[] {
    const status = this.order?.status || 'pending';
    const failed = status === 'rejected' || status === 'cancelled';

    const rank: Record<string, number> = {
      pending: 1,
      approved: 2,
      dispatched: 3,
      rejected: 1,
      cancelled: 2,
    };
    const current = rank[status] ?? 1;

    const keys = [
      { key: 'bill', label: 'Bill created', at: 0 },
      { key: 'pending', label: 'Pending / QR', at: 1 },
      { key: 'approved', label: 'Approved · PO', at: 2 },
      { key: 'dispatched', label: 'Dispatched', at: 3 },
    ];

    if (status === 'dispatched') {
      return keys.map((step) => ({ ...step, state: 'done' as const }));
    }

    return keys.map((step) => {
      if (failed && step.at === current) {
        return {
          ...step,
          label: status === 'rejected' ? 'Rejected' : 'Cancelled',
          state: 'failed' as const,
        };
      }
      if (step.at < current) return { ...step, state: 'done' as const };
      if (step.at === current) return { ...step, state: 'current' as const };
      return { ...step, state: 'todo' as const };
    });
  }

  approve(): void {
    if (!this.order) return;
    this.acting = true;
    this.orders.approve(this.order.id).subscribe({
      next: (o) => {
        this.order = o;
        this.message = `Approved. Purchase order ${o.po_number} generated.`;
        this.acting = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Approve failed';
        this.acting = false;
      },
    });
  }

  reject(): void {
    if (!this.order) return;
    this.acting = true;
    this.orders.reject(this.order.id).subscribe({
      next: (o) => {
        this.order = o;
        this.message = 'Order rejected';
        this.acting = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Reject failed';
        this.acting = false;
      },
    });
  }

  cancel(): void {
    if (!this.order) return;
    this.acting = true;
    this.orders.cancel(this.order.id).subscribe({
      next: (o) => {
        this.order = o;
        this.message = 'Order cancelled';
        this.acting = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Cancel failed';
        this.acting = false;
      },
    });
  }

  dispatch(): void {
    if (!this.order) return;
    this.acting = true;
    this.orders.dispatch(this.order.id).subscribe({
      next: (o) => {
        this.order = o;
        this.message = 'Medicine ready / marked as dispatched';
        this.acting = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Dispatch failed';
        this.acting = false;
      },
    });
  }
}
