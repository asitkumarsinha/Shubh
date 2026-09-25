import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../core/settings.service';
import { ToastService } from '../../core/toast.service';

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
  logo: File | null = null;
  qrCode: File | null = null;
  saving = false;
  message = '';
  error = '';

  constructor(public settings: SettingsService, private toast: ToastService) {}

  ngOnInit(): void {
    const value = this.settings.current();
    this.title = value.title;
    this.slogan = value.slogan;
    this.settings.load();
    setTimeout(() => {
      const updated = this.settings.current();
      this.title = updated.title;
      this.slogan = updated.slogan;
    }, 300);
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
    if (this.logo) form.append('logo', this.logo);
    if (this.qrCode) form.append('qrCode', this.qrCode);

    this.saving = true;
    this.error = '';
    this.toast.beginSave();
    this.settings.update(form).subscribe({
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
