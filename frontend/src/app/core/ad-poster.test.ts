import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planAd } from './ad-poster.ts';

describe('ad poster', () => {
  it('keeps the same picture for the same seed', () => {
    assert.deepEqual(planAd(42), planAd(42));
  });

  it('uses the current store line and four live features', () => {
    const plan = planAd(7);
    assert.equal(plan.headline, 'Your store, Your clients, Your hub');
    assert.equal(plan.brand, 'My Stores Hubs');
    assert.equal(plan.features.length, 4);
    assert.equal(new Set(plan.features).size, 4);
  });

  it('changes the visual format as the seed changes', () => {
    const formats = new Set(Array.from({ length: 24 }, (_, index) => planAd(index + 1).format));
    const palettes = new Set(
      Array.from({ length: 24 }, (_, index) => planAd(index + 1).palette.bg)
    );
    assert.ok(formats.size >= 3);
    assert.ok(palettes.size >= 3);
  });
});
