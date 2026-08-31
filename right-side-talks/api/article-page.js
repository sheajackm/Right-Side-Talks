// api/article-page.js — serves article.html with personalized Open Graph tags
// injected server-side, so copying the URL straight from the address bar
// produces a personalized preview card in iMessage/X/Facebook.
//
// vercel.json routes /article.html (and /article) here. This function:
//   1. looks up the article (by slug, or by Sanity _id for slug-less articles)
//   2. fetches the static template /article-view.html
//   3. swaps the generic <title> and og:/twitter: tags for the article's own
//   4. returns the page — the client-side JS then renders the body as usual.

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

// Replace the content="" of a meta tag identified by its id attribute.
function setMetaById(html, id, value) {
  const re = new RegExp('(<meta[^>]+id="' + id + '"[^>]+content=")[^"]*(")');
  return html.replace(re, '$1' + value + '$2');
}

module.exports = async function(req, res) {
  const slug = req.query && req.query.slug;

  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const BASE_URL = `${proto}://${host}`;

  // 1. Look up the article (skip if no slug — the page will show its own error state).
  let a = null;
  if (slug) {
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slug);
    const apiUrl = isId
      ? `${BASE_URL}/api/articles?id=${encodeURIComponent(slug)}`
      : `${BASE_URL}/api/articles?slug=${encodeURIComponent(slug)}`;
    try {
      const r = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const data = await r.json();
        a = data.item;
      }
    } catch (e) { /* fall through — generic tags */ }
  }

  // 2. Fetch the static page template.
  let html = null;
  try {
    const t = await fetch(`${BASE_URL}/article-view.html`, { signal: AbortSignal.timeout(8000) });
    if (t.ok) html = await t.text();
  } catch (e) { /* handled below */ }

  // If the template is missing for any reason, keep the site usable:
  // send readers to the raw static page instead of erroring.
  if (!html) {
    res.statusCode = 302;
    res.setHeader('Location', `${BASE_URL}/article-view.html${slug ? ('?slug=' + encodeURIComponent(slug)) : ''}`);
    return res.end();
  }

  // 3. Inject the personalized tags.
  const pageUrl = `${BASE_URL}/article.html${slug ? ('?slug=' + encodeURIComponent(slug)) : ''}`;
  if (a) {
    const title = escHtml(a.title || 'Right Side Talks');
    const desc = escHtml(a.excerpt || ('Opinion & commentary by ' + (a.author || 'Right Side Talks') + '.'));
    const imageFile = AUTHOR_IMAGES[a.author] ? ('images/' + AUTHOR_IMAGES[a.author]) : DEFAULT_IMAGE;
    const image = `${BASE_URL}/${imageFile}`;

    html = html.replace(/<title>[^<]*<\/title>/, '<title>' + title + ' | Right Side Talks</title>');
    html = setMetaById(html, 'og-title', title);
    html = setMetaById(html, 'og-description', desc);
    html = setMetaById(html, 'og-image', image);
    html = setMetaById(html, 'og-url', escHtml(pageUrl));

    // Authoritative Twitter/X tags (inserted fresh so X shows the right card too).
    const twitterBlock =
      '<meta name="twitter:title" content="' + title + '" />\n' +
      '<meta name="twitter:description" content="' + desc + '" />\n' +
      '<meta name="twitter:image" content="' + image + '" />\n';
    html = html.replace('</head>', twitterBlock + '</head>');
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache found articles briefly; never cache misses.
  res.setHeader('Cache-Control', a ? 'public, max-age=300, s-maxage=300' : 'no-store');
  res.end(html);
};
