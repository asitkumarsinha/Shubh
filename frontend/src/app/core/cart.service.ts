import { Injectable, signal, computed } from '@angular/core';
import { CartItem, Medicine } from './models';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly key = 'medishop_cart';
  readonly items = signal<CartItem[]>(this.load());

  readonly count = computed(() => this.items().reduce((s, i) => s + i.quantity, 0));
  readonly total = computed(() =>
    this.items().reduce((s, i) => s + i.price * i.quantity, 0)
  );

  add(medicine: Medicine, quantity = 1): void {
    const current = [...this.items()];
    const idx = current.findIndex((i) => i.medicineId === medicine.id);
    if (idx >= 0) {
      const nextQty = current[idx].quantity + quantity;
      if (nextQty > medicine.stock) {
        throw new Error(`Only ${medicine.stock} units available`);
      }
      current[idx] = { ...current[idx], quantity: nextQty, stock: medicine.stock };
    } else {
      if (quantity > medicine.stock) {
        throw new Error(`Only ${medicine.stock} units available`);
      }
      current.push({
        medicineId: medicine.id,
        name: medicine.name,
        price: medicine.price,
        image: medicine.image,
        quantity,
        stock: medicine.stock,
      });
    }
    this.save(current);
  }

  updateQty(medicineId: number, quantity: number): void {
    const current = this.items()
      .map((i) => {
        if (i.medicineId !== medicineId) return i;
        const qty = Math.max(1, Math.min(quantity, i.stock));
        return { ...i, quantity: qty };
      });
    this.save(current);
  }

  remove(medicineId: number): void {
    this.save(this.items().filter((i) => i.medicineId !== medicineId));
  }

  clear(): void {
    this.save([]);
  }

  private save(items: CartItem[]): void {
    this.items.set(items);
    localStorage.setItem(this.key, JSON.stringify(items));
  }

  private load(): CartItem[] {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]') as CartItem[];
    } catch {
      return [];
    }
  }
}
