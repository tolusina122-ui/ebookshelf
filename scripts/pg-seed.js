#!/usr/bin/env node
const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL must be set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log('🌱 Seeding via pg client...');

    // Create admin if not exists
    const res = await client.query('SELECT id FROM admins WHERE username = $1', ['admin']);
    if (res.rowCount === 0) {
      const hashed = await bcrypt.hash('admin123', 10);
      await client.query('INSERT INTO admins (username, password) VALUES ($1, $2)', ['admin', hashed]);
      console.log('✅ Admin created');
    } else {
      console.log('ℹ️  Admin exists');
    }

    // Sample books
    const booksRes = await client.query('SELECT id FROM books LIMIT 1');
    if (booksRes.rowCount === 0) {
      const sampleBooks = [
        ['The Art of Programming', 'Master the fundamentals of software development with this comprehensive guide to programming principles and best practices.', '50.00', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=600&fit=crop', 'https://example.com/downloads/art-of-programming.pdf', 'Technology'],
        ['Digital Marketing Mastery', 'Learn proven strategies to grow your business online with modern digital marketing techniques and tools.', '30.00', 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=400&h=600&fit=crop', 'https://example.com/downloads/digital-marketing.pdf', 'Business'],
        ['The Creative Mind', 'Unlock your creative potential with exercises and insights from the world\'s most innovative thinkers.', '25.00', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop', 'https://example.com/downloads/creative-mind.pdf', 'Self-Help'],
      ];

      for (const b of sampleBooks) {
        await client.query(
          'INSERT INTO books (title, description, price, cover_image, download_url, category) VALUES ($1, $2, $3, $4, $5, $6)',
          b,
        );
      }
      console.log('✅ Sample books created');
    } else {
      console.log('ℹ️  Books already exist');
    }

    console.log('✨ Seeding complete');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
