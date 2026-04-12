/**
 * Database Migration Runner
 * Applies all SQL migrations in order to the Bengali Math database
 */

import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || join(__dirname, 'bengali_curriculam.db');
const MIGRATIONS_DIR = join(__dirname, 'migrations');

console.log('🗄️  Bengali Math Database Migration');
console.log('=====================================\n');
console.log(`Database: ${DB_PATH}`);
console.log(`Migrations: ${MIGRATIONS_DIR}\n`);

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create migrations tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_file TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Get list of already applied migrations
const appliedMigrations = db.prepare('SELECT migration_file FROM schema_migrations').all();
const appliedSet = new Set(appliedMigrations.map(m => m.migration_file));

// Get all migration files
const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Found ${migrationFiles.length} migration file(s)`);
console.log(`Already applied: ${appliedSet.size}\n`);

let appliedCount = 0;
let skippedCount = 0;

// Apply each migration
for (const file of migrationFiles) {
  if (appliedSet.has(file)) {
    console.log(`⏭️  Skipping ${file} (already applied)`);
    skippedCount++;
    continue;
  }

  console.log(`🔄 Applying ${file}...`);

  try {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

    // Execute in a transaction
    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (migration_file) VALUES (?)').run(file);
    });

    apply();

    console.log(`✅ Successfully applied ${file}\n`);
    appliedCount++;

  } catch (error) {
    console.error(`❌ Error applying ${file}:`);
    console.error(error.message);
    console.error('\nRolling back and stopping migration process.\n');
    process.exit(1);
  }
}

db.close();

console.log('\n=====================================');
console.log('📊 Migration Summary');
console.log('=====================================');
console.log(`✅ Applied: ${appliedCount}`);
console.log(`⏭️  Skipped: ${skippedCount}`);
console.log(`📁 Total: ${migrationFiles.length}`);
console.log('\n✨ Database migration completed successfully!\n');
