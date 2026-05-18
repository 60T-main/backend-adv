const { Redis } = require('@upstash/redis');
const { Resend } = require('resend');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const resend = new Resend(process.env.RESEND_API_KEY);

const LIST_KEY = 'gahs:rsvps';

module.exports = async function handler(req, res) {
  // Protect: only Vercel Cron (or manual calls with the secret) may trigger this
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const raw = await redis.lrange(LIST_KEY, 0, -1);
  const rsvps = raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);

  const confirmed = rsvps.filter(r => r.attendance === 'yes');
  const declined  = rsvps.filter(r => r.attendance === 'no');
  const totalGuests = confirmed.reduce((sum, r) => sum + (r.guestCount || 0), 0);

  const rows = rsvps.map(r => {
    const full = [r.name, r.surname].filter(Boolean).join(' ');
    const att  = r.attendance === 'yes' ? '✅ დიახ' : '❌ არა';
    const gc   = r.guestCount !== null ? r.guestCount : '—';
    const date = new Date(r.submittedAt).toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi' });
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${full}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${att}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${gc}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${date}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;opacity:0;">RSVP დიჯესტი &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;">
      <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;">
        <h2 style="margin:0;font-size:20px;">GAHS — RSVP დიჯესტი</h2>
        <p style="margin:6px 0 0;opacity:0.7;font-size:13px;">${new Date().toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi' })}</p>
      </div>

      <table width="100%" style="border:1px solid #e5e7eb;border-top:none;border-collapse:collapse;background:#f8fafc;">
        <tr style="display:flex; flex-direction:row; gap:2rem">
          <td style="text-align:center;padding:20px 16px;border-right:1px solid #e5e7eb;">
            <div style="font-size:32px;font-weight:bold;color:#16a34a;">${confirmed.length}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">დადასტურებული</div>
          </td>
          <td style="text-align:center;padding:20px 16px;border-right:1px solid #e5e7eb;">
            <div style="font-size:32px;font-weight:bold;color:#dc2626;">${declined.length}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">უარი</div>
          </td>
          <td style="text-align:center;padding:20px 16px;border-right:1px solid #e5e7eb;">
            <div style="font-size:32px;font-weight:bold;color:#2563eb;">${totalGuests}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">სულ სტუმარი</div>
          </td>
          <td style="text-align:center;padding:20px 16px;">
            <div style="font-size:32px;font-weight:bold;color:#7c3aed;">${rsvps.length}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:4px;">სულ პასუხი</div>
          </td>
        </tr>
      </table>

      ${rsvps.length === 0 ? '<p style="padding:24px;text-align:center;color:#6b7280;">პასუხი ჯერ არ არის.</p>' : `
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;font-weight:600;">სახელი</th>
            <th style="padding:10px 12px;text-align:center;font-size:13px;color:#6b7280;font-weight:600;">პასუხი</th>
            <th style="padding:10px 12px;text-align:center;font-size:13px;color:#6b7280;font-weight:600;">სტუმრები</th>
            <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;font-weight:600;">თარიღი</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div></body></html>`;

  const result = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: process.env.TO_EMAIL,
    subject: `GAHS RSVP — ${confirmed.length} დადასტურებული, ${rsvps.length} სულ`,
    html,
  });

  if (result?.error) {
    return res.status(502).json({ ok: false, error: result.error.message });
  }

  return res.status(200).json({ ok: true, total: rsvps.length, confirmed: confirmed.length });
};
