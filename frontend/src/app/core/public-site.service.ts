import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface SiteFeedback {
  id: number;
  name: string;
  email: string;
  message: string;
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

  listFeedback() {
    return this.http.get<SiteFeedback[]>('/api/feedback');
  }
}
