import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-public-cta',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './public-cta.component.html',
  styleUrl: './public-cta.component.scss',
})
export class PublicCtaComponent {}
