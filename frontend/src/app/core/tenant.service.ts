import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Tenant } from './models';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly api = '/api/tenants';

  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<Tenant[]>(this.api);
  }

  create(data: Record<string, unknown>) {
    return this.http.post<Tenant>(this.api, data);
  }

  update(id: number, data: Partial<Tenant>) {
    return this.http.patch<Tenant>(`${this.api}/${id}`, data);
  }

  resetAdminPassword(id: number, password: string) {
    return this.http.patch<{ message: string }>(`${this.api}/${id}/admin-password`, { password });
  }

  exportBackup(id: number) {
    return this.http.get(`${this.api}/${id}/export`, { responseType: 'blob' });
  }

  archive(id: number, confirmation: string) {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`, {
      body: { confirmation, backupConfirmed: true },
    });
  }

  remove(id: number, confirmation: string) {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`, {
      body: { confirmation, permanent: true },
    });
  }
}
