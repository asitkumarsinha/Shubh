import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { OrderService } from '../../core/order.service';
import { Order, OrderItem } from '../../core/models';
import { GridSection, inr } from '../../core/grid-export';
import { GridActionsComponent } from '../../shared/grid-actions/grid-actions.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ClientShellComponent } from '../../shared/client-shell/client-shell.component';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-client-account',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, ClientShellComponent, GridActionsComponent],
  templateUrl: './client-account.component.html',
  styleUrl: './client-account.component.scss',
})
export class ClientAccountComponent implements OnInit {
  orders: Order[] = [];
  loading = true;

  constructor(
    public auth: AuthService,
    private orderService: OrderService,
    private i18n: TranslationService
  ) {}

  ngOnInit(): void {
    this.orderService.myOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  get purchases(): OrderItem[] {
    return this.orders.flatMap((order) => order.items).slice(0, 6);
  }

  get gridSections(): GridSection[] {
    return [{
      title: 'Recent orders',
      headers: ['Order', 'Date', 'Total', 'Status'],
      rows: this.orders.map((order) => [
        String(order.id),
        this.formatDate(order.created_at),
        inr(order.total),
        order.status,
      ]),
    }];
  }

  formatDate(value: string): string {
    const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(this.i18n.lang());
  }
}
