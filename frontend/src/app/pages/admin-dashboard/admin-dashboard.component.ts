import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardService, OrderService } from '../../core/order.service';
import { MedicineService } from '../../core/medicine.service';
import { EmployeeService } from '../../core/employee.service';
import { Dashboard } from '../../core/models';
import { SavePhase, ToastService, saveButtonLabel } from '../../core/toast.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  data: Dashboard | null = null;
  loading = true;
  error = '';
  approvingId: number | null = null;
  restockingId: number | null = null;
  restockedId: number | null = null;
  restockQty: Record<number, number> = {};
  empName = '';
  empEmail = '';
  empPhone = '';
  empDesignation = '';
  empSaving = false;
  empPhase: SavePhase = 'idle';
  readonly saveButtonLabel = saveButtonLabel;

  constructor(
    private dashboard: DashboardService,
    private orders: OrderService,
    private medicines: MedicineService,
    private employees: EmployeeService,
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
        for (const item of data.lowStockItems) {
          if (this.restockQty[item.id] == null) this.restockQty[item.id] = 10;
        }
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

  restock(id: number): void {
    const quantity = Number(this.restockQty[id] || 0);
    if (quantity < 1) {
      this.error = 'Enter a restock quantity of at least 1';
      this.toast.error(this.error);
      return;
    }
    this.restockingId = id;
    this.error = '';
    this.toast.beginSave();
    this.medicines.restock(id, quantity).subscribe({
      next: (med) => {
        this.restockingId = null;
        this.restockedId = id;
        this.toast.success(`${med.name} restocked to ${med.stock}`);
        this.reload();
        setTimeout(() => (this.restockedId = null), 2500);
      },
      error: (err) => {
        this.restockingId = null;
        const msg = err.error?.message || 'Restock failed';
        this.error = msg;
        this.toast.error(msg);
      },
    });
  }

  addEmployee(): void {
    if (!this.empName || !this.empEmail || !this.empPhone || !this.empDesignation) {
      this.error = 'Name, email, phone and designation are required';
      this.toast.error(this.error);
      return;
    }
    const form = new FormData();
    form.append('name', this.empName);
    form.append('email', this.empEmail);
    form.append('phone', this.empPhone);
    form.append('designation', this.empDesignation);
    this.empSaving = true;
    this.empPhase = 'saving';
    this.error = '';
    this.toast.beginSave();
    this.employees.create(form).subscribe({
      next: (emp) => {
        this.empSaving = false;
        this.empPhase = 'saved';
        this.toast.success(`${emp.name} added`);
        this.empName = '';
        this.empEmail = '';
        this.empPhone = '';
        this.empDesignation = '';
        setTimeout(() => (this.empPhase = 'idle'), 2500);
      },
      error: (err) => {
        this.empSaving = false;
        this.empPhase = 'failed';
        const msg = err.error?.message || 'Could not add employee';
        this.error = msg;
        this.toast.error(msg);
        setTimeout(() => (this.empPhase = 'idle'), 2500);
      },
    });
  }
}
