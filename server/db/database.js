const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'accounting.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Initialize database connection
const db = new Database(DB_PATH);

// Configure SQLite for high performance, consistency and WAL mode
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Run schema if tables don't exist
function initDb() {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schemaSql);
}

initDb();

module.exports = db;
