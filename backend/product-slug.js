function productSlug(name, id) {
  const base = String(name || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';
  return `${base}-${id}`;
}

module.exports = { productSlug };
