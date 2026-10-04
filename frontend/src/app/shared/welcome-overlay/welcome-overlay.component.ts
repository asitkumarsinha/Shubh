import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FeatureShowcaseComponent } from '../feature-showcase/feature-showcase.component';

const SEEN_KEY = 'msh_welcome_seen';
const AUTO_CLOSE_SECONDS = 10;

@Component({
  selector: 'app-welcome-overlay',
  standalone: true,
  imports: [FeatureShowcaseComponent],
  templateUrl: './welcome-overlay.component.html',
  styleUrl: './welcome-overlay.component.scss',
})
export class WelcomeOverlayComponent implements OnInit, OnDestroy {
  open = false;
  secondsLeft = AUTO_CLOSE_SECONDS;
  private timer?: ReturnType<typeof setInterval>;

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (sessionStorage.getItem(SEEN_KEY) || location.pathname.startsWith('/demo')) return;
    sessionStorage.setItem(SEEN_KEY, '1');
    this.open = true;
    this.timer = setInterval(() => {
      this.secondsLeft -= 1;
      if (this.secondsLeft <= 0) this.close();
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  close(): void {
    clearInterval(this.timer);
    this.open = false;
    this.router.navigate(['/login']);
  }
}
