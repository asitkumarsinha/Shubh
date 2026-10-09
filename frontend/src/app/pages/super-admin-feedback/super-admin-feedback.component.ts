import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicSiteService, SiteFeedback } from '../../core/public-site.service';
import { SuperAdminShellComponent } from '../../shared/super-admin-shell/super-admin-shell.component';

type FeedbackStatus = 'done' | 'pending';

@Component({
  selector: 'app-super-admin-feedback',
  standalone: true,
  imports: [CommonModule, SuperAdminShellComponent],
  templateUrl: './super-admin-feedback.component.html',
  styleUrl: './super-admin-feedback.component.scss',
})
export class SuperAdminFeedbackComponent implements OnInit {
  items: SiteFeedback[] = [];
  error = '';
  loading = true;
  savingId: number | null = null;

  get requests() {
    return this.items.filter((item) => item.kind === 'contact');
  }

  get notes() {
    return this.items.filter((item) => item.kind !== 'contact');
  }

  constructor(private publicSite: PublicSiteService) {}

  ngOnInit(): void {
    this.publicSite.listFeedback().subscribe({
      next: (items) => {
        this.items = items;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Could not load feedback';
      },
    });
  }

  statusOf(item: SiteFeedback): FeedbackStatus {
    return item.status === 'done' ? 'done' : 'pending';
  }

  setStatus(item: SiteFeedback, value: string): void {
    const status: FeedbackStatus = value === 'done' ? 'done' : 'pending';
    const previous = item.status;
    item.status = status;
    this.savingId = item.id;
    this.error = '';
    this.publicSite.setFeedbackStatus(item.id, status).subscribe({
      next: (saved) => {
        item.status = saved.status;
        this.savingId = null;
      },
      error: (err) => {
        item.status = previous;
        this.savingId = null;
        this.error = err.error?.message || 'Could not update action';
      },
    });
  }
}
