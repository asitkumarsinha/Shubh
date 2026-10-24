import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService, OrderService } from '../../core/order.service';
import { Dashboard } from '../../core/models';
import { GridSection, inr } from '../../core/grid-export';
import { ToastService } from '../../core/toast.service';
import { GridActionsComponent } from '../../shared/grid-actions/grid-actions.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, GridActionsComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  data: Dashboard | null = null;
  loading = true;
  error = '';
  approvingId: number | null = null;
  readonly now = new Date();

  get gridSections(): GridSection[] {
    return [{
      title: 'Pending orders',
      headers: ['Order', 'Store', 'Customer', 'Email', 'Items', 'Item names', 'Total', 'Time'],
      rows: (this.data?.pendingOrders || []).map((order) => [
        order.bill_number,
        order.storeName || '',
        order.userName,
        order.userEmail,
        String(order.itemCount || 0),
        order.itemNames || '',
        inr(order.total),
        order.created_at,
      ]),
    }];
  }

  constructor(
    private dashboard: DashboardService,
    private orders: OrderService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = !this.data;
    this.dashboard.get().subscribe({
      next: (data) => {
        this.data = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Unable to load dashboard';
      },
    });
  }

  approve(id: number): void {
    this.approvingId = id;
    this.error = '';
    this.toast.beginSave();
    this.orders.approve(id).subscribe({
      next: (order) => {
        this.approvingId = null;
        this.toast.success(`${order.bill_number} approved`);
        if (order.whatsapp?.url) window.open(order.whatsapp.url, '_blank', 'noopener');
        this.reload();
      },
      error: (err) => {
        this.approvingId = null;
        const msg = err.error?.message || 'Approve failed';
        this.error = msg;
        this.toast.error(msg);
      },
    });
  }
}
