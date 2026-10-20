import { Routes } from '@angular/router';
import { authGuard, adminGuard, superAdminGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/medicines/medicines.component').then((m) => m.MedicinesComponent),
  },
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
    path: 'demo',
    loadComponent: () => import('./pages/demo/demo.component').then((m) => m.DemoComponent),
  },
  {
    path: 'settings',
    canActivate: [superAdminGuard],
    loadComponent: () =>
      import('./pages/super-admin-settings/super-admin-settings.component').then(
        (m) => m.SuperAdminSettingsComponent
      ),
  },
  { path: 'tenants', redirectTo: 'hubs' },
  {
    path: 'hubs',
    canActivate: [superAdminGuard],
    loadComponent: () =>
      import('./pages/super-admin-tenants/super-admin-tenants.component').then(
        (m) => m.SuperAdminTenantsComponent
      ),
  },
  {
    path: 'feedback',
    canActivate: [superAdminGuard],
    loadComponent: () =>
      import('./pages/super-admin-feedback/super-admin-feedback.component').then(
        (m) => m.SuperAdminFeedbackComponent
      ),
  },
  {
    path: 'store/:slug',
    loadComponent: () =>
      import('./pages/store-front/store-front.component').then((m) => m.StoreFrontComponent),
  },
  {
    path: 'shoppingmall',
    loadComponent: () =>
      import('./pages/medicines/medicines.component').then((m) => m.MedicinesComponent),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/client-account/client-account.component').then((m) => m.ClientAccountComponent),
  },
  {
    path: 'shop',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/client-shop/client-shop.component').then((m) => m.ClientShopComponent),
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
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin-shell/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'customers_tenats' },
      {
        path: 'customers_tenats',
        loadComponent: () =>
          import('./pages/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: 'Products',
        loadComponent: () =>
          import('./pages/admin-medicines/admin-medicines.component').then(
            (m) => m.AdminMedicinesComponent
          ),
      },
      { path: 'medicines', redirectTo: 'Products' },
      {
        path: 'orders',
        loadComponent: () =>
          import('./pages/admin-orders/admin-orders.component').then((m) => m.AdminOrdersComponent),
      },
      { path: 'users', redirectTo: 'stores' },
      { path: 'users/:id', redirectTo: 'stores/:id' },
      {
        path: 'stores',
        loadComponent: () =>
          import('./pages/admin-users/admin-users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'stores/:id',
        loadComponent: () =>
          import('./pages/admin-client-detail/admin-client-detail.component').then(
            (m) => m.AdminClientDetailComponent
          ),
      },
      {
        path: 'employees',
        loadComponent: () =>
          import('./pages/admin-employees/admin-employees.component').then(
            (m) => m.AdminEmployeesComponent
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/admin-reports/admin-reports.component').then((m) => m.AdminReportsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'shoppingmall' },
];
