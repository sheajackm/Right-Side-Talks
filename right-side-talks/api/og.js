const PROJECT_ID = 'qy9hgtdq';
const DATASET = 'production';
const TOKEN = 'skdqbW5W2rA9HnPRTTMq6R0bzkPwFVGkCbbd4hSdp64BgrEedxFlLBKAbDvluFppjH327PoOIPoX56uP5xIncTIyZimvJfz3ADJ2xKnDzi3l0VqqnuOWivY3Gk5di5KEfKbkAmsTOPyDqtssloEb8ruVCaYi1DDztxjSObYL1TWaw9QRkwUF';

const BASE_URL = 'https://www.rightsidetalksmedia.com';

// Author headshot mapping
const AUTHOR_IMAGES = {
  'Jack Shea':          BASE_URL + '/images/jack.jpg',
  'Nick Cribbet':       BASE_URL + '/images/nick.jpg',
  'Cecelia Brown':      BASE_URL + '/images/cecelia.jpg',
  'Caleb Grubb':        BASE_URL + '/images/caleb.jpg',
  'Ryan McCombs':       BASE_URL + '/images/ryan.jpg',
  'Gavin Krauciunas':   BASE_URL + '/images/gavin.jpg',
  'John DePerno':       BASE_URL + '/images/john.jpg',
  'Austin DeLorme':     BASE_URL + '/images/austin.jpg',
};

const DEFAULT_IMAGE = BASE_URL + '/images/og-image.jpg';

module.exports = async function(req, res) {
  // Parse slug from query string — handles Vercel routing quirks
  let slug = req.query && req.query.slug;
  if (!slug && req.url) {
    const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
    slug = urlParams.get('slug');
  }

  // If no slug, serve the actual article.html page
  if (!slug) {
    const fs = require('fs');
    const path = require('path');
    try {
      const html = fs.readFileSync(path.join(process.cwd(), 'article.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    } catch(e) {
      return res.redirect(302, BASE_URL + '/takes.html');
    }
  }

  // Fetch article from Sanity
  let article = null;
  try {
    const query = encodeURIComponent(`*[_type == "article" && slug.current == "${slug}"][0] {
      title,
      excerpt,
      "author": author->name,
      "slug": slug.current
    }`);
    const url = `https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${query}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(6000)
    });
    if (r.ok) {
      const data = await r.json();
      article = data.result;
    }
  } catch(e) {}

  // If no article found, redirect to takes page
  if (!article || !article.title) {
    return res.redirect(302, BASE_URL + '/takes.html');
  }

  const title = article.title + ' — Right Side Talks';
  const description = article.excerpt || 'Bold conservative opinion and commentary from Right Side Talks.';
  const image = AUTHOR_IMAGES[article.author] || DEFAULT_IMAGE;
  const articleUrl = BASE_URL + '/article.html?slug=' + slug;

  // Return HTML page with proper OG tags — crawlers read this, users get redirected
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Right Side Talks" />
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="400" />
  <meta property="og:image:height" content="400" />
  <meta property="og:url" content="${articleUrl}" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@rightsidetalks" />
  <meta name="twitter:title" content="${escHtml(title)}" />
  <meta name="twitter:description" content="${escHtml(description)}" />
  <meta name="twitter:image" content="${image}" />

  <!-- Redirect real users to the article page immediately -->
  <meta http-equiv="refresh" content="0;url=${articleUrl}" />
  <link rel="canonical" href="${articleUrl}" />
</head>
<body>
  <p>Redirecting to article... <a href="${articleUrl}">Click here if not redirected</a></p>
  <script>window.location.replace('${articleUrl}');</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(html);
};

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
