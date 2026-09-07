import { Routes } from '@angular/router';
import { authGuard, adminGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'medicines' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'medicines',
    loadComponent: () =>
      import('./pages/medicines/medicines.component').then((m) => m.MedicinesComponent),
  },
  {
    path: 'cart',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/my-orders/my-orders.component').then((m) => m.MyOrdersComponent),
  },
  {
    path: 'orders/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/order-detail/order-detail.component').then((m) => m.OrderDetailComponent),
  },
  {
    path: 'admin/medicines',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin-medicines/admin-medicines.component').then(
        (m) => m.AdminMedicinesComponent
      ),
  },
  {
    path: 'admin/orders',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin-orders/admin-orders.component').then((m) => m.AdminOrdersComponent),
  },
  {
    path: 'admin/users',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin-users/admin-users.component').then((m) => m.AdminUsersComponent),
  },
  {
    path: 'admin/employees',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin-employees/admin-employees.component').then(
        (m) => m.AdminEmployeesComponent
      ),
  },
  {
    path: 'admin/reports',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin-reports/admin-reports.component').then((m) => m.AdminReportsComponent),
  },
  { path: '**', redirectTo: 'medicines' },
];
