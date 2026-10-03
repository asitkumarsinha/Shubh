import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicSiteService, SiteFeedback } from '../../core/public-site.service';
import { SuperAdminShellComponent } from '../../shared/super-admin-shell/super-admin-shell.component';

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
}
