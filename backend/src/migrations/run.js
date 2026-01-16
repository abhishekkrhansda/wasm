/**
 * Database migration script for WACMS
 * Run with: npm run migrate
 */
require('dotenv').config();
const { pool } = require('../config/db');

const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('requester', 'analyst', 'manager', 'admin')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Cases table
  `CREATE TABLE IF NOT EXISTS cases (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('IT', 'HR', 'Finance', 'Compliance', 'Other')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status VARCHAR(30) NOT NULL DEFAULT 'Created',
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) NOT NULL,
    sla_due_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Case Audit Log - Immutable
  `CREATE TABLE IF NOT EXISTS case_audit_log (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(30),
    new_status VARCHAR(30),
    previous_assignee INTEGER REFERENCES users(id),
    new_assignee INTEGER REFERENCES users(id),
    performed_by INTEGER REFERENCES users(id) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
  )`,

  // Comments table
  `CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    comment TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)`,
  `CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to)`,
  `CREATE INDEX IF NOT EXISTS idx_cases_created_by ON cases(created_by)`,
  `CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority)`,
  `CREATE INDEX IF NOT EXISTS idx_cases_category ON cases(category)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_case_id ON case_audit_log(case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_case_id ON comments(case_id)`,

  // Case ID sequence (for auto-generation)
  `CREATE SEQUENCE IF NOT EXISTS case_id_seq START 1000`
];

async function runMigrations(closePool = false) {
  console.log('🔄 Running database migrations...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const migration of migrations) {
      const shortQuery = migration.substring(0, 60).replace(/\s+/g, ' ');
      console.log(`  Running: ${shortQuery}...`);
      await client.query(migration);
    }

    await client.query('COMMIT');
    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    if (closePool) {
      await pool.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations(true)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runMigrations;
