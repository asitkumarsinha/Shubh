/** Same shape as the API: silk-saree-38. The number is the product id. */
export function productSlug(name: string, id: number): string {
  const base = String(name || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';
  return `${base}-${id}`;
}
