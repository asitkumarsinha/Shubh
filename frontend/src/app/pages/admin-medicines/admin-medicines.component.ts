import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MedicineService } from '../../core/medicine.service';
import { Medicine } from '../../core/models';
import { SavePhase, ToastService, saveButtonLabel } from '../../core/toast.service';

@Component({
  selector: 'app-admin-medicines',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-medicines.component.html',
  styleUrl: './admin-medicines.component.scss',
})
export class AdminMedicinesComponent implements OnInit {
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
  savePhase: SavePhase = 'idle';
  readonly saveButtonLabel = saveButtonLabel;

  constructor(
    private medicineService: MedicineService,
    private toast: ToastService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('id'));
    if (!id) return;
    this.medicineService.get(id).subscribe({
      next: (medicine) => this.edit(medicine),
      error: () => {
        this.error = 'Could not open that product';
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

}
