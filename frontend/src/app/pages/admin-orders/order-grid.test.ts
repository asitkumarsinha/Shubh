import assert from 'node:assert/strict';
import test from 'node:test';
import { itemCount, matchesOrderQuery, receivingState, receivingText, sortOrders } from './order-grid.ts';

test('item count adds quantities', () => {
  assert.equal(itemCount([{ quantity: 2 }, { quantity: 1 }]), 3);
  assert.equal(itemCount(undefined), 0);
});

test('search matches the bill or the client', () => {
  const order = {
    bill_number: 'BILL-1048',
    created_at: '2026-05-24',
    status: 'pending',
    user: { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '9876543210' },
  };
  assert.equal(matchesOrderQuery(order, '1048'), true);
  assert.equal(matchesOrderQuery(order, 'rahul'), true);
  assert.equal(matchesOrderQuery(order, 'priya'), false);
  assert.equal(matchesOrderQuery(order, '  '), true);
});

test('receiving text and state follow fulfillment', () => {
  assert.equal(
    receivingText({ bill_number: '1', created_at: '', status: 'pending', fulfillment: 'delivery', delivery_address: 'Jaipur' }),
    'Deliver to Jaipur'
  );
  assert.equal(
    receivingText({ bill_number: '1', created_at: '', status: 'pending', fulfillment: 'pickup' }),
    'Collect from the shop'
  );
  assert.equal(
    receivingState({ bill_number: '1', created_at: '', status: 'pending', fulfillment: 'pickup' }),
    'Pending pickup'
  );
  assert.equal(
    receivingState({ bill_number: '1', created_at: '', status: 'approved', fulfillment: 'delivery' }),
    'Ready to ship'
  );
});

test('newest orders sort first', () => {
  const rows = sortOrders(
    [
      { created_at: '2026-01-01' },
      { created_at: '2026-03-01' },
    ],
    true
  );
  assert.equal(rows[0].created_at, '2026-03-01');
});
