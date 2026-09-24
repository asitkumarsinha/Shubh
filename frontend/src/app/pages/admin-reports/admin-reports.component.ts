import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/order.service';
import { Report } from '../../core/models';
import { SavePhase, ToastService, saveButtonLabel } from '../../core/toast.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reports.component.html',
  styleUrl: './admin-reports.component.scss',
})
export class AdminReportsComponent implements OnInit {
  report: Report | null = null;
  email = '';
  showEmailPrompt = false;
  message = '';
  error = '';
  sending = false;
  sendPhase: SavePhase = 'idle';
  mailConfigured = false;
  previewUrl = '';
  outboxUrl = '';
  delivered = false;
  readonly saveButtonLabel = saveButtonLabel;

  constructor(private reportService: ReportService, private toast: ToastService) {}

  ngOnInit(): void {
    this.reportService.get().subscribe({
      next: (report: Report & { mailConfigured?: boolean }) => {
        this.report = report;
        this.mailConfigured = !!report.mailConfigured;
      },
      error: () => (this.error = 'Unable to load report'),
    });
  }

  openEmail(): void {
    this.showEmailPrompt = true;
    this.email = '';
    this.message = '';
    this.error = '';
    this.previewUrl = '';
    this.outboxUrl = '';
    this.delivered = false;
  }

  sendEmail(): void {
    if (!this.email) {
      this.error = 'Please enter an email id';
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

    this.reportService.email(this.email).subscribe({
      next: (res) => {
        this.sending = false;
        this.sendPhase = 'saved';
        this.showEmailPrompt = false;
        this.message = res.message;
        this.delivered = !!res.delivered;
        this.mailConfigured = !!res.mailConfigured;
        this.previewUrl = res.previewUrl || '';
        this.outboxUrl = res.outboxUrl || '';
        this.toast.success(res.message || 'Report saved');
        setTimeout(() => (this.sendPhase = 'idle'), 2500);

        if (res.previewUrl) {
          window.open(res.previewUrl, '_blank');
        } else if (res.outboxUrl) {
          this.openOutbox();
        }
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
