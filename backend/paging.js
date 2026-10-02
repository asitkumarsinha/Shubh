function pageQuery(req, fallbackLimit = 12) {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit) || fallbackLimit)));
  const q = String(req.query.q || '').trim().slice(0, 80);
  const like = `%${q.replace(/[%_]/g, '')}%`;
  return { page, limit, offset: (page - 1) * limit, q, like };
}

function pagePayload(items, total, page, limit) {
  return {
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

module.exports = { pageQuery, pagePayload };
