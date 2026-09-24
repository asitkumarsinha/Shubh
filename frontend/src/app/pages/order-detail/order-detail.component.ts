import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../../core/order.service';
import { AuthService } from '../../core/auth.service';
import { Order } from '../../core/models';
import { ToastService } from '../../core/toast.service';

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
  loading = true;
  acting = false;
  actLabel = '';

  constructor(
    private route: ActivatedRoute,
    private orders: OrderService,
    public auth: AuthService,
    private toast: ToastService
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
    this.runAction('Approving…', this.orders.approve(this.order.id), (o) =>
      `Approved. Purchase order ${o.po_number} generated.`
    );
  }

  reject(): void {
    if (!this.order) return;
    this.runAction('Saving…', this.orders.reject(this.order.id), () => 'Order rejected');
  }

  cancel(): void {
    if (!this.order) return;
    this.runAction('Saving…', this.orders.cancel(this.order.id), () => 'Order cancelled');
  }

  dispatch(): void {
    if (!this.order) return;
    this.runAction('Saving…', this.orders.dispatch(this.order.id), () =>
      'Medicine ready / marked as dispatched'
    );
  }

  private runAction(
    pending: string,
    req: ReturnType<OrderService['approve']>,
    ok: (o: Order) => string
  ): void {
    this.acting = true;
    this.actLabel = pending;
    this.error = '';
    this.toast.beginSave();
    req.subscribe({
      next: (o) => {
        this.order = o;
        this.acting = false;
        this.actLabel = 'Saved';
        this.toast.success(ok(o));
        setTimeout(() => (this.actLabel = ''), 2500);
      },
      error: (err) => {
        this.acting = false;
        this.actLabel = 'Save failed';
        const msg = err.error?.message || 'Save failed';
        this.error = msg;
        this.toast.error(msg);
        setTimeout(() => (this.actLabel = ''), 2500);
      },
    });
  }
}
