import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MedicineService } from '../../core/medicine.service';
import { GridSection, inr } from '../../core/grid-export';
import { GridActionsComponent } from '../../shared/grid-actions/grid-actions.component';
import { Medicine } from '../../core/models';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-admin-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GridActionsComponent],
  templateUrl: './admin-product-list.component.html',
  styleUrl: './admin-product-list.component.scss',
})
export class AdminProductListComponent implements OnInit {
  medicines: Medicine[] = [];
  categories: string[] = [];
  query = '';
  category = '';
  page = 1;
  pages = 1;
  total = 0;
  loading = true;
  error = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  get gridSections(): GridSection[] {
    return [{
      title: 'Products',
      headers: ['Product', 'Description', 'Group', 'Price', 'Stock'],
      rows: this.medicines.map((medicine) => [
        medicine.name,
        medicine.description || '',
        medicine.category || '',
        inr(medicine.listPrice || medicine.price),
        String(medicine.stock),
      ]),
    }];
  }

  constructor(
    private medicinesApi: MedicineService,
    private dialog: DialogService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.medicinesApi.categories().subscribe({
      next: (categories) => (this.categories = categories),
      error: () => (this.categories = []),
    });
    this.reload();
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.reload();
    }, 300);
  }

  onCategory(value: string): void {
    this.category = value;
    this.page = 1;
    this.reload();
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) return;
    this.page = page;
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.medicinesApi
      .list({ q: this.query.trim(), category: this.category, page: this.page, limit: 12 })
      .subscribe({
        next: (data) => {
          this.medicines = data.items;
          this.total = data.total;
          this.pages = data.pages;
          this.page = data.page;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error = 'Could not load products';
        },
      });
  }

  imageUrl(medicine: Medicine): string {
    return medicine.image || 'assets/medicines/default.svg';
  }

  async remove(medicine: Medicine): Promise<void> {
    const confirmed = await this.dialog.confirm(`Delete ${medicine.name}? This cannot be undone.`, 'Delete product');
    if (!confirmed) return;
    this.medicinesApi.remove(medicine.id).subscribe({
      next: () => {
        this.toast.success(`${medicine.name} deleted`);
        this.reload();
      },
      error: (err) => this.toast.error(err.error?.message || 'Delete failed'),
    });
  }
}
