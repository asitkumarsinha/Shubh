import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MedicineService } from '../../core/medicine.service';
import { Medicine } from '../../core/models';

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
  stock: number | null = 0;
  file: File | null = null;
  editingId: number | null = null;
  message = '';
  error = '';
  loading = false;

  constructor(private medicineService: MedicineService) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.medicineService.list().subscribe({
      next: (data) => (this.medicines = data),
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] || null;
  }

  resetForm(): void {
    this.name = '';
    this.description = '';
    this.price = null;
    this.stock = 0;
    this.file = null;
    this.editingId = null;
  }

  edit(m: Medicine): void {
    this.editingId = m.id;
    this.name = m.name;
    this.description = m.description;
    this.price = m.price;
    this.stock = m.stock;
    this.file = null;
  }

  save(): void {
    if (!this.name || this.price === null) {
      this.error = 'Name and price are required';
      return;
    }
    const form = new FormData();
    form.append('name', this.name);
    form.append('description', this.description || '');
    form.append('price', String(this.price));
    form.append('stock', String(this.stock ?? 0));
    if (this.file) form.append('image', this.file);

    this.loading = true;
    this.error = '';
    const req =
      this.editingId === null
        ? this.medicineService.create(form)
        : this.medicineService.update(this.editingId, form);

    req.subscribe({
      next: () => {
        this.loading = false;
        this.message = this.editingId ? 'Medicine updated' : 'Medicine uploaded';
        this.resetForm();
        this.reload();
        setTimeout(() => (this.message = ''), 2000);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Save failed';
      },
    });
  }

  remove(m: Medicine): void {
    if (!confirm(`Delete ${m.name}?`)) return;
    this.medicineService.remove(m.id).subscribe({
      next: () => this.reload(),
      error: (err) => (this.error = err.error?.message || 'Delete failed'),
    });
  }

  imageUrl(m: Medicine): string {
    return m.image || 'assets/medicine-placeholder.svg';
  }
}
