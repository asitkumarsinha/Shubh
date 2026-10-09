import { Component, Input } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

export const CONTACT_EMAIL = 'support@mystoreshubs.com';

interface FeatureGroup {
  title: string;
  items: string[];
}

interface ComparisonRow {
  feature: string;
  myStoreHub: string;
  shopify: string;
  dukaan: string;
}

@Component({
  selector: 'app-feature-showcase',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './feature-showcase.component.html',
  styleUrl: './feature-showcase.component.scss',
})
export class FeatureShowcaseComponent {
  @Input() compact = false;
  @Input() collapseCompare = false;
  @Input() showGuide = false;
  compareOpen = false;

  readonly contactEmail = CONTACT_EMAIL;

  readonly groups: FeatureGroup[] = [
    {
      title: 'demo.g1.title',
      items: ['demo.g1.1', 'demo.g1.2', 'demo.g1.3', 'demo.g1.4', 'demo.g1.5'],
    },
    {
      title: 'demo.g2.title',
      items: ['demo.g2.1', 'demo.g2.2', 'demo.g2.3', 'demo.g2.4', 'demo.g2.5'],
    },
    {
      title: 'demo.g3.title',
      items: ['demo.g3.1', 'demo.g3.2', 'demo.g3.3', 'demo.g3.4', 'demo.g3.5'],
    },
  ];

  readonly comparison: ComparisonRow[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
    feature: `demo.r${n}.feature`,
    myStoreHub: `demo.r${n}.ours`,
    shopify: `demo.r${n}.shopify`,
    dukaan: `demo.r${n}.dukaan`,
  }));
}
