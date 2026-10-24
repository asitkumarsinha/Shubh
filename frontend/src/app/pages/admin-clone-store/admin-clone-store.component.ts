import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/user.service';
import { AdminUserDetail } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-admin-clone-store',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-clone-store.component.html',
  styleUrl: './admin-clone-store.component.scss',
})
export class AdminCloneStoreComponent implements OnInit {
  stores: AdminUserDetail[] = [];
  sourceId: number | null = null;
  name = '';
  loading = true;
  saving = false;
  error = '';

  constructor(private users: UserService, private toast: ToastService) {}

  ngOnInit(): void {
    this.users.all({ limit: 50 }).subscribe({
      next: (res) => {
        this.stores = res.users.filter((user) => user.role === 'user');
        this.sourceId = this.stores[0]?.id ?? null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Unable to load stores';
      },
    });
  }

  clone(): void {
    const name = this.name.trim();
    if (!this.sourceId || !name) {
      this.error = 'Choose a store and a unique name';
      this.toast.error(this.error);
      return;
    }
    const duplicate = this.stores.some((store) => store.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      this.error = 'A store with this name already exists. Choose a unique name.';
      this.toast.error(this.error);
      return;
    }
    this.saving = true;
    this.error = '';
    this.toast.beginSave();
    this.users.clone(this.sourceId, name).subscribe({
      next: (created) => {
        this.saving = false;
        this.stores = [...this.stores, created].sort((a, b) => a.name.localeCompare(b.name));
        this.name = '';
        this.toast.success(`${created.name} cloned. Sign-in email: ${created.email}`);
      },
      error: (err) => {
        this.saving = false;
        const msg = err.error?.message || 'Could not clone the store';
        this.error = msg;
        this.toast.error(msg);
      },
    });
  }
}
