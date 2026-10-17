import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { SiteSettings } from './models';
import { fitLogoOnWhite } from './logo-fit';

const defaults: SiteSettings = {
  title: 'My Stores Hubs',
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
  private logoRequest = 0;
  private loadRequest = 0;
  readonly current = signal<SiteSettings>(defaults);

  constructor(private http: HttpClient) {}

  load(tenantId?: number): void {
    this.loadForTenant(tenantId).subscribe();
  }

  loadForTenant(tenantId?: number) {
    const request = ++this.loadRequest;
    const url = tenantId ? `${this.api}?tenantId=${tenantId}` : this.api;
    return this.http.get<SiteSettings>(url).pipe(
      tap((settings) => {
        if (request === this.loadRequest) this.set(settings);
      })
    );
  }

  /** Fetch a customer's settings for preview/editing without changing the live site brand. */
  getForTenant(tenantId: number) {
    return this.http.get<SiteSettings>(`${this.api}?tenantId=${tenantId}`);
  }

  loadForLoginEmail(email: string): void {
    const request = ++this.loadRequest;
    this.http.get<SiteSettings>(`${this.api}?email=${encodeURIComponent(email)}`).subscribe({
      next: (settings) => {
        if (request === this.loadRequest) this.set(settings);
      },
    });
  }

  update(form: FormData, tenantId: number) {
    form.append('tenantId', String(tenantId));
    return this.http.put<SiteSettings>(this.api, form);
  }

  set(settings: SiteSettings): void {
    const logo = this.absoluteAsset(settings.logo);
    const next = logo === settings.logo ? settings : { ...settings, logo };
    this.current.set(next);
    document.documentElement.style.setProperty('--tenant-theme', next.theme_color);
    document.documentElement.style.setProperty('--tenant-font', `'${next.font_family}', 'IBM Plex Sans', sans-serif`);
    this.fitBrandLogo(next.logo);
  }

  private absoluteAsset(url: string): string {
    if (!url || /^(data:|blob:|https?:|\/)/.test(url)) return url;
    return `/${url}`;
  }

  /** Crop a dark photo backdrop so every screen uses the same white emblem as the login page. */
  private fitBrandLogo(url: string): void {
    if (!url || url.startsWith('data:')) return;
    const request = ++this.logoRequest;
    const img = new Image();
    img.onload = () => {
      if (request !== this.logoRequest || this.current().logo !== url) return;
      let fitted: string | null = null;
      try {
        fitted = fitLogoOnWhite(img);
      } catch {
        fitted = null;
      }
      if (!fitted) return;
      this.current.set({ ...this.current(), logo: fitted });
    };
    img.src = url;
  }
}
