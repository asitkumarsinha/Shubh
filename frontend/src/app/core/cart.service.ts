import { Injectable, signal, computed, effect, untracked } from '@angular/core';
import { CartItem, Medicine } from './models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>([]);

  readonly count = computed(() => this.items().reduce((s, i) => s + i.quantity, 0));
  readonly total = computed(() =>
    this.items().reduce((s, i) => s + i.price * i.quantity, 0)
  );

  constructor(private auth: AuthService) {
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => this.items.set(this.read(userId)));
    });
  }

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
    localStorage.setItem(this.storageKey(this.auth.user()?.id ?? null), JSON.stringify(items));
  }

  /** Each signed-in client keeps a separate cart. A guest cart is never shared. */
  private storageKey(userId: number | null): string {
    return userId == null ? 'medishop_cart_guest' : `medishop_cart_user_${userId}`;
  }

  private read(userId: number | null): CartItem[] {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey(userId)) || '[]') as CartItem[];
    } catch {
      return [];
    }
  }
}
