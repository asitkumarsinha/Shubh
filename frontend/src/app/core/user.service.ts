import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminClientDetail, AdminUserDetail, AdminUsersResponse } from './models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = '/api/users';

  constructor(private http: HttpClient) {}

  all(): Observable<AdminUsersResponse> {
    return this.http.get<AdminUsersResponse>(this.api);
  }

  get(id: number): Observable<AdminClientDetail> {
    return this.http.get<AdminClientDetail>(`${this.api}/${id}`);
  }

  setStatus(id: number, status: 'allowed' | 'blocked'): Observable<AdminUserDetail> {
    return this.http.patch<AdminUserDetail>(`${this.api}/${id}/status`, { status });
  }

  update(
    id: number,
    payload: { client_group?: 'retail' | 'wholesale'; notes?: string; password?: string }
  ): Observable<AdminUserDetail> {
    return this.http.patch<AdminUserDetail>(`${this.api}/${id}`, payload);
  }

  exportCsv(): Observable<Blob> {
    return this.http.get(`${this.api}/export`, { responseType: 'blob' });
  }
}
