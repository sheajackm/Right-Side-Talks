const PROJECT_ID = 'qy9hgtdq';
const DATASET = 'production';
const TOKEN = 'skdqbW5W2rA9HnPRTTMq6R0bzkPwFVGkCbbd4hSdp64BgrEedxFlLBKAbDvluFppjH327PoOIPoX56uP5xIncTIyZimvJfz3ADJ2xKnDzi3l0VqqnuOWivY3Gk5di5KEfKbkAmsTOPyDqtssloEb8ruVCaYi1DDztxjSObYL1TWaw9QRkwUF';

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');

  const { slug, id } = req.query;

  let groqQuery;

  if (slug) {
    // Single article by slug
    groqQuery = `*[_type == "article" && slug.current == "${slug}"][0] {
      _id,
      "slug": slug.current,
      title,
      "author": author->name,
      "authorRole": author->role,
      category,
      publishedAt,
      excerpt,
      "body": pt::text(body)
    }`;
  } else if (id) {
    // Single article by id
    groqQuery = `*[_type == "article" && _id == "${id}"][0] {
      _id,
      "slug": slug.current,
      title,
      "author": author->name,
      "authorRole": author->role,
      category,
      publishedAt,
      excerpt,
      "body": pt::text(body)
    }`;
  } else {
    // All articles
    groqQuery = `*[_type == "article"] | order(publishedAt desc) {
      _id,
      "slug": slug.current,
      title,
      "author": author->name,
      "authorRole": author->role,
      category,
      publishedAt,
      excerpt,
      "body": pt::text(body)
    }`;
  }

  const url = `https://${PROJECT_ID}.api.sanity.io/v2021-10-21/data/query/${DATASET}?query=${encodeURIComponent(groqQuery)}`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(8000)
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(502).json({ error: 'Sanity API error', detail: err, items: [], item: null });
    }

    const data = await r.json();

    if (slug || id) {
      return res.status(200).json({ item: data.result || null });
    }
    return res.status(200).json({ items: data.result || [] });

  } catch(e) {
    return res.status(500).json({ error: e.message, items: [], item: null });
  }
};
