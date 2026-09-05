import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/user.service';
import { AdminUserDetail, AdminUsersResponse } from '../../core/models';

type AccessStatus = 'allowed' | 'blocked';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  users: AdminUserDetail[] = [];
  topUsers: AdminUserDetail[] = [];
  summary: AdminUsersResponse['summary'] | null = null;
  error = '';
  message = '';
  loading = true;
  updatingId: number | null = null;

  readonly accessOptions: Array<{ value: AccessStatus; label: string }> = [
    { value: 'allowed', label: 'Allow' },
    { value: 'blocked', label: 'Block' },
  ];

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.reload(true);
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
        this.error = 'Unable to load user details';
        this.loading = false;
      },
    });
  }

  onStatusChange(user: AdminUserDetail, status: AccessStatus): void {
    if (!status || status === user.status) return;
    this.updatingId = user.id;
    this.error = '';
    this.message = '';
    this.userService.setStatus(user.id, status).subscribe({
      next: () => {
        this.updatingId = null;
        this.message =
          status === 'blocked'
            ? `${user.name} is blocked`
            : `${user.name} is allowed`;
        this.reload();
      },
      error: (err) => {
        this.updatingId = null;
        this.error = err.error?.message || 'Failed to update user status';
        this.reload();
      },
    });
  }
}
