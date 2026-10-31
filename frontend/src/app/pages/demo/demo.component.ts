import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SettingsService } from '../../core/settings.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import { HomeLoginComponent } from '../../shared/home-login/home-login.component';
@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [RouterLink, TranslatePipe, LanguageSwitcherComponent, HomeLoginComponent],
  templateUrl: './demo.component.html',
  styleUrl: './demo.component.scss',
})
export class DemoComponent implements OnInit, OnDestroy {
  secondsLeft = 30;
  private timer?: ReturnType<typeof setInterval>;
  @ViewChild('clip') clip?: ElementRef<HTMLVideoElement>;
  @ViewChild('score') score?: ElementRef<HTMLAudioElement>;

  constructor(
    public settings: SettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    document.documentElement.classList.add('hub-login');
    this.timer = setInterval(() => {
      this.secondsLeft -= 1;
      if (this.secondsLeft <= 0) {
        clearInterval(this.timer);
        this.router.navigate(['/login']);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    this.score?.nativeElement.pause();
    document.documentElement.classList.remove('hub-login');
  }

  onVideoPlay(): void {
    const audio = this.score?.nativeElement;
    const video = this.clip?.nativeElement;
    if (!audio || !video) return;
    const length = audio.duration;
    if (Number.isFinite(length) && length > 0) audio.currentTime = video.currentTime % length;
    audio.play().catch(() => undefined);
  }

  onVideoPause(): void {
    this.score?.nativeElement.pause();
  }

  onVideoSeek(): void {
    const audio = this.score?.nativeElement;
    const video = this.clip?.nativeElement;
    if (!audio || !video || audio.paused) return;
    const length = audio.duration;
    if (Number.isFinite(length) && length > 0) audio.currentTime = video.currentTime % length;
  }
}
