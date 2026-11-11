const test = require('node:test');
const assert = require('node:assert/strict');

test('an ad is not posted until the Facebook Page token is set', async () => {
  delete process.env.META_PAGE_ID;
  delete process.env.META_PAGE_ACCESS_TOKEN;
  delete process.env.META_IG_USER_ID;
  const { publishAd } = require('../social-ads');
  const result = await publishAd({
    imageUrl: 'https://www.mystoreshubs.com/uploads/ad.jpg',
    caption: 'Your store',
    fetchImpl: async () => {
      throw new Error('network should not be called');
    },
  });
  assert.equal(result.published, false);
  assert.equal(result.facebook, 'https://www.facebook.com/people/Mystoreshubs/61595639650254/');
  assert.equal(result.instagram, 'https://www.instagram.com/p/DemMPI6sZu9/');
});

test('a connected page posts the photo and the Instagram media', async () => {
  process.env.META_PAGE_ID = 'page-1';
  process.env.META_PAGE_ACCESS_TOKEN = 'token-1';
  process.env.META_IG_USER_ID = 'ig-1';
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: options.body.toString() });
    if (String(url).endsWith('/media')) return { ok: true, json: async () => ({ id: 'creation-1' }) };
    return { ok: true, json: async () => ({ id: 'post-1' }) };
  };
  const { publishAd } = require('../social-ads');
  const result = await publishAd({
    imageUrl: 'https://www.mystoreshubs.com/uploads/ad.jpg',
    caption: 'Your store',
    fetchImpl,
  });
  assert.equal(result.published, true);
  assert.equal(result.facebookPost, 'post-1');
  assert.equal(result.instagramPost, 'post-1');
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /page-1\/photos$/);
  assert.match(calls[1].body, /image_url=/);
  delete process.env.META_PAGE_ID;
  delete process.env.META_PAGE_ACCESS_TOKEN;
  delete process.env.META_IG_USER_ID;
});
