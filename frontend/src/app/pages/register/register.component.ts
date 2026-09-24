import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  name = '';
  email = '';
  password = '';
  phone = '';
  address = '';
  error = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router, private toast: ToastService) {}

  submit(): void {
    this.error = '';
    this.loading = true;
    this.auth
      .register({
        name: this.name,
        email: this.email,
        password: this.password,
        phone: this.phone,
        address: this.address,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.toast.success('Account saved');
          this.router.navigate(['/medicines']);
        },
        error: (err) => {
          this.loading = false;
          const msg = apiErrorMessage(err, 'Registration failed');
          this.error = msg;
          this.toast.error(msg);
        },
      });
  }
}
