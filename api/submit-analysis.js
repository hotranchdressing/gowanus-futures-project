const { neon } = require('@neondatabase/serverless');

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
    const { question, answer, contamination, timestamp } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }

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

    // Insert analysis
    const result = await sql`
      INSERT INTO oracle_analyses (question, answer, contamination, created_at)
      VALUES (${question}, ${answer}, ${contamination || 50}, ${timestamp || 'NOW()'})
      RETURNING id
    `;

    return res.status(200).json({
      success: true,
      id: result[0].id
    });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Failed to save analysis' });
  }
};
