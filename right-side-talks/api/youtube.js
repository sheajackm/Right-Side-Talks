module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const CHANNEL_ID = 'UCpbgusSKZhNJphR0HOHPJ0Q';
  const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
  const RSS2JSON = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}&count=10&api_key=ac2p6lozcdlgcsb98uv9ofuzuudcqtec15cm7vcx`;

  // Try rss2json first (most reliable)
  try {
    const r1 = await fetch(RSS2JSON);
    if (r1.ok) {
      const d = await r1.json();
      if (d.items && d.items.length) {
        const items = d.items.map(i => ({
          title: i.title,
          link: i.link,
          pubDate: i.pubDate,
          videoId: i.link ? (i.link.match(/[?&]v=([^&]+)/) || [])[1] : null
        }));
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ channelId: CHANNEL_ID, items });
      }
    }
  } catch(e) {}

  // Fallback: try YouTube RSS directly with different headers
  try {
    const r2 = await fetch(RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      }
    });

    if (r2.ok) {
      const rssText = await r2.text();
      const entries = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;

      while ((match = entryRegex.exec(rssText)) !== null && entries.length < 10) {
        const entry = match[1];
        const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/);
        const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
        const videoIdMatch = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/);

        if (titleMatch && linkMatch) {
          entries.push({
            title: titleMatch[1]
              .replace(/&amp;/g,'&').replace(/&lt;/g,'<')
              .replace(/&gt;/g,'>').replace(/&quot;/g,'"')
              .replace(/&#39;/g,"'").trim(),
            link: linkMatch[1],
            pubDate: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
            videoId: videoIdMatch ? videoIdMatch[1] : null
          });
        }
      }

      if (entries.length) {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ channelId: CHANNEL_ID, items: entries });
      }
    }
  } catch(e) {}

  return res.status(502).json({ error: 'RSS fetch failed', items: [] });
};
