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
    return new Response(JSON.stringify({ error: 'Failed to add to corpus' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}