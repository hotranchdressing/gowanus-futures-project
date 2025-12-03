const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if Pusher is configured
    if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY || !process.env.PUSHER_SECRET) {
      console.warn('Pusher not configured, skipping broadcast');
      return res.status(200).json({ success: true, warning: 'Broadcast disabled' });
    }

    const { id, question, answer, contamination, timestamp } = req.body;

    // Broadcast to all connected clients
    await pusher.trigger('gowanus-oracle', 'new-analysis', {
      id,
      question,
      answer,
      contamination,
      timestamp: timestamp || new Date().toISOString()
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Broadcast error:', error);
    return res.status(200).json({ success: true, warning: 'Broadcast failed' });
  }
};
