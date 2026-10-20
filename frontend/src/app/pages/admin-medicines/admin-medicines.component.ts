import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MedicineService } from '../../core/medicine.service';
import { Medicine } from '../../core/models';
import { SavePhase, ToastService, saveButtonLabel } from '../../core/toast.service';
import { DialogService } from '../../core/dialog.service';

@Component({
  selector: 'app-admin-medicines',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-medicines.component.html',
  styleUrl: './admin-medicines.component.scss',
})
export class AdminMedicinesComponent implements OnInit {
  medicines: Medicine[] = [];
  name = '';
  description = '';
  price: number | null = null;
  wholesalePrice: number | null = null;
  stock: number | null = 0;
  category = '';
  file: File | null = null;
  sheet: File | null = null;
  importing = false;
  editingId: number | null = null;
  error = '';
  loading = false;
  query = '';
  page = 1;
  pages = 1;
  total = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  savePhase: SavePhase = 'idle';
  readonly saveButtonLabel = saveButtonLabel;

  constructor(
    private medicineService: MedicineService,
    private toast: ToastService,
    private dialog: DialogService
  ) {}

  ngOnInit(): void {
    this.reload();
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

  reload(): void {
    this.medicineService.list({ q: this.query.trim(), page: this.page, limit: 10 }).subscribe({
      next: (data) => {
        this.medicines = data.items;
        this.total = data.total;
        this.pages = data.pages;
        this.page = data.page;
      },
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] || null;
  }

  onSheet(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.sheet = input.files?.[0] || null;
  }

  importSheet(): void {
    if (!this.sheet) return;
    this.importing = true;
    this.error = '';
    this.medicineService.importCsv(this.sheet).subscribe({
      next: (result) => {
        this.importing = false;
        this.sheet = null;
        this.toast.success(`${result.created} products added`);
        this.reload();
      },
      error: (err) => {
        this.importing = false;
        this.error = err.error?.message || 'Could not read the spreadsheet';
        this.toast.error(this.error);
      },
    });
  }

  resetForm(): void {
    this.name = '';
    this.description = '';
    this.price = null;
    this.stock = 0;
    this.category = '';
    this.wholesalePrice = null;
    this.file = null;
    this.editingId = null;
  }

  edit(m: Medicine): void {
    this.editingId = m.id;
    this.name = m.name;
    this.description = m.description;
    this.price = m.price;
    this.stock = m.stock;
    this.category = m.category || '';
    this.wholesalePrice = m.wholesale_price ?? null;
    this.file = null;
  }

  save(): void {
    if (!this.name || this.price === null) {
      this.error = 'Name and price are required';
      this.toast.error(this.error);
      return;
    }
    const form = new FormData();
    form.append('name', this.name);
    form.append('description', this.description || '');
    form.append('price', String(this.price));
    form.append('stock', String(this.stock ?? 0));
    form.append('category', this.category || '');
    if (this.wholesalePrice != null && this.wholesalePrice !== ('' as unknown as number)) {
      form.append('wholesale_price', String(this.wholesalePrice));
    }
    if (this.file) form.append('image', this.file);

    this.loading = true;
    this.savePhase = 'saving';
    this.error = '';
    this.toast.beginSave();
    const req =
      this.editingId === null
        ? this.medicineService.create(form)
        : this.medicineService.update(this.editingId, form);

    req.subscribe({
      next: () => {
        this.loading = false;
        this.savePhase = 'saved';
        const msg = this.editingId ? 'Product updated' : 'Product uploaded';
        this.toast.success(msg);
        this.resetForm();
        this.reload();
        setTimeout(() => (this.savePhase = 'idle'), 2500);
      },
      error: (err) => {
        this.loading = false;
        this.savePhase = 'failed';
        const msg = err.error?.message || 'Save failed';
        this.error = msg;
        this.toast.error(msg);
        setTimeout(() => (this.savePhase = 'idle'), 2500);
      },
    });
  }

  async remove(m: Medicine): Promise<void> {
    const confirmed = await this.dialog.confirm(`Delete ${m.name}? This cannot be undone.`, 'Delete product');
    if (!confirmed) return;
    this.toast.beginSave();
    this.medicineService.remove(m.id).subscribe({
      next: () => {
        this.toast.success(`${m.name} deleted`);
        this.reload();
      },
      error: (err) => {
        const msg = err.error?.message || 'Delete failed';
        this.error = msg;
        this.toast.error(msg);
      },
    });
  }

  imageUrl(m: Medicine): string {
    return m.image || 'assets/medicines/default.svg';
  }
}
