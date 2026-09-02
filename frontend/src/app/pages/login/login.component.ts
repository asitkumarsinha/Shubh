import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { apiErrorMessage } from '../../core/api-error';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  submit(): void {
    this.error = '';
    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        this.router.navigate([res.user.role === 'admin' ? '/admin/medicines' : '/medicines']);
      },
      error: (err) => {
        this.loading = false;
        this.error = apiErrorMessage(err, 'Login failed');
      },
    });
  }

  fillDemo(role: 'admin' | 'user'): void {
    if (role === 'admin') {
      this.email = 'admin@medishop.com';
      this.password = 'admin123';
    } else {
      this.email = 'user@medishop.com';
      this.password = 'user123';
    }
  }
}
