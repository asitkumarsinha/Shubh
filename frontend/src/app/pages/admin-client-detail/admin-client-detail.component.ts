import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UserService } from '../../core/user.service';
import { AdminClientDetail, AdminUserDetail } from '../../core/models';
import { SavePhase, ToastService, saveButtonLabel } from '../../core/toast.service';

@Component({
  selector: 'app-admin-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-client-detail.component.html',
  styleUrl: './admin-client-detail.component.scss',
})
export class AdminClientDetailComponent implements OnInit {
  data: AdminClientDetail | null = null;
  notes = '';
  group: 'retail' | 'wholesale' = 'retail';
  password = '';
  showPassword = true;
  loading = true;
  saving = false;
  savePhase: SavePhase = 'idle';
  error = '';
  readonly saveButtonLabel = saveButtonLabel;

  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error = 'Invalid client';
      this.loading = false;
      return;
    }
    this.userService.get(id).subscribe({
      next: (data) => {
        this.data = data;
        this.notes = data.client.notes || '';
        this.group = data.client.client_group;
        this.loading = false;
      },
      error: () => {
        this.error = 'Unable to load client';
        this.loading = false;
      },
    });
  }

  get client(): AdminUserDetail | null {
    return this.data?.client || null;
  }

  save(): void {
    if (!this.client) return;
    if (this.password && this.password.length < 6) {
      this.error = 'Password must be at least 6 characters';
      this.toast.error(this.error);
      return;
    }
    this.saving = true;
    this.savePhase = 'saving';
    this.error = '';
    this.toast.beginSave();
    this.userService
      .update(this.client.id, {
        notes: this.notes,
        client_group: this.group,
        password: this.password || undefined,
      })
      .subscribe({
      next: (updated) => {
        this.saving = false;
        this.savePhase = 'saved';
        if (this.data) this.data = { ...this.data, client: { ...updated, password: this.password || updated.password } };
        const msg = this.password ? 'Client and password updated' : 'Client updated';
        this.toast.success(msg);
        setTimeout(() => (this.savePhase = 'idle'), 2500);
      },
      error: (err) => {
        this.saving = false;
        this.savePhase = 'failed';
        const msg = err.error?.message || 'Save failed';
        this.error = msg;
        this.toast.error(msg);
        setTimeout(() => (this.savePhase = 'idle'), 2500);
      },
    });
  }
}
