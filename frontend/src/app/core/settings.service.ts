import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { SiteSettings } from './models';

const defaults: SiteSettings = {
  title: 'My Store Hub',
  slogan: 'Your name, your products, your customers.',
  logo: 'assets/MyStoreHub.jfif',
  qr_code: 'assets/QR.jpeg',
  theme_color: '#07131c',
  font_family: 'Syne',
  login_initial: '',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = '/api/settings';
  readonly current = signal<SiteSettings>(defaults);

  constructor(private http: HttpClient) {}

  load(tenantId?: number): void {
    this.loadForTenant(tenantId).subscribe();
  }

  loadForTenant(tenantId?: number) {
    const url = tenantId ? `${this.api}?tenantId=${tenantId}` : this.api;
    return this.http.get<SiteSettings>(url).pipe(tap((settings) => this.set(settings)));
  }

  /** Fetch a customer's settings for preview/editing without changing the live site brand. */
  getForTenant(tenantId: number) {
    return this.http.get<SiteSettings>(`${this.api}?tenantId=${tenantId}`);
  }

  loadForLoginEmail(email: string): void {
    this.http.get<SiteSettings>(`${this.api}?email=${encodeURIComponent(email)}`).subscribe({
      next: (settings) => this.set(settings),
    });
  }

  update(form: FormData, tenantId: number) {
    form.append('tenantId', String(tenantId));
    return this.http.put<SiteSettings>(this.api, form);
  }

  set(settings: SiteSettings): void {
    this.current.set(settings);
    document.title = settings.title;
    document.documentElement.style.setProperty('--tenant-theme', settings.theme_color);
    document.documentElement.style.setProperty('--tenant-font', `'${settings.font_family}', 'IBM Plex Sans', sans-serif`);
  }
}
