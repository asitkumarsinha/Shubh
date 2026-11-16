import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../core/settings.service';
import { ToastService } from '../../core/toast.service';
import { Tenant } from '../../core/models';
import { TenantService } from '../../core/tenant.service';
import { PublicSiteService, SiteActivity } from '../../core/public-site.service';
import { SuperAdminShellComponent } from '../../shared/super-admin-shell/super-admin-shell.component';

type HitColumnId =
  | 'country'
  | 'region'
  | 'city'
  | 'when'
  | 'event'
  | 'who'
  | 'email'
  | 'role'
  | 'ip'
  | 'hostname'
  | 'asn'
  | 'isp'
  | 'services'
  | 'latitude'
  | 'longitude'
  | 'browser'
  | 'page'
  | 'detail';

interface HitColumn {
  id: HitColumnId;
  label: string;
  visible: boolean;
  filter: string;
}

@Component({
  selector: 'app-super-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, SuperAdminShellComponent],
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
  hitsOpen = false;
  hitsLoading = false;
  hitsError = '';
  activity: SiteActivity[] = [];
  previewLogo = '';
  previewQr = '';
  draggingColumn: HitColumnId | null = null;
  dragOverColumn: HitColumnId | null = null;
  hitColumns: HitColumn[] = [
    { id: 'country', label: 'Country', visible: true, filter: '' },
    { id: 'region', label: 'State/Region', visible: true, filter: '' },
    { id: 'city', label: 'City', visible: true, filter: '' },
    { id: 'when', label: 'When', visible: true, filter: '' },
    { id: 'event', label: 'Event', visible: true, filter: '' },
    { id: 'who', label: 'Who', visible: true, filter: '' },
    { id: 'email', label: 'Email', visible: true, filter: '' },
    { id: 'role', label: 'Role', visible: true, filter: '' },
    { id: 'ip', label: 'IP address', visible: true, filter: '' },
    { id: 'hostname', label: 'Hostname', visible: true, filter: '' },
    { id: 'asn', label: 'ASN', visible: true, filter: '' },
    { id: 'isp', label: 'ISP', visible: true, filter: '' },
    { id: 'services', label: 'Services', visible: true, filter: '' },
    { id: 'latitude', label: 'Latitude', visible: true, filter: '' },
    { id: 'longitude', label: 'Longitude', visible: true, filter: '' },
    { id: 'browser', label: 'Browser', visible: true, filter: '' },
    { id: 'page', label: 'Page', visible: true, filter: '' },
    { id: 'detail', label: 'Detail', visible: true, filter: '' },
  ];

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

  openHits(): void {
    this.hitsOpen = true;
    this.hitsLoading = true;
    this.hitsError = '';
    this.publicSite.hitDetails().subscribe({
      next: (rows) => {
        this.activity = rows;
        this.hitsLoading = false;
      },
      error: (err) => {
        this.hitsLoading = false;
        this.hitsError = err.error?.message || 'Could not load website hit details';
      },
    });
  }

  closeHits(): void {
    this.hitsOpen = false;
    this.draggingColumn = null;
    this.dragOverColumn = null;
  }

  get visibleColumns(): HitColumn[] {
    return this.hitColumns.filter((column) => column.visible);
  }

  get filteredActivity(): SiteActivity[] {
    const filters = this.hitColumns.filter((column) => column.visible && column.filter.trim());
    if (!filters.length) return this.activity;
    return this.activity.filter((row) =>
      filters.every((column) =>
        this.cellText(row, column.id).toLowerCase().includes(column.filter.trim().toLowerCase())
      )
    );
  }

  get hasColumnFilter(): boolean {
    return this.hitColumns.some((column) => column.filter.trim());
  }

  hideColumn(column: HitColumn): void {
    column.visible = false;
  }

  clearFilters(): void {
    for (const column of this.hitColumns) column.filter = '';
  }

  onColumnDragStart(id: HitColumnId, event: DragEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, button')) {
      event.preventDefault();
      return;
    }
    this.draggingColumn = id;
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onColumnDragOver(id: HitColumnId, event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverColumn = id;
  }

  onColumnDrop(targetId: HitColumnId, event: DragEvent): void {
    event.preventDefault();
    const fromId = this.draggingColumn;
    this.draggingColumn = null;
    this.dragOverColumn = null;
    if (!fromId || fromId === targetId) return;
    const moving = this.hitColumns.find((column) => column.id === fromId);
    if (!moving) return;
    const rest = this.hitColumns.filter((column) => column.id !== fromId);
    const targetIndex = rest.findIndex((column) => column.id === targetId);
    if (targetIndex < 0) return;
    this.hitColumns = [...rest.slice(0, targetIndex), moving, ...rest.slice(targetIndex)];
  }

  onColumnDragEnd(): void {
    this.draggingColumn = null;
    this.dragOverColumn = null;
  }

  cellText(row: SiteActivity, id: HitColumnId): string {
    switch (id) {
      case 'country': return row.country || '—';
      case 'region': return row.region || '—';
      case 'city': return row.city || '—';
      case 'when': return row.created_at || '—';
      case 'event': return this.eventLabel(row);
      case 'who': return row.name || '—';
      case 'email': return row.email || '—';
      case 'role': return this.roleLabel(row.role);
      case 'ip': return row.ip || '—';
      case 'hostname': return row.hostname || '—';
      case 'asn': return row.asn || '—';
      case 'isp': return row.isp || '—';
      case 'services': return row.services || '—';
      case 'latitude': return row.latitude || '—';
      case 'longitude': return row.longitude || '—';
      case 'browser': return this.browserLabel(row.user_agent);
      case 'page': return row.path || '—';
      case 'detail': return row.detail || '—';
    }
  }

  eventLabel(row: SiteActivity): string {
    if (row.outcome === 'success') return 'Success';
    if (row.outcome === 'failure') return 'Failure';
    if (row.outcome === 'error') return 'Error';
    if (row.kind === 'login') return 'Login';
    if (row.kind === 'page') return 'Page';
    return 'Visit';
  }

  roleLabel(role: string): string {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Customer';
    if (role === 'user') return 'Client';
    return 'Guest';
  }

  browserLabel(agent: string): string {
    if (/Edg\//.test(agent)) return 'Microsoft Edge';
    if (/Chrome\//.test(agent)) return 'Chrome';
    if (/Firefox\//.test(agent)) return 'Firefox';
    if (/Safari\//.test(agent)) return 'Safari';
    return agent ? 'Other browser' : '—';
  }

  loadCustomerSettings(): void {
    this.error = '';
    this.settings.getForTenant(this.selectedTenantId).subscribe({
      next: (value) => {
        this.title = value.title;
        this.slogan = value.slogan;
        this.themeColor = value.theme_color;
        this.fontFamily = value.font_family;
        this.loginInitial = value.login_initial || '';
        this.previewLogo = value.logo;
        this.previewQr = value.qr_code;
      },
      error: (err) => this.error = err.error?.message || 'Could not load customer settings',
    });
  }

  get themeContrastWarning(): string {
    const ratio = contrastRatio(this.themeColor, '#ffffff');
    if (ratio >= 3) return '';
    return `White text on ${this.themeColor} is hard to read (${ratio.toFixed(1)}:1). Choose a darker colour.`;
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
        this.previewLogo = saved.logo;
        this.previewQr = saved.qr_code;
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

function channel(hex: string, start: number): number {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(foreground: string, background: string): number {
  const colors = [foreground, background].map((hex) => {
    const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
    return 0.2126 * channel(normalized, 1) + 0.7152 * channel(normalized, 3) + 0.0722 * channel(normalized, 5);
  });
  const lighter = Math.max(...colors);
  const darker = Math.min(...colors);
  return (lighter + 0.05) / (darker + 0.05);
}
