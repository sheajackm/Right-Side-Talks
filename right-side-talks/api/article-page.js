// api/og.js — server-rendered Open Graph preview cards for shared article links.
//
// Why this exists: article.html fills in its meta tags with JavaScript after the
// page loads. Social/iMessage link crawlers do NOT run JavaScript, so when an
// article link is pasted they only see the static placeholder tags. This function
// fetches the article server-side, returns HTML with the correct OG/Twitter tags
// already filled in (title, excerpt, and the author's headshot as the image), and
// then redirects real readers to the actual article page.
//
// Share links in article.html point here: /api/og?slug=<article-slug>

// Author name (as stored in Sanity) -> headshot file in /images.
const AUTHOR_IMAGES = {
  'Jack Shea': 'jack.jpg',
  'Nick Cribbet': 'nick.jpg',
  'Cecelia Brown': 'cecelia.jpg',
  'Caleb Grubb': 'caleb.jpg',
  'Ryan McCombs': 'ryan.jpg',
  'Austin DeLorme': 'austin.jpg',
  'Nicholas Bausch': 'Nick_Bausch.jpg',
  'Owen Tuori': 'Owen_Tuori.jpg',
  'Maura London': 'maura.jpg',
  'Mike Xu': 'Mike_Xu.jpg',
  'Kobe Kirschner': 'Kobe_Kirschner.jpg',
  'Jack Molaison': 'Jack_Molaison.jpg',
  'Ashley Stuart': 'Ashley_Stuart.jpg',
  'Jenna Smith': 'Jenna_Smith.jpg',
  'Halle Janik': 'Halle_Janik.jpg',
  'Kamdyn McClain': 'Kamdyn_McClain.jpg',
  'Emma Symula': 'Emma_Symula.jpg',
  'Sarah Prentice': 'Sarah_Prentice.jpg'
};
const DEFAULT_IMAGE = 'images/og-image.jpg';

function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = async function(req, res) {
  const slug = req.query && req.query.slug;

  // Public origin the request came in on (e.g. https://rightsidetalks.com) — used
  // for the image, canonical, and redirect URLs so they always match the live domain.
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const BASE_URL = `${proto}://${host}`;

  // Fetch our own articles API via the same public origin this request came in on.
  // (Do NOT use process.env.VERCEL_URL here: internal deployment URLs are often
  // behind Vercel Deployment Protection, which blocks the fetch and silently
  // produced a generic card instead of the personalized one.)
  const INTERNAL_BASE = BASE_URL;

  if (!slug) {
    res.statusCode = 302;
    res.setHeader('Location', `${BASE_URL}/takes.html`);
    return res.end();
  }

  const articleUrl = `${BASE_URL}/article.html?slug=${encodeURIComponent(slug)}`;

  // The identifier may be a clean slug or, for articles without a slug set, a
  // Sanity _id (UUID). Detect which and query the right field.
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slug);
  const apiUrl = isId
    ? `${INTERNAL_BASE}/api/articles?id=${encodeURIComponent(slug)}`
    : `${INTERNAL_BASE}/api/articles?slug=${encodeURIComponent(slug)}`;

  // Fetch the article so the card can show its real title, excerpt, and author photo.
  let a = null;
  let fetchNote = '';
  try {
    const r = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const data = await r.json();
      a = data.item;
      if (!a) fetchNote = 'lookup ok but no article matched this slug/id';
    } else {
      fetchNote = 'articles API responded HTTP ' + r.status;
    }
  } catch (e) {
    fetchNote = 'fetch failed: ' + e.message;
  }

  // Visit /api/og?slug=...&debug=1 to see exactly what the lookup found.
  if (req.query && req.query.debug) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({
      slug, isId, apiUrl,
      found: !!a,
      note: fetchNote || 'ok',
      author: a && a.author,
      hasHeadshot: !!(a && AUTHOR_IMAGES[a.author]),
      title: a && a.title
    }, null, 2));
  }

  const title = a && a.title ? a.title : 'Right Side Talks';
  const description = a
    ? (a.excerpt || `Opinion & commentary by ${a.author || 'Right Side Talks'}.`)
    : 'Read the latest opinion and commentary from Right Side Talks.';
  const imageFile = a && AUTHOR_IMAGES[a.author] ? `images/${AUTHOR_IMAGES[a.author]}` : DEFAULT_IMAGE;
  const image = `${BASE_URL}/${imageFile}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escHtml(title)} | Right Side Talks</title>
<meta name="description" content="${escHtml(description)}" />

<!-- Open Graph (iMessage, Facebook, LinkedIn, etc.) -->
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Right Side Talks" />
<meta property="og:title" content="${escHtml(title)}" />
<meta property="og:description" content="${escHtml(description)}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="400" />
<meta property="og:image:height" content="400" />
<meta property="og:url" content="${articleUrl}" />

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@rightsidetalks" />
<meta name="twitter:title" content="${escHtml(title)}" />
<meta name="twitter:description" content="${escHtml(description)}" />
<meta name="twitter:image" content="${image}" />

<link rel="canonical" href="${articleUrl}" />
<!-- Real readers are sent straight to the article; crawlers read the tags above first. -->
<meta http-equiv="refresh" content="0;url=${articleUrl}" />
</head>
<body>
<p>Redirecting to the article&hellip; <a href="${articleUrl}">Click here if you are not redirected.</a></p>
<script>window.location.replace(${JSON.stringify(articleUrl)});</script>
</body>
</html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache per-URL (each slug is its own URL) so crawlers and the CDN can reuse it.
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
  res.end(html);
};
