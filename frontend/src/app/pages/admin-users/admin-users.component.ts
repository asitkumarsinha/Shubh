import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../../core/user.service';
import { AdminUserDetail, AdminUsersResponse } from '../../core/models';
import { ToastService } from '../../core/toast.service';

type AccessStatus = 'allowed' | 'blocked';
type ClientGroup = 'retail' | 'wholesale';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  users: AdminUserDetail[] = [];
  topUsers: AdminUserDetail[] = [];
  summary: AdminUsersResponse['summary'] | null = null;
  error = '';
  loading = true;
  updatingId: number | null = null;
  exporting = false;

  readonly accessOptions: Array<{ value: AccessStatus; label: string }> = [
    { value: 'allowed', label: 'Allow' },
    { value: 'blocked', label: 'Block' },
  ];

  readonly groupOptions: Array<{ value: ClientGroup; label: string }> = [
    { value: 'retail', label: 'Retail' },
    { value: 'wholesale', label: 'Wholesale' },
  ];

  constructor(private userService: UserService, private toast: ToastService) {}

  ngOnInit(): void {
    this.reload(true);
  }

  clients(): AdminUserDetail[] {
    return this.users.filter((u) => u.role === 'user');
  }

  reload(showSpinner = false): void {
    if (showSpinner) this.loading = true;
    this.userService.all().subscribe({
      next: (res) => {
        this.users = res.users;
        this.topUsers = res.topUsers;
        this.summary = res.summary;
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load clients';
        this.loading = false;
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

  onGroupChange(user: AdminUserDetail, group: ClientGroup): void {
    if (!group || group === user.client_group) return;
    this.updatingId = user.id;
    this.error = '';
    this.toast.beginSave();
    this.userService.update(user.id, { client_group: group }).subscribe({
      next: () => {
        this.updatingId = null;
        this.toast.success(`${user.name} set to ${group}`);
        this.reload();
      },
      error: (err) => {
        this.updatingId = null;
        const msg = err.error?.message || 'Failed to update group';
        this.error = msg;
        this.toast.error(msg);
        this.reload();
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
