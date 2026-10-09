import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface SiteFeedback {
  id: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  kind?: string;
  status?: 'done' | 'pending';
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class PublicSiteService {
  constructor(private http: HttpClient) {}

  recordHit() {
    return this.http.post<{ count: number }>('/api/hits', {});
  }

  hits() {
    return this.http.get<{ count: number; updated_at: string | null }>('/api/hits');
  }

  sendFeedback(payload: { name: string; email: string; message: string }) {
    return this.http.post<SiteFeedback>('/api/feedback', payload);
  }

  sendContact(payload: { name: string; email: string; phone: string; remark: string }) {
    return this.http.post<SiteFeedback>('/api/contact', payload);
  }

  listFeedback() {
    return this.http.get<SiteFeedback[]>('/api/feedback');
  }

  setFeedbackStatus(id: number, status: 'done' | 'pending') {
    return this.http.patch<SiteFeedback>(`/api/feedback/${id}`, { status });
  }
}
