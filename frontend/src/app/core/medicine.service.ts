import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Medicine, PageResult } from './models';

@Injectable({ providedIn: 'root' })
export class MedicineService {
  private readonly api = '/api/medicines';

  constructor(private http: HttpClient) {}

  list(query: { q?: string; page?: number; limit?: number; tenantId?: number } = {}): Observable<PageResult<Medicine>> {
    let params = new HttpParams();
    if (query.q) params = params.set('q', query.q);
    if (query.page) params = params.set('page', query.page);
    if (query.limit) params = params.set('limit', query.limit);
    if (query.tenantId) params = params.set('tenantId', query.tenantId);
    return this.http.get<PageResult<Medicine>>(this.api, { params });
  }

  get(id: number): Observable<Medicine> {
    return this.http.get<Medicine>(`${this.api}/${id}`);
  }

  create(form: FormData): Observable<Medicine> {
    return this.http.post<Medicine>(this.api, form);
  }

  update(id: number, form: FormData): Observable<Medicine> {
    return this.http.put<Medicine>(`${this.api}/${id}`, form);
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }

  restock(id: number, quantity: number): Observable<Medicine> {
    return this.http.patch<Medicine>(`${this.api}/${id}/restock`, { quantity });
  }
}
