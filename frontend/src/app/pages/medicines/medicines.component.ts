import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MedicineService } from '../../core/medicine.service';
import { CartService } from '../../core/cart.service';
import { AuthService } from '../../core/auth.service';
import { Medicine } from '../../core/models';
import { apiErrorMessage } from '../../core/api-error';

@Component({
  selector: 'app-medicines',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './medicines.component.html',
  styleUrl: './medicines.component.scss',
})
export class MedicinesComponent implements OnInit {
  medicines: Medicine[] = [];
  loading = true;
  message = '';
  error = '';

  constructor(
    private medicineService: MedicineService,
    public cart: CartService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.medicineService.list().subscribe({
      next: (data) => {
        this.medicines = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = apiErrorMessage(err, 'Unable to load medicines');
        this.loading = false;
      },
    });
  }

  imageUrl(m: Medicine): string {
    return m.image || 'assets/medicines/default.svg';
  }

  addToCart(m: Medicine): void {
    if (!this.auth.isLoggedIn()) {
      this.error = 'Please login as a user to add medicines to cart';
      return;
    }
    if (this.auth.isAdmin()) {
      this.error = 'Admin cannot purchase. Switch to a user account.';
      return;
    }
    try {
      this.cart.add(m, 1);
      this.message = `${m.name} added to cart`;
      this.error = '';
      setTimeout(() => (this.message = ''), 2000);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not add to cart';
    }
  }
}
