import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SiteSettings } from './models';

const defaults: SiteSettings = {
  title: 'Shubh Surgical',
  slogan: 'Your Trusted Partner in Health and Wellness.',
  logo: 'assets/shubh-surgical-logo.svg',
  qr_code: 'assets/QR.jpeg',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = '/api/settings';
  readonly current = signal<SiteSettings>(defaults);

  constructor(private http: HttpClient) {}

  load(): void {
    this.http.get<SiteSettings>(this.api).subscribe({
      next: (settings) => this.set(settings),
    });
  }

  update(form: FormData) {
    return this.http.put<SiteSettings>(this.api, form);
  }

  set(settings: SiteSettings): void {
    this.current.set(settings);
    document.title = `${settings.title} | Online Medicine Store`;
  }
}
