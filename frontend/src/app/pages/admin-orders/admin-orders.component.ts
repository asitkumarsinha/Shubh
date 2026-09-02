import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../core/order.service';
import { Order } from '../../core/models';

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
  message = '';
  error = '';
  loading = true;
  updatingId: number | null = null;

  readonly actionOptions: Array<{ value: ActionStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'dispatched', label: 'Dispatch' },
    { value: 'rejected', label: 'Reject' },
  ];

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.reload();
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
    this.message = '';
    this.orderService.setStatus(o.id, status).subscribe({
      next: (updated) => {
        this.updatingId = null;
        this.message = `${updated.bill_number} status changed to ${updated.status}`;
        this.reload();
      },
      error: (err) => {
        this.updatingId = null;
        this.error = err.error?.message || 'Failed to update status';
        this.reload();
      },
    });
  }
}
