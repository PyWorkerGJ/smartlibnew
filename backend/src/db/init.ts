import { runMigrations } from './migrate.js';
import { runSeeds } from './seed.js';
import { pool } from './pool.js';

async function main() {
  try {
    await runMigrations();
    await runSeeds();
    console.log('Database initialization and seeding completed successfully!');
  } catch (err) {
    console.error('Database migration/seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
