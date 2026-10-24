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
    path: 'dashboard',
    canActivate: [superAdminGuard],
    data: { section: 'dashboard' },
    loadComponent: () =>
      import('./pages/super-admin-board/super-admin-board.component').then(
        (m) => m.SuperAdminBoardComponent
      ),
  },
  {
    path: 'stores',
    canActivate: [superAdminGuard],
    data: { section: 'stores' },
    loadComponent: () =>
      import('./pages/super-admin-board/super-admin-board.component').then(
        (m) => m.SuperAdminBoardComponent
      ),
  },
  {
    path: 'users',
    canActivate: [superAdminGuard],
    data: { section: 'users' },
    loadComponent: () =>
      import('./pages/super-admin-board/super-admin-board.component').then(
        (m) => m.SuperAdminBoardComponent
      ),
  },
  {
    path: 'billing',
    canActivate: [superAdminGuard],
    data: { section: 'billing' },
    loadComponent: () =>
      import('./pages/super-admin-board/super-admin-board.component').then(
        (m) => m.SuperAdminBoardComponent
      ),
  },
  {
    path: 'plans',
    canActivate: [superAdminGuard],
    data: { section: 'plans' },
    loadComponent: () =>
      import('./pages/super-admin-board/super-admin-board.component').then(
        (m) => m.SuperAdminBoardComponent
      ),
  },
  {
    path: 'health',
    canActivate: [superAdminGuard],
    data: { section: 'health' },
    loadComponent: () =>
      import('./pages/super-admin-board/super-admin-board.component').then(
        (m) => m.SuperAdminBoardComponent
      ),
  },
  {
    path: 'reports',
    canActivate: [superAdminGuard],
    data: { section: 'reports' },
    loadComponent: () =>
      import('./pages/super-admin-board/super-admin-board.component').then(
        (m) => m.SuperAdminBoardComponent
      ),
  },
  {
    path: 'store/:slug/:product',
    loadComponent: () =>
      import('./pages/product-page/product-page.component').then((m) => m.ProductPageComponent),
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
      { path: '', pathMatch: 'full', redirectTo: 'hubs' },
      { path: 'customers_tenats', redirectTo: 'hubs' },
      {
        path: 'hubs',
        loadComponent: () =>
          import('./pages/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      { path: 'Products', redirectTo: 'AddProducts' },
      { path: 'medicines', redirectTo: 'AddProducts' },
      {
        path: 'AddProducts',
        loadComponent: () =>
          import('./pages/admin-medicines/admin-medicines.component').then(
            (m) => m.AdminMedicinesComponent
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/admin-product-list/admin-product-list.component').then(
            (m) => m.AdminProductListComponent
          ),
      },
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
        path: 'clone',
        loadComponent: () =>
          import('./pages/admin-clone-store/admin-clone-store.component').then(
            (m) => m.AdminCloneStoreComponent
          ),
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
