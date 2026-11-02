const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const SOURCE_DB = path.join(__dirname, 'accounting.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let DB_PATH;
if (process.env.VERCEL) {
    // Vercel serverless environment has a read-only filesystem except /tmp
    DB_PATH = path.join('/tmp', 'accounting.db');
    if (!fs.existsSync(DB_PATH) && fs.existsSync(SOURCE_DB)) {
        try {
            fs.copyFileSync(SOURCE_DB, DB_PATH);
        } catch (e) {
            console.error('Error copying database to /tmp:', e);
        }
    }
} else {
    DB_PATH = SOURCE_DB;
}

// Initialize database connection
const db = new Database(DB_PATH);

// Configure SQLite
if (!process.env.VERCEL) {
    db.pragma('journal_mode = WAL');
} else {
    db.pragma('journal_mode = DELETE');
}
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Run schema if tables don't exist
function initDb() {
    if (fs.existsSync(SCHEMA_PATH)) {
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schemaSql);
    }
}

initDb();

module.exports = db;
