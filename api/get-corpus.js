import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Get all corpus entries
    const corpus = await sql`
      SELECT text, source_type, created_at
      FROM oracle_corpus
      ORDER BY created_at DESC
    `;

    return new Response(JSON.stringify({ corpus }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching corpus:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch corpus' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}