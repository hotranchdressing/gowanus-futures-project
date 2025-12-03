const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_analyses (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        contamination INTEGER DEFAULT 50,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Get recent analyses (last 50)
    const analyses = await sql`
      SELECT id, question, answer, contamination, created_at
      FROM oracle_analyses
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return res.status(200).json({
      analyses: analyses
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      error: 'Failed to fetch analyses',
      analyses: []
    });
  }
};
