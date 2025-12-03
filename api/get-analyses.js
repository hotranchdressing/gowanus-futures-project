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
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not configured, returning mock data');
      // Return mock data for testing
      return res.status(200).json({
        analyses: [
          {
            id: 1,
            question: "Will the Gowanus Canal be clean by 2050?",
            answer: "The remediation timeline extends beyond initial projections. Sediment layers reveal decades of industrial memory. Future communities may negotiate with contamination rather than eliminate it entirely.",
            contamination: 65,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString()
          },
          {
            id: 2,
            question: "What will happen to displaced residents?",
            answer: "Luxury developments promise progress while erasing working-class histories. The wellness center overlooks toxic waters. Gentrification becomes the final stage of industrial cleanup.",
            contamination: 78,
            created_at: new Date(Date.now() - 86400000 * 5).toISOString()
          },
          {
            id: 3,
            question: "How will climate change affect the cleanup?",
            answer: "Rising waters complicate containment strategies. Storm surges may redistribute buried toxins across neighborhoods. The canal becomes a climate warning written in heavy metals.",
            contamination: 82,
            created_at: new Date(Date.now() - 86400000 * 7).toISOString()
          },
          {
            id: 4,
            question: "What role does community input play?",
            answer: "Public meetings perform transparency while decisions solidify elsewhere. Local knowledge confronts technical expertise. The future emerges from these contested conversations.",
            contamination: 55,
            created_at: new Date(Date.now() - 86400000 * 10).toISOString()
          },
          {
            id: 5,
            question: "Will the smell ever disappear?",
            answer: "Christmas scents spray over sewage overflow. Olfactory memories persist beyond remediation timelines. Future noses may detect traces of what was buried here.",
            contamination: 45,
            created_at: new Date(Date.now() - 86400000 * 12).toISOString()
          }
        ]
      });
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
    return res.status(200).json({
      error: 'Failed to fetch analyses',
      analyses: []
    });
  }
};
