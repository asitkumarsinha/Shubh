import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login']);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() && auth.isAdmin()) return true;
  if (auth.isLoggedIn()) return router.createUrlTree(['/shoppingmall']);
  return router.createUrlTree(['/login']);
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() && auth.isSuperAdmin()) return true;
  if (auth.isLoggedIn()) return router.createUrlTree([auth.isAdmin() ? '/admin/customers_tenats' : '/shoppingmall']);
  return router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return true;
  return router.createUrlTree([
    auth.isSuperAdmin() ? '/settings' : auth.isAdmin() ? '/admin/customers_tenats' : '/shoppingmall',
  ]);
};
