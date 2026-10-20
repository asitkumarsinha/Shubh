import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-public-cta',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './public-cta.component.html',
  styleUrl: './public-cta.component.scss',
})
export class PublicCtaComponent implements OnInit {
  @Input() demoOnly = false;
  readonly demoVideo = 'assets/demo/mystoreshubs-demo.mp4?v=20261020';
  playDemo = false;
  musicUrl = '';
  musicError = '';
  savingMusic = false;

  @ViewChild('clip') clip?: ElementRef<HTMLVideoElement>;
  @ViewChild('tune') tune?: ElementRef<HTMLAudioElement>;

  constructor(private http: HttpClient, public auth: AuthService) {}

  ngOnInit(): void {
    this.loadMusic();
  }

  openDemo(): void {
    this.playDemo = true;
    this.musicError = '';
    this.startCustomMusic();
    setTimeout(() => this.startPicture(), 0);
  }

  private startPicture(): void {
    const video = this.clip?.nativeElement;
    if (!video) return;
    if (this.musicUrl) video.muted = true;
    video.play().catch(() => undefined);
    this.startCustomMusic();
  }

  closeDemo(): void {
    this.tune?.nativeElement.pause();
    this.clip?.nativeElement.pause();
    this.playDemo = false;
  }

  loadMusic(): void {
    this.http.get<{ music: string }>('/api/settings/demo-music').subscribe({
      next: (res) => {
        this.musicUrl = res.music ? `${res.music}?v=${Date.now()}` : '';
        if (this.playDemo) this.startCustomMusic();
      },
    });
  }

  onMusic(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('music', file);
    this.savingMusic = true;
    this.musicError = '';
    this.http.post<{ music: string }>('/api/settings/demo-music', body).subscribe({
      next: (res) => {
        this.savingMusic = false;
        this.musicUrl = `${res.music}?v=${Date.now()}`;
        const audio = this.tune?.nativeElement;
        if (audio) audio.load();
        this.startCustomMusic();
      },
      error: (err) => {
        this.savingMusic = false;
        this.musicError = err.error?.message || 'Could not save the music';
      },
    });
  }

  startCustomMusic(): void {
    const audio = this.tune?.nativeElement;
    const video = this.clip?.nativeElement;
    if (!this.musicUrl || !audio) return;
    if (video) video.muted = true;
    audio.loop = true;
    const play = () => {
      if (video && !video.paused) audio.currentTime = this.alignedTime(video.currentTime, audio.duration);
      audio.play().catch(() => undefined);
    };
    if (audio.readyState >= 2) play();
    else audio.addEventListener('canplay', play, { once: true });
  }

  syncFromVideo(): void {
    const video = this.clip?.nativeElement;
    const audio = this.tune?.nativeElement;
    if (!video || !audio || !this.musicUrl) return;
    video.muted = true;
    if (audio.readyState >= 1) {
      const target = this.alignedTime(video.currentTime, audio.duration);
      if (Math.abs(audio.currentTime - target) > 0.4) {
        try { audio.currentTime = target; } catch { /* file is still loading */ }
      }
    }
    if (!video.paused) this.startCustomMusic();
  }

  pauseMusic(): void {
    this.tune?.nativeElement.pause();
  }

  private alignedTime(videoTime: number, duration: number): number {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return videoTime % duration;
  }
}
