import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { csvCell, inr, toCsv } from './grid-export.ts';

describe('grid export', () => {
  it('quotes cells that contain commas', () => {
    assert.equal(csvCell('Silk, Saree'), '"Silk, Saree"');
  });

  it('formats rupees with two decimals', () => {
    assert.equal(inr(1890), '₹1890.00');
  });

  it('writes one header row and the grid rows', () => {
    const csv = toCsv([
      { title: 'Orders', headers: ['Bill', 'Total'], rows: [['B-1', '₹10.00']] },
    ]);
    assert.equal(csv, 'Bill,Total\nB-1,₹10.00');
  });
});
