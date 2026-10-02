import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminClientDetail, AdminUserDetail, AdminUsersResponse } from './models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = '/api/users';

  constructor(private http: HttpClient) {}

  all(query: { q?: string; page?: number; limit?: number } = {}): Observable<AdminUsersResponse> {
    let params = new HttpParams();
    if (query.q) params = params.set('q', query.q);
    if (query.page) params = params.set('page', query.page);
    if (query.limit) params = params.set('limit', query.limit);
    return this.http.get<AdminUsersResponse>(this.api, { params });
  }

  create(payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
    client_group?: 'retail' | 'wholesale';
  }): Observable<AdminUserDetail> {
    return this.http.post<AdminUserDetail>(this.api, payload);
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
