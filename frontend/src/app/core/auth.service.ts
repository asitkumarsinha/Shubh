import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { User } from './models';

interface AuthResponse {
  token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = '/api/auth';
  private readonly tokenKey = 'medishop_token';
  private readonly userKey = 'medishop_user';

  readonly user = signal<User | null>(this.readUser());
  readonly isLoggedIn = computed(() => !!this.user());
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly isSuperAdmin = computed(() => this.user()?.role === 'super_admin');
  readonly isWholesale = computed(
    () => this.user()?.role === 'user' && this.user()?.client_group === 'wholesale'
  );

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/login`, { email, password }).pipe(
      tap((res) => this.persist(res))
    );
  }

  register(payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/register`, payload).pipe(
      tap((res) => this.persist(res))
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private persist(res: AuthResponse): void {
    localStorage.setItem(this.tokenKey, res.token);
    localStorage.setItem(this.userKey, JSON.stringify(res.user));
    this.user.set(res.user);
  }

  private readUser(): User | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
