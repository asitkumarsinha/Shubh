export interface GridOrder {
  bill_number: string;
  created_at: string;
  status: string;
  fulfillment?: string;
  delivery_address?: string;
  user?: { name?: string; email?: string; phone?: string };
  items?: Array<{ quantity: number }>;
}

export function itemCount(items: Array<{ quantity: number }> | undefined): number {
  return (items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function matchesOrderQuery(order: GridOrder, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [order.bill_number, order.user?.name, order.user?.email, order.user?.phone]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

export function receivingText(order: GridOrder): string {
  if (order.fulfillment === 'delivery') {
    return order.delivery_address ? `Deliver to ${order.delivery_address}` : 'Deliver to the address';
  }
  return 'Collect from the shop';
}

export function receivingState(order: GridOrder): string {
  if (order.status === 'cancelled' || order.status === 'rejected') return 'Cancelled';
  if (order.status === 'dispatched') return 'Completed';
  if (order.fulfillment === 'pickup') return order.status === 'pending' ? 'Pending pickup' : 'Ready to collect';
  return order.status === 'pending' ? 'Preparing' : 'Ready to ship';
}

export function sortOrders<T extends { created_at: string }>(rows: T[], newestFirst: boolean): T[] {
  return [...rows].sort((a, b) =>
    newestFirst ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)
  );
}
