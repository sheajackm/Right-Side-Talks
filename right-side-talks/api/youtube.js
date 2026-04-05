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

  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(RSS_URL)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(RSS_URL)}`,
    `https://corsproxy.io/?${encodeURIComponent(RSS_URL)}`,
    `https://proxy.cors.sh/${RSS_URL}`,
  ];

  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'x-cors-api-key': 'temp_' },
        signal: AbortSignal.timeout(8000)
      });
      if (!r.ok) continue;

      let xml = '';
      if (proxy.includes('allorigins.win/get')) {
        const d = await r.json();
        xml = d.contents || '';
      } else {
        xml = await r.text();
      }

      const entries = parseXML(xml);
      if (entries.length) {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ channelId: CHANNEL_ID, items: entries });
      }
    } catch(e) { continue; }
  }

  // Last resort: direct fetch
  try {
    const r = await fetch(RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) {
      const xml = await r.text();
      const entries = parseXML(xml);
      if (entries.length) {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ channelId: CHANNEL_ID, items: entries });
      }
    }
  } catch(e) {}

  return res.status(502).json({ error: 'All proxies failed', items: [] });
};
