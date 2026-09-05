import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminUsersResponse } from './models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = '/api/users';

  constructor(private http: HttpClient) {}

  all(): Observable<AdminUsersResponse> {
    return this.http.get<AdminUsersResponse>(this.api);
  }

  setStatus(id: number, status: 'allowed' | 'blocked'): Observable<{ id: number; status: string }> {
    return this.http.patch<{ id: number; status: string }>(`${this.api}/${id}/status`, { status });
  }
}
