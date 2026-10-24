import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Tenant, TenantModules } from '../../core/models';
import { TenantService } from '../../core/tenant.service';
import { SuperAdminShellComponent } from '../../shared/super-admin-shell/super-admin-shell.component';

type BoardSection = 'dashboard' | 'stores' | 'users' | 'billing' | 'plans' | 'health' | 'reports';

const COPY: Record<BoardSection, { title: string; lead: string }> = {
  dashboard: {
    title: 'Dashboard',
    lead: 'Hubs, stores, people, and orders across My Stores Hubs.',
  },
  stores: {
    title: 'Stores',
    lead: 'Customer storefronts. Open a store to see its public page.',
  },
  users: {
    title: 'Users',
    lead: 'Store owners for each hub, and how many clients that hub has.',
  },
  billing: {
    title: 'Apps & Billing',
    lead: 'Plan price, billing cycle, payment, and the apps turned on for each hub.',
  },
  plans: {
    title: 'Plans',
    lead: 'The plan and the limits set for each hub.',
  },
  health: {
    title: 'System Health',
    lead: 'Whether the site API is up, and how many hubs are active.',
  },
  reports: {
    title: 'Reports',
    lead: 'Orders, products, employees, and clients recorded for each hub.',
  },
};

const APP_LABELS: Array<[keyof TenantModules, string]> = [
  ['wholesale', 'Wholesale'],
  ['employees', 'Employees'],
  ['reports', 'Reports'],
  ['qrCheckout', 'QR checkout'],
  ['coupons', 'Coupons'],
  ['prescriptions', 'Prescriptions'],
];

@Component({
  selector: 'app-super-admin-board',
  standalone: true,
  imports: [CommonModule, RouterLink, SuperAdminShellComponent],
  templateUrl: './super-admin-board.component.html',
  styleUrl: './super-admin-board.component.scss',
})
export class SuperAdminBoardComponent implements OnInit, OnDestroy {
  section: BoardSection = 'dashboard';
  tenants: Tenant[] = [];
  loading = true;
  error = '';
  healthOk: boolean | null = null;
  healthService = '';
  private routeSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private tenantsApi: TenantService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.data.subscribe((data) => {
      const next = data['section'];
      this.section = COPY[next as BoardSection] ? (next as BoardSection) : 'dashboard';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get title(): string {
    return COPY[this.section].title;
  }

  get lead(): string {
    return COPY[this.section].lead;
  }

  get activeHubs(): number {
    return this.tenants.filter((tenant) => tenant.status === 'active').length;
  }

  get suspendedHubs(): number {
    return this.tenants.filter((tenant) => tenant.status === 'suspended').length;
  }

  get archivedHubs(): number {
    return this.tenants.filter((tenant) => tenant.status === 'archived').length;
  }

  get orderTotal(): number {
    return this.tenants.reduce((sum, tenant) => sum + (tenant.usage?.orders || 0), 0);
  }

  get clientTotal(): number {
    return this.tenants.reduce((sum, tenant) => sum + (tenant.usage?.users || 0), 0);
  }

  apps(tenant: Tenant): string {
    const modules = tenant.modules;
    if (!modules) return '—';
    const names = APP_LABELS.filter(([key]) => modules[key]).map(([, label]) => label);
    return names.length ? names.join(', ') : 'None';
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.healthOk = null;
    this.tenantsApi.list().subscribe({
      next: (tenants) => {
        this.tenants = tenants;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Could not load this page';
      },
    });
    if (this.section === 'health') {
      this.http.get<{ ok?: boolean; service?: string }>('/api/health').subscribe({
        next: (body) => {
          this.healthOk = body.ok !== false;
          this.healthService = body.service || 'API';
        },
        error: () => {
          this.healthOk = false;
          this.healthService = 'API';
        },
      });
    }
  }
}
