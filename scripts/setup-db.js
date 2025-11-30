const { neon } = require('@neondatabase/serverless');

async function setupDatabase() {
  const sql = neon(process.env.POSTGRES_URL);
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    console.log('✓ Feedback table created successfully!');
    
    // Test insert
    await sql`
      INSERT INTO feedback (comment) 
      VALUES ('Test comment from setup')
    `;
    
    console.log('✓ Test comment inserted!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

setupDatabase();