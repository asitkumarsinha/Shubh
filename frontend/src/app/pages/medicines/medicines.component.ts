import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MedicineService } from '../../core/medicine.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { Medicine } from '../../core/models';
import { apiErrorMessage } from '../../core/api-error';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-medicines',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './medicines.component.html',
  styleUrl: './medicines.component.scss',
})
export class MedicinesComponent implements OnInit {
  medicines: Medicine[] = [];
  loading = true;
  error = '';
  query = '';
  page = 1;
  pages = 1;
  total = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private medicineService: MedicineService,
    public cart: CartService,
    public auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.load();
    }, 300);
  }

  goTo(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) return;
    this.page = page;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.medicineService.list({ q: this.query.trim(), page: this.page, limit: 12 }).subscribe({
      next: (data) => {
        this.medicines = data.items;
        this.total = data.total;
        this.pages = data.pages;
        this.page = data.page;
        this.loading = false;
      },
      error: (err) => {
        this.error = apiErrorMessage(err, 'Unable to load products');
        this.loading = false;
      },
    });
  }

  imageUrl(m: Medicine): string {
    return m.image || 'assets/medicines/default.svg';
  }

  addToCart(m: Medicine): void {
    if (!this.auth.isLoggedIn()) {
      this.toast.error('Please login as a user to add products to cart');
      this.error = 'Please login as a user to add products to cart';
      return;
    }
    if (this.auth.isAdmin()) {
      this.error = 'Admin cannot purchase. Switch to a user account.';
      this.toast.error(this.error);
      return;
    }
    try {
      this.cart.add(m, 1);
      this.error = '';
      this.toast.success(`${m.name} added to cart`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add to cart';
      this.error = msg;
      this.toast.error(msg);
    }
  }
}
