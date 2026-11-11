const FACEBOOK = 'https://www.facebook.com/people/Mystoreshubs/61595639650254/';
const INSTAGRAM = 'https://www.instagram.com/p/DemMPI6sZu9/';
const GRAPH = 'https://graph.facebook.com/v23.0';

function accounts() {
  return { facebook: FACEBOOK, instagram: INSTAGRAM };
}

function graphError(body) {
  const message = body?.error?.message || 'Facebook did not accept the ad';
  const err = new Error(message);
  err.status = 502;
  return err;
}

async function graph(fetchImpl, path, fields) {
  const response = await fetchImpl(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw graphError(body);
  return body;
}

async function publishAd({ imageUrl, caption, fetchImpl = globalThis.fetch }) {
  const pageId = String(process.env.META_PAGE_ID || '').trim();
  const token = String(process.env.META_PAGE_ACCESS_TOKEN || '').trim();
  const igId = String(process.env.META_IG_USER_ID || '').trim();
  const links = accounts();
  if (!pageId || !token) {
    return {
      published: false,
      ...links,
      message: 'Ad saved. Connect the Facebook Page token to post it on Facebook and Instagram.',
    };
  }
  let host = '';
  try {
    host = new URL(imageUrl).hostname;
  } catch {
    host = '';
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return {
      published: false,
      ...links,
      message: 'Ad saved on this computer. Facebook and Instagram can fetch it only from the live site.',
    };
  }
  const facebook = await graph(fetchImpl, `${pageId}/photos`, {
    url: imageUrl,
    caption,
    access_token: token,
  });
  let instagram = null;
  if (igId) {
    const created = await graph(fetchImpl, `${igId}/media`, {
      image_url: imageUrl,
      caption,
      access_token: token,
    });
    instagram = await graph(fetchImpl, `${igId}/media_publish`, {
      creation_id: created.id,
      access_token: token,
    });
  }
  return {
    published: true,
    facebookPost: facebook.id || '',
    instagramPost: instagram?.id || '',
    ...links,
    message: igId ? 'Ad posted on Facebook and Instagram' : 'Ad posted on Facebook. Instagram is not connected.',
  };
}

module.exports = { publishAd, accounts };
