import { Component, Input } from '@angular/core';

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
  templateUrl: './feature-showcase.component.html',
  styleUrl: './feature-showcase.component.scss',
})
export class FeatureShowcaseComponent {
  @Input() compact = false;

  readonly contactEmail = CONTACT_EMAIL;

  readonly groups: FeatureGroup[] = [
    {
      title: 'Stores Admin - Shop & Checkout',
      items: [
        'Shopping Mall that lists every store on the platform',
        'Product catalogue with stock, images, and search',
        'Personal cart for each signed-in client',
        'Bill, UPI QR payment, and order tracking',
        'Retail or wholesale prices per client group',
      ],
    },
    {
      title: 'Hubs Admin (Hub - Customer)',
      items: [
        'Dashboard for today’s orders, revenue, and low stock',
        'Add and edit products with retail / wholesale price',
        'Approve bills, create purchase order, then dispatch',
        'Clients: add, block / allow, notes, CSV export',
        'Employees, sales reports, and emailed reports',
      ],
    },
    {
      title: 'Super Admin Platform',
      items: [
        'Run many stores (tenants) from one platform',
        'Own title, slogan, logo, QR, and theme per store',
        'Login Initial such as @shubhsurgical loads that store’s brand',
        'Plans, modules, backups, feedback, and website hits',
        'English, Hindi, Spanish, and French screens',
      ],
    },
  ];

  readonly comparison: ComparisonRow[] = [
    {
      feature: 'Many stores from one platform',
      myStoreHub: 'Built in (Super Admin)',
      shopify: 'Separate plan per store',
      dukaan: 'One store per account',
    },
    {
      feature: 'Brand loads from login email',
      myStoreHub: 'Built in (Login Initial)',
      shopify: 'Not available',
      dukaan: 'Not available',
    },
    {
      feature: 'Common Shopping Mall of stores',
      myStoreHub: 'Built in',
      shopify: 'Not available',
      dukaan: 'Not available',
    },
    {
      feature: 'Retail & wholesale pricing',
      myStoreHub: 'Built in per client group',
      shopify: 'Apps or higher plans',
      dukaan: 'Limited',
    },
    {
      feature: 'Approve → PO → Dispatch flow',
      myStoreHub: 'Built in',
      shopify: 'Through apps',
      dukaan: 'Basic order status',
    },
    {
      feature: 'Employees & client management',
      myStoreHub: 'Built in',
      shopify: 'Staff seats by plan',
      dukaan: 'Limited',
    },
    {
      feature: 'UPI QR checkout',
      myStoreHub: 'Built in',
      shopify: 'Through payment providers',
      dukaan: 'Built in',
    },
    {
      feature: 'Your data & hosting',
      myStoreHub: 'Your own server and database',
      shopify: 'Hosted by Shopify',
      dukaan: 'Hosted by Dukaan',
    },
    {
      feature: 'Pricing',
      myStoreHub: 'Plan agreed with MyStoreHub team',
      shopify: 'Monthly subscription + fees',
      dukaan: 'Monthly / yearly subscription',
    },
  ];
}
