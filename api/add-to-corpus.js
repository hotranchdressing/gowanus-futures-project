import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { text, type, timestamp } = await req.json();
    
    const sql = neon(process.env.DATABASE_URL);
    
    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS oracle_corpus (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        source_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Insert into corpus table
    await sql`
      INSERT INTO oracle_corpus (text, source_type, created_at)
      VALUES (${text}, ${type}, ${timestamp || new Date().toISOString()})
    `;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error adding to corpus:', error);
    return new Response(JSON.stringify({ error: 'Failed to add to corpus', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}