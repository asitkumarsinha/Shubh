import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, Report } from './models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = '/api/orders';

  constructor(private http: HttpClient) {}

  checkout(items: Array<{ medicineId: number; quantity: number }>): Observable<Order> {
    return this.http.post<Order>(`${this.api}/checkout`, { items });
  }

  myOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.api}/my`);
  }

  get(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.api}/${id}`);
  }

  all(status?: string): Observable<Order[]> {
    const q = status ? `?status=${status}` : '';
    return this.http.get<Order[]>(`${this.api}${q}`);
  }

  approve(id: number): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/${id}/approve`, {});
  }

  reject(id: number): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/${id}/reject`, {});
  }

  cancel(id: number): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/${id}/cancel`, {});
  }

  dispatch(id: number): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/${id}/dispatch`, {});
  }

  setStatus(
    id: number,
    status: 'pending' | 'approved' | 'dispatched' | 'rejected' | 'cancelled'
  ): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/${id}/status`, { status });
  }
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly api = '/api/reports';

  constructor(private http: HttpClient) {}

  get(): Observable<Report> {
    return this.http.get<Report>(this.api);
  }

  email(email: string): Observable<{
    message: string;
    previewUrl?: string;
    outboxUrl?: string;
    outboxId?: string;
    mode?: string;
    delivered?: boolean;
    mailConfigured?: boolean;
  }> {
    return this.http.post<{
      message: string;
      previewUrl?: string;
      outboxUrl?: string;
      outboxId?: string;
      mode?: string;
      delivered?: boolean;
      mailConfigured?: boolean;
    }>(`${this.api}/email`, { email });
  }

  getOutboxHtml(outboxUrl: string): Observable<string> {
    return this.http.get(outboxUrl, { responseType: 'text' });
  }
}
