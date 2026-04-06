const POLLS = [
  // ── BREAKING polls jump to front immediately when breaking: true ──
  // Set breaking: true on any poll to make it the current poll right now.
  // Only ONE poll should have breaking: true at a time.

  // ── SCHEDULED polls run in order by start date ──
  {
    id: 'poll_001',
    question: 'Should the federal government defund NPR and PBS?',
    options: ['Yes — cut the funding completely', 'No — keep public broadcasting', 'Reform it, don\'t kill it'],
    start: '2025-11-01'
  },
  {
    id: 'poll_002',
    question: 'Should the US continue sending aid to Ukraine?',
    options: ['Yes — stand with our allies', 'No — America First', 'Only non-military aid'],
    start: '2026-04-07'
  },
  {
    id: 'poll_003',
    question: 'Should the US build a permanent military base on the southern border?',
    options: ['Yes — secure the border now', 'No — too extreme', 'Only temporarily'],
    start: '2026-04-14'
  },
  {
    id: 'poll_004',
    question: 'Should colleges that restrict free speech lose federal funding?',
    options: ['Yes — protect the First Amendment', 'No — let schools decide', 'Only public universities'],
    start: '2026-04-21'
  },
  {
    id: 'poll_005',
    question: 'Should the US withdraw from the United Nations?',
    options: ['Yes — put America first', 'No — stay engaged globally', 'Reform it but stay in'],
    start: '2026-04-28'
  },
  {
    id: 'poll_006',
    question: 'Should voter ID be required in all US elections?',
    options: ['Yes — protect election integrity', 'No — it suppresses votes', 'Only for federal elections'],
    start: '2026-05-05'
  },
  {
    id: 'poll_007',
    question: 'Should the federal minimum wage be eliminated entirely?',
    options: ['Yes — let the market decide', 'No — workers need protection', 'Leave it to the states'],
    start: '2026-05-12'
  },
  {
    id: 'poll_008',
    question: 'Should the Department of Education be abolished?',
    options: ['Yes — return power to states', 'No — federal standards matter', 'Shrink it but keep it'],
    start: '2026-05-19'
  },
];

function getCurrentPoll() {
  // BREAKING poll always wins — jumps to front of queue
  const breaking = POLLS.find(p => p.breaking === true);
  if (breaking) return breaking;

  // Otherwise pick the most recent scheduled poll
  const now = new Date();
  let current = POLLS[0];
  for (const poll of POLLS) {
    if (!poll.breaking && new Date(poll.start) <= now) current = poll;
    else if (!poll.breaking) break;
  }
  return current;
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const poll = getCurrentPoll();

  async function kvGet(key) {
    const r = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const d = await r.json();
    return d.result ? parseInt(d.result) : 0;
  }

  async function kvIncr(key) {
    await fetch(`${KV_URL}/incr/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
  }

  async function getVotes() {
    const [v0, v1, v2] = await Promise.all([
      kvGet(`${poll.id}:0`),
      kvGet(`${poll.id}:1`),
      kvGet(`${poll.id}:2`),
    ]);
    return [v0, v1, v2];
  }

  // GET — return current poll + votes
  if (req.method === 'GET') {
    try {
      const votes = await getVotes();
      return res.status(200).json({
        pollId: poll.id,
        question: poll.question,
        options: poll.options,
        breaking: poll.breaking || false,
        votes,
        total: votes.reduce((a,b) => a+b, 0)
      });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — cast a vote
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const idx = parseInt(body?.idx);
      const pollId = body?.pollId;

      if (pollId !== poll.id) {
        return res.status(400).json({ error: 'Poll has changed, please refresh' });
      }

      if (![0, 1, 2].includes(idx)) {
        return res.status(400).json({ error: 'Invalid vote index' });
      }

      await kvIncr(`${poll.id}:${idx}`);
      const votes = await getVotes();

      return res.status(200).json({
        pollId: poll.id,
        question: poll.question,
        options: poll.options,
        breaking: poll.breaking || false,
        votes,
        total: votes.reduce((a,b) => a+b, 0)
      });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
