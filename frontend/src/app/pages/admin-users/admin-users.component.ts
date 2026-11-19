import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../core/user.service';
import { AdminUserDetail } from '../../core/models';
import { GridSection } from '../../core/grid-export';
import { ToastService } from '../../core/toast.service';
import { DialogService } from '../../core/dialog.service';
import { GridActionsComponent } from '../../shared/grid-actions/grid-actions.component';

type AccessStatus = 'allowed' | 'blocked';
type ClientGroup = 'retail' | 'wholesale';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GridActionsComponent],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  users: AdminUserDetail[] = [];
  error = '';
  loading = true;
  updatingId: number | null = null;
  exporting = false;
  importing = false;
  deletingId: number | null = null;
  deletingAll = false;
  creating = false;
  adding = false;
  newName = '';
  newEmail = '';
  newPassword = '';
  newPhone = '';
  newAddress = '';
  newGroup: ClientGroup = 'retail';
  query = '';
  page = 1;
  pages = 1;
  total = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly accessOptions: Array<{ value: AccessStatus; label: string }> = [
    { value: 'allowed', label: 'Allow' },
    { value: 'blocked', label: 'Block' },
  ];

  readonly groupOptions: Array<{ value: ClientGroup; label: string }> = [
    { value: 'retail', label: 'Retail' },
    { value: 'wholesale', label: 'Wholesale' },
  ];

  constructor(
    private userService: UserService,
    private toast: ToastService,
    private dialog: DialogService
  ) {}

  ngOnInit(): void {
    this.reload(true);
  }

  clients(): AdminUserDetail[] {
    return this.users.filter((u) => u.role === 'user');
  }

  get gridSections(): GridSection[] {
    return [{
      title: 'Stores',
      headers: ['Store', 'Email', 'Phone', 'Orders', 'Access'],
      rows: this.clients().map((store) => [
        store.name,
        store.email,
        store.phone || '',
        String(store.orderCount),
        store.status,
      ]),
    }];
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.reload();
    }, 300);
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) return;
    this.page = page;
    this.reload();
  }

  reload(showSpinner = false): void {
    if (showSpinner) this.loading = true;
    this.userService.all({ q: this.query.trim(), page: this.page, limit: 20 }).subscribe({
      next: (res) => {
        this.users = res.users;
        this.total = res.total;
        this.pages = res.pages;
        this.page = res.page;
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load clients';
        this.loading = false;
      },
    });
  }

  addClient(): void {
    if (!this.newName.trim() || !this.newEmail.trim() || this.newPassword.length < 6) {
      this.error = 'Name, email, and a password of at least 6 characters are required';
      this.toast.error(this.error);
      return;
    }
    this.creating = true;
    this.error = '';
    this.toast.beginSave();
    this.userService
      .create({
        name: this.newName.trim(),
        email: this.newEmail.trim(),
        password: this.newPassword,
        phone: this.newPhone.trim(),
        address: this.newAddress.trim(),
        client_group: this.newGroup,
      })
      .subscribe({
        next: (created) => {
          this.creating = false;
          this.newName = '';
          this.newEmail = '';
          this.newPassword = '';
          this.newPhone = '';
          this.newAddress = '';
          this.newGroup = 'retail';
          this.adding = false;
          this.toast.success(`${created.name} added`);
          this.reload();
        },
        error: (err) => {
          this.creating = false;
          const msg = err.error?.message || 'Could not add client';
          this.error = msg;
          this.toast.error(msg);
        },
      });
  }

  onStatusChange(user: AdminUserDetail, status: AccessStatus): void {
    if (!status || status === user.status) return;
    this.updatingId = user.id;
    this.error = '';
    this.toast.beginSave();
    this.userService.setStatus(user.id, status).subscribe({
      next: () => {
        this.updatingId = null;
        this.toast.success(
          status === 'blocked' ? `${user.name} is blocked` : `${user.name} is allowed`
        );
        this.reload();
      },
      error: (err) => {
        this.updatingId = null;
        const msg = err.error?.message || 'Failed to update access';
        this.error = msg;
        this.toast.error(msg);
        this.reload();
      },
    });
  }

  async removeAllStores(): Promise<void> {
    const confirmed = await this.dialog.confirm(
      'Delete all stores? Stores that have orders or created products will be kept. This cannot be undone.',
      'Delete all stores'
    );
    if (!confirmed) return;
    this.deletingAll = true;
    this.error = '';
    this.toast.beginSave();
    this.userService.removeAll().subscribe({
      next: (result) => {
        this.deletingAll = false;
        this.toast.success(result.message);
        if (result.kept) this.error = `${result.kept} ${result.kept === 1 ? 'store' : 'stores'} kept because in use.`;
        this.reload(true);
      },
      error: (err) => {
        this.deletingAll = false;
        const msg = err.error?.message || 'Could not delete stores';
        this.error = msg;
        this.toast.error(msg);
      },
    });
  }

  async removeStore(store: AdminUserDetail): Promise<void> {
    const confirmed = await this.dialog.confirm(
      `Delete ${store.name}? This cannot be undone.`,
      'Delete store'
    );
    if (!confirmed) return;
    this.deletingId = store.id;
    this.error = '';
    this.toast.beginSave();
    this.userService.remove(store.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.toast.success(`${store.name} deleted`);
        this.reload(true);
      },
      error: (err) => {
        this.deletingId = null;
        const msg = err.error?.message || 'Could not delete store';
        this.error = msg;
        this.toast.error(msg);
      },
    });
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importing = true;
    this.error = '';
    this.toast.beginSave();
    this.userService.importStores(file).subscribe({
      next: (result) => {
        this.importing = false;
        const added = `${result.created} ${result.created === 1 ? 'store' : 'stores'} added`;
        const skipped = result.skipped ? `, ${result.skipped} skipped` : '';
        this.toast.success(`${added}${skipped}`);
        if (result.reasons.length) this.error = result.reasons.join(' · ');
        this.reload(true);
      },
      error: (err) => {
        this.importing = false;
        const msg = err.error?.message || 'Could not import stores';
        this.error = msg;
        this.toast.error(msg);
      },
    });
  }

  exportList(): void {
    this.exporting = true;
    this.error = '';
    this.toast.beginSave();
    this.userService.exportCsv().subscribe({
      next: (blob) => {
        this.exporting = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.success('Client list downloaded');
      },
      error: () => {
        this.exporting = false;
        const msg = 'Unable to export client list';
        this.error = msg;
        this.toast.error(msg);
      },
    });
  }
}
