module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const CHANNEL_ID = 'UCpbgusSKZhNJphR0HOHPJ0Q';
  const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  function parseXML(xml) {
    if (!xml || !xml.includes('<entry>')) return [];
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null && entries.length < 10) {
      const entry = match[1];
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/);
      const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
      const videoIdMatch = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/);
      if (titleMatch && linkMatch) {
        entries.push({
          title: titleMatch[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim(),
          link: linkMatch[1],
          pubDate: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
          videoId: videoIdMatch ? videoIdMatch[1] : null
        });
      }
    }
    return entries;
  }

  // Try allorigins proxy
  try {
    const r1 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(RSS_URL)}`);
    if (r1.ok) {
      const d = await r1.json();
      const entries = parseXML(d.contents || '');
      if (entries.length) {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ channelId: CHANNEL_ID, items: entries });
      }
    }
  } catch(e) {}

  // Try direct fetch
  try {
    const r2 = await fetch(RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept': '*/*'
      }
    });
    if (r2.ok) {
      const xml = await r2.text();
      const entries = parseXML(xml);
      if (entries.length) {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ channelId: CHANNEL_ID, items: entries });
      }
    }
  } catch(e) {}

  return res.status(502).json({ error: 'RSS fetch failed', items: [] });
};
