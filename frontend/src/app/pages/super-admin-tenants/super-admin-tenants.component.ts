import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Tenant, TenantModules } from '../../core/models';
import { TenantService } from '../../core/tenant.service';
import { ToastService } from '../../core/toast.service';
import { DialogService } from '../../core/dialog.service';

const defaultModules: TenantModules = {
  wholesale: true, employees: true, reports: true, qrCheckout: true, coupons: false, prescriptions: false,
};

@Component({
  selector: 'app-super-admin-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './super-admin-tenants.component.html',
  styleUrl: './super-admin-tenants.component.scss',
})
export class SuperAdminTenantsComponent implements OnInit {
  tenants: Tenant[] = [];
  name = '';
  slug = '';
  adminName = '';
  adminEmail = '';
  adminPassword = '';
  plan = 'Basic';
  billingCycle: 'monthly' | 'yearly' = 'monthly';
  price = 0;
  renewalDate = '';
  contactPhone = '';
  domain = '';
  seedSampleData = true;
  modules: TenantModules = { ...defaultModules };
  loading = true;
  saving = false;
  error = '';

  constructor(
    private tenantsApi: TenantService,
    private toast: ToastService,
    private dialog: DialogService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.tenantsApi.list().subscribe({
      next: (tenants) => { this.tenants = tenants; this.loading = false; },
      error: (err) => { this.loading = false; this.error = err.error?.message || 'Unable to load customers'; },
    });
  }

  create(): void {
    if (!this.name || !this.adminName || !this.adminEmail || this.adminPassword.length < 6) {
      this.error = 'Business, administrator name/email, and a password of at least 6 characters are required';
      return;
    }
    this.saving = true;
    this.error = '';
    this.toast.beginSave();
    this.tenantsApi.create({
      name: this.name, slug: this.slug || this.name, adminName: this.adminName, adminEmail: this.adminEmail,
      adminPassword: this.adminPassword, plan: this.plan, billing_cycle: this.billingCycle,
      price: this.price, renewal_date: this.renewalDate || null, contact_phone: this.contactPhone,
      domain: this.domain, modules: this.modules, seedSampleData: this.seedSampleData,
    }).subscribe({
      next: (tenant) => {
        this.tenants = [tenant, ...this.tenants];
        this.saving = false;
        this.name = ''; this.slug = ''; this.adminName = ''; this.adminEmail = ''; this.adminPassword = '';
        this.contactPhone = ''; this.domain = ''; this.price = 0; this.renewalDate = '';
        this.modules = { ...defaultModules };
        this.toast.success(`${tenant.name} created with its administrator account`);
      },
      error: (err) => { this.saving = false; this.error = err.error?.message || 'Could not create customer'; this.toast.error(this.error); },
    });
  }

  updateStatus(tenant: Tenant, status: Tenant['status']): void {
    this.saveTenant(tenant, { status }, `Customer ${status}`);
  }

  saveTenant(tenant: Tenant, patch: Partial<Tenant>, message = 'Customer configuration saved'): void {
    this.toast.beginSave();
    this.tenantsApi.update(tenant.id, patch).subscribe({
      next: (saved) => {
        this.tenants = this.tenants.map((item) => item.id === saved.id ? saved : item);
        this.toast.success(message);
      },
      error: (err) => { this.error = err.error?.message || 'Could not save customer configuration'; this.toast.error(this.error); },
    });
  }

  async resetPassword(tenant: Tenant): Promise<void> {
    const password = await this.dialog.prompt(
      `Set a new password for ${tenant.name}'s administrator.`,
      'Reset admin password',
      { type: 'password', placeholder: 'At least 6 characters' }
    );
    if (!password) return;
    if (password.length < 6) {
      this.toast.error('Password must be at least 6 characters');
      return;
    }
    this.toast.beginSave();
    this.tenantsApi.resetAdminPassword(tenant.id, password).subscribe({
      next: (res) => this.toast.success(res.message),
      error: (err) => { this.error = err.error?.message || 'Could not reset password'; this.toast.error(this.error); },
    });
  }

  exportBackup(tenant: Tenant): void {
    this.tenantsApi.exportBackup(tenant.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = `${tenant.slug}-backup.json`; anchor.click();
        URL.revokeObjectURL(url);
        this.toast.success(`${tenant.name} backup downloaded`);
      },
      error: () => this.toast.error('Could not export backup'),
    });
  }

  async archive(tenant: Tenant): Promise<void> {
    const confirmation = await this.dialog.prompt(
      `Type "${tenant.name}" to archive this customer.`,
      'Archive customer',
      { placeholder: tenant.name, danger: true }
    );
    if (confirmation == null) return;
    if (confirmation !== tenant.name) {
      this.toast.error('Customer name did not match. Nothing was archived.');
      return;
    }
    this.tenantsApi.archive(tenant.id, confirmation).subscribe({
      next: (res) => { this.toast.success(res.message); this.load(); },
      error: (err) => this.toast.error(err.error?.message || 'Could not archive customer'),
    });
  }

  async remove(tenant: Tenant): Promise<void> {
    const confirmation = await this.dialog.prompt(
      `Delete "${tenant.name}" permanently? Type the customer name to confirm.`,
      'Delete customer',
      { placeholder: tenant.name, danger: true }
    );
    if (confirmation == null) return;
    if (confirmation !== tenant.name) {
      this.toast.error('Customer name did not match. Nothing was deleted.');
      return;
    }
    this.tenantsApi.remove(tenant.id, confirmation).subscribe({
      next: (res) => { this.toast.success(res.message); this.load(); },
      error: (err) => this.toast.error(err.error?.message || 'Could not delete customer'),
    });
  }
}
