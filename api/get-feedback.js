const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.POSTGRES_URL);
    
    const feedback = await sql`
      SELECT id, comment, created_at
      FROM feedback
      ORDER BY created_at DESC
    `;

    return res.status(200).json({ 
      feedback: feedback,
      count: feedback.length
    });

  } catch (error) {
    console.error('Get feedback error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve feedback'
    });
  }
};