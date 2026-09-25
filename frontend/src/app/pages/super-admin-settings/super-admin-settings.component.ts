import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../core/settings.service';
import { ToastService } from '../../core/toast.service';
import { Tenant } from '../../core/models';
import { TenantService } from '../../core/tenant.service';
import { PublicSiteService } from '../../core/public-site.service';

@Component({
  selector: 'app-super-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './super-admin-settings.component.html',
  styleUrl: './super-admin-settings.component.scss',
})
export class SuperAdminSettingsComponent implements OnInit {
  title = '';
  slogan = '';
  themeColor = '#1f242c';
  fontFamily: 'Syne' | 'IBM Plex Sans' | 'System UI' = 'Syne';
  loginInitial = '';
  tenants: Tenant[] = [];
  selectedTenantId = 1;
  logo: File | null = null;
  qrCode: File | null = null;
  saving = false;
  message = '';
  error = '';
  hits = 0;

  constructor(
    public settings: SettingsService,
    private tenantsApi: TenantService,
    private publicSite: PublicSiteService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.publicSite.hits().subscribe({
      next: (row) => this.hits = row.count,
    });
    this.tenantsApi.list().subscribe({
      next: (tenants) => {
        this.tenants = tenants;
        this.selectedTenantId = tenants.some((tenant) => tenant.id === 1) ? 1 : tenants[0]?.id || 1;
        this.loadCustomerSettings();
      },
      error: () => this.error = 'Could not load customer list',
    });
  }

  loadCustomerSettings(): void {
    this.error = '';
    this.settings.loadForTenant(this.selectedTenantId).subscribe({
      next: (value) => {
        this.title = value.title;
        this.slogan = value.slogan;
        this.themeColor = value.theme_color;
        this.fontFamily = value.font_family;
        this.loginInitial = value.login_initial || '';
      },
      error: (err) => this.error = err.error?.message || 'Could not load customer settings',
    });
  }

  selectFile(event: Event, type: 'logo' | 'qrCode'): void {
    const file = (event.target as HTMLInputElement).files?.[0] || null;
    this[type] = file;
  }

  save(): void {
    if (!this.title.trim() || !this.slogan.trim()) {
      this.error = 'Website title and slogan are required';
      this.toast.error(this.error);
      return;
    }
    const form = new FormData();
    form.append('title', this.title.trim());
    form.append('slogan', this.slogan.trim());
    form.append('themeColor', this.themeColor);
    form.append('fontFamily', this.fontFamily);
    form.append('loginInitial', this.loginInitial.trim().toLowerCase());
    if (this.logo) form.append('logo', this.logo);
    if (this.qrCode) form.append('qrCode', this.qrCode);

    this.saving = true;
    this.error = '';
    this.toast.beginSave();
    this.settings.update(form, this.selectedTenantId).subscribe({
      next: (saved) => {
        this.saving = false;
        this.logo = null;
        this.qrCode = null;
        this.settings.set(saved);
        this.message = 'Website settings saved';
        this.toast.success(this.message);
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.message || 'Could not save website settings';
        this.toast.error(this.error);
      },
    });
  }
}
