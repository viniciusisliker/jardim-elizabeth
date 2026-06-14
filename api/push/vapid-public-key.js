export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(503).json({ error: 'push_not_configured' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ publicKey });
}
