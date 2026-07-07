// Right Side Talks — combined YouTube feed
// Pulls uploads from multiple channels, merges them, and returns newest-first.
//
// IMPORTANT (quota): we read each channel's "uploads" playlist via
// playlistItems.list, which costs 1 quota unit per call — versus 100 units
// per call for the old search.list approach. Two channels = ~2 units per
// refresh instead of 200, so the daily 10,000-unit quota is no longer a concern.
// A channel's uploads playlist ID is just its channel ID with the "UC" prefix
// swapped for "UU" (e.g. UCabc... -> UUabc...).

const CHANNELS = [
  { id: 'UCpbgusSKZhNJphR0HOHPJ0Q', name: 'Right Side Talks' },
  { id: 'UCDx4aqBxdjpbjbZTJz9Wmvg', name: 'The Bottomline w/ Ryan McCombs' },
  { id: 'UCYxag04icPWcJNGHIw_bhaQ', name: 'Cecelia Talks Show' }
];

// Prefer the Vercel environment variable; fall back to the inline key so the
// feed keeps working until YOUTUBE_API_KEY is configured. Once it's set in Vercel
// (and the old key rotated/restricted), delete the inline string below.
const API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyCI_k6-RXSJEs9pGVWeTxVrc_Ec_qF6ix4';

const PER_CHANNEL = 15; // how many recent uploads to pull from each channel

const FALLBACK = [
  { title: "Right Side Talks with Special Guests! Part 2", link: "https://www.youtube.com/watch?v=kObxEZT2mPE", pubDate: "2026-01-23T06:43:07Z", videoId: "kObxEZT2mPE", thumbnail: "https://i.ytimg.com/vi/kObxEZT2mPE/hqdefault.jpg" },
  { title: "Right Side Talks with Special Guests! Part 1", link: "https://www.youtube.com/watch?v=1YPE6lVgebc", pubDate: "2026-01-23T05:34:56Z", videoId: "1YPE6lVgebc", thumbnail: "https://i.ytimg.com/vi/1YPE6lVgebc/hqdefault.jpg" },
  { title: "Episode 3 Right Side Talks", link: "https://www.youtube.com/watch?v=7YVVcescVr8", pubDate: "2026-01-01T23:21:39Z", videoId: "7YVVcescVr8", thumbnail: "https://i.ytimg.com/vi/7YVVcescVr8/hqdefault.jpg" },
  { title: "The America First Vs. MAGA Civil War | Right Side Talks EP. 2", link: "https://www.youtube.com/watch?v=tT2QNdeNEcY", pubDate: "2025-12-08T07:18:49Z", videoId: "tT2QNdeNEcY", thumbnail: "https://i.ytimg.com/vi/tT2QNdeNEcY/hqdefault.jpg" },
  { title: "Right Side Talks Episode 1", link: "https://www.youtube.com/watch?v=JpuEpUtthxs", pubDate: "2025-11-25T02:17:52Z", videoId: "JpuEpUtthxs", thumbnail: "https://i.ytimg.com/vi/JpuEpUtthxs/hqdefault.jpg" }
];

// In-memory cache — persists between requests on the same warm server instance.
let cache = { items: null, timestamp: 0 };
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

// Turn a channel ID into its uploads-playlist ID (UC... -> UU...).
function uploadsPlaylistId(channelId) {
  return 'UU' + channelId.slice(2);
}

// Fetch recent uploads for a single channel. Returns [] on any failure so one
// bad channel never takes down the whole feed.
async function fetchChannelUploads(channel) {
  try {
    const playlistId = uploadsPlaylistId(channel.id);
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${API_KEY}&playlistId=${playlistId}&part=snippet,contentDetails&maxResults=${PER_CHANNEL}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    if (!r.ok || data.error) return [];
    return (data.items || []).map(item => {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      // contentDetails.videoPublishedAt is the true upload time; snippet.publishedAt
      // is when it was added to the playlist (same thing for uploads, but prefer the former).
      const pubDate = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt;
      const sn = item.snippet || {};
      return {
        title: sn.title,
        link: `https://www.youtube.com/watch?v=${videoId}`,
        pubDate,
        videoId,
        thumbnail: sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url,
        channel: channel.name
      };
    }).filter(v => v.videoId && v.title && v.title !== 'Deleted video' && v.title !== 'Private video');
  } catch (e) {
    return [];
  }
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Serve fresh cache if available.
  const now = Date.now();
  if (cache.items && (now - cache.timestamp) < CACHE_DURATION) {
    res.setHeader('Cache-Control', 'public, max-age=21600');
    return res.status(200).json({ channels: CHANNELS.map(c => c.id), items: cache.items, source: 'cache' });
  }

  try {
    // Pull every channel in parallel, then merge + sort newest-first.
    const perChannel = await Promise.all(CHANNELS.map(fetchChannelUploads));
    let items = perChannel.flat();
    items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    if (items.length) {
      cache = { items, timestamp: now };
      res.setHeader('Cache-Control', 'public, max-age=21600');
      return res.status(200).json({ channels: CHANNELS.map(c => c.id), items, source: 'api' });
    }

    // Nothing came back from the API — use stale cache, then hardcoded fallback.
    const fallbackItems = cache.items || FALLBACK;
    return res.status(200).json({ channels: CHANNELS.map(c => c.id), items: fallbackItems, source: 'fallback' });
  } catch (e) {
    const fallbackItems = cache.items || FALLBACK;
    return res.status(200).json({ channels: CHANNELS.map(c => c.id), items: fallbackItems, source: 'fallback' });
  }
};
