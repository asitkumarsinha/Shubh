import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { DialogService } from './dialog.service';

@Injectable({ providedIn: 'root' })
export class LeaveService {
  constructor(
    private auth: AuthService,
    private dialog: DialogService,
    private router: Router
  ) {}

  /** Signed-in Super Admin, Hub, and Store visits confirm before logout. Guests move straight away. */
  async go(path: string): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      await this.router.navigateByUrl(path);
      return;
    }
    const yes = await this.dialog.confirm(
      'Are you sure you want to leave? This will log you out.',
      'Leave',
      { confirm: 'Yes', cancel: 'No', danger: false }
    );
    if (!yes) return;
    this.auth.logout(path);
  }
}
