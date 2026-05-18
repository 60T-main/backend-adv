const { Redis } = require('@upstash/redis');
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const LIST_KEY = 'gahs:rsvps';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const { name, surname, attendance, guestCount } = body;

  if (!name || !attendance) {
    return res.status(400).json({ ok: false, error: 'Missing fields: name and attendance are required' });
  }

  const entry = {
    name: String(name).trim(),
    surname: surname ? String(surname).trim() : '',
    attendance: String(attendance).toLowerCase() === 'yes' ? 'yes' : 'no',
    guestCount: (guestCount !== undefined && guestCount !== null && guestCount !== '') ? Number(guestCount) : null,
    submittedAt: new Date().toISOString(),
  };

  await redis.rpush(LIST_KEY, entry);

  return res.status(200).json({ ok: true });
};
