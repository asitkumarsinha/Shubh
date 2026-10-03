import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PublicSiteService } from '../../core/public-site.service';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-public-cta',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './public-cta.component.html',
  styleUrl: './public-cta.component.scss',
})
export class PublicCtaComponent {
  showFeedback = false;
  name = '';
  email = '';
  message = '';
  sending = false;

  constructor(private publicSite: PublicSiteService, private toast: ToastService) {}

  openFeedback(): void {
    this.showFeedback = true;
  }

  send(): void {
    if (this.message.trim().length < 8) {
      this.toast.error('Please write at least 8 characters of feedback');
      return;
    }
    this.sending = true;
    this.toast.beginSave();
    this.publicSite.sendFeedback({
      name: this.name.trim(),
      email: this.email.trim(),
      message: this.message.trim(),
    }).subscribe({
      next: () => {
        this.sending = false;
        this.message = '';
        this.showFeedback = false;
        this.toast.success('Thank you. Your feedback was sent.');
      },
      error: (err) => {
        this.sending = false;
        this.toast.error(err.error?.message || 'Could not send feedback');
      },
    });
  }
}
