/**
 * Database Migration Status Checker
 * Shows which migrations have been applied
 */

import Database from 'better-sqlite3';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || join(__dirname, 'bengali_curriculam.db');
const MIGRATIONS_DIR = join(__dirname, 'migrations');

console.log('🗄️  Bengali Math Migration Status');
console.log('=====================================\n');

const db = new Database(DB_PATH, { readonly: true });

// Check if migrations table exists
const tableExists = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name='schema_migrations'
`).get();

if (!tableExists) {
  console.log('⚠️  No migrations have been run yet.');
  console.log('💡 Run "npm run migrate" to apply migrations.\n');
  db.close();
  process.exit(0);
}

// Get applied migrations
const applied = db.prepare(`
  SELECT migration_file, applied_at
  FROM schema_migrations
  ORDER BY id
`).all();

const appliedSet = new Set(applied.map(m => m.migration_file));

// Get all migration files
const allMigrations = readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log('Migration Status:');
console.log('-------------------------------------\n');

for (const file of allMigrations) {
  if (appliedSet.has(file)) {
    const migration = applied.find(m => m.migration_file === file);
    const date = new Date(migration.applied_at).toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    console.log(`✅ ${file}`);
    console.log(`   Applied: ${date}\n`);
  } else {
    console.log(`⏸️  ${file}`);
    console.log(`   Status: Pending\n`);
  }
}

console.log('-------------------------------------');
console.log(`Total migrations: ${allMigrations.length}`);
console.log(`Applied: ${applied.length}`);
console.log(`Pending: ${allMigrations.length - applied.length}\n`);

db.close();
