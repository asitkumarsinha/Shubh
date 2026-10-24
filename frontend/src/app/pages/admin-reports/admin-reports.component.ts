import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardService, ReportService } from '../../core/order.service';
import { DashboardLowStockItem, Report } from '../../core/models';
import { GridSection, inr } from '../../core/grid-export';
import { GridActionsComponent } from '../../shared/grid-actions/grid-actions.component';
import { SavePhase, ToastService, saveButtonLabel } from '../../core/toast.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GridActionsComponent],
  templateUrl: './admin-reports.component.html',
  styleUrl: './admin-reports.component.scss',
})
export class AdminReportsComponent implements OnInit {
  report: Report | null = null;
  email = '';
  smtpUser = '';
  smtpPass = '';
  showEmailPrompt = false;
  message = '';
  error = '';
  sending = false;
  sendPhase: SavePhase = 'idle';
  mailConfigured = false;
  previewUrl = '';
  outboxUrl = '';
  delivered = false;
  lowStock: DashboardLowStockItem[] = [];
  lowStockThreshold = 10;
  readonly saveButtonLabel = saveButtonLabel;

  constructor(
    private reportService: ReportService,
    private dashboard: DashboardService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.reportService.get().subscribe({
      next: (report: Report & { mailConfigured?: boolean; mailUser?: string }) => {
        this.report = report;
        this.mailConfigured = !!report.mailConfigured;
        this.smtpUser = report.mailUser || this.smtpUser;
      },
      error: () => (this.error = 'Unable to load report'),
    });
    this.dashboard.get().subscribe({
      next: (data) => {
        this.lowStock = data.lowStockItems;
        this.lowStockThreshold = data.summary.lowStockThreshold;
      },
    });
  }

  private monthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthSales(): Array<{ total: number }> {
    const key = this.monthKey();
    return (this.report?.orders || []).filter(
      (order) => order.created_at.startsWith(key) && order.status !== 'cancelled' && order.status !== 'rejected'
    );
  }

  get monthLabel(): string {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get monthOrders(): number {
    return this.monthSales().length;
  }

  get monthRevenue(): number {
    return this.monthSales().reduce((sum, order) => sum + Number(order.total || 0), 0);
  }

  get monthAverage(): number {
    return this.monthOrders ? this.monthRevenue / this.monthOrders : 0;
  }

  get gridSections(): GridSection[] {
    const report = this.report;
    return [
      {
        title: 'Users who purchased',
        headers: ['Name', 'Email', 'Phone', 'Orders', 'Total spent'],
        rows: (report?.buyers || []).map((buyer) => [
          buyer.name,
          buyer.email,
          buyer.phone || '',
          String(buyer.orderCount),
          inr(buyer.totalSpent),
        ]),
      },
      {
        title: 'Order status details',
        headers: ['Bill', 'User', 'Email', 'Price', 'Status', 'PO'],
        rows: (report?.orders || []).map((order) => [
          order.bill_number,
          order.userName,
          order.userEmail,
          inr(order.total),
          order.status,
          order.po_number || '',
        ]),
      },
      {
        title: 'Top medicines',
        headers: ['My Stores Hubs', 'Qty sold', 'Revenue'],
        rows: (report?.topMedicines || []).map((item) => [
          item.medicine_name,
          String(item.qtySold),
          inr(item.revenue),
        ]),
      },
    ];
  }

  saveReportEmail(): void {
    if (!this.mailConfigured) this.smtpUser = this.email.trim();
    this.sendEmail();
  }

  sendEmail(): void {
    if (!this.email) {
      this.error = 'Please enter an email id';
      this.toast.error(this.error);
      return;
    }
    if (!this.mailConfigured && (!this.smtpUser.trim() || this.smtpPass.trim().length < 8)) {
      this.error = 'Enter the Gmail address and its app password, plus who should receive the report.';
      this.toast.error(this.error);
      return;
    }
    this.sending = true;
    this.sendPhase = 'saving';
    this.error = '';
    this.message = '';
    this.previewUrl = '';
    this.outboxUrl = '';
    this.toast.beginSave();

    this.reportService
      .email(this.email, this.mailConfigured ? undefined : { user: this.smtpUser, pass: this.smtpPass })
      .subscribe({
      next: (res) => {
        this.sending = false;
        this.sendPhase = 'saved';
        this.showEmailPrompt = false;
        this.message = res.message;
        this.delivered = !!res.delivered;
        this.mailConfigured = !!res.mailConfigured;
        this.smtpPass = '';
        this.previewUrl = res.previewUrl || '';
        this.outboxUrl = res.outboxUrl || '';
        this.toast.success(res.message || 'Report emailed');
        setTimeout(() => (this.sendPhase = 'idle'), 2500);
      },
      error: (err) => {
        this.sending = false;
        this.sendPhase = 'failed';
        const msg =
          err.error?.message ||
          err.error?.hint ||
          'Failed to send email';
        this.error = msg;
        this.toast.error(msg);
        setTimeout(() => (this.sendPhase = 'idle'), 2500);
      },
    });
  }

  openOutbox(): void {
    if (!this.outboxUrl) return;
    this.reportService.getOutboxHtml(this.outboxUrl).subscribe({
      next: (html) => {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: () => (this.error = 'Unable to open saved email'),
    });
  }

  openPreview(): void {
    if (this.previewUrl) window.open(this.previewUrl, '_blank');
  }
}
