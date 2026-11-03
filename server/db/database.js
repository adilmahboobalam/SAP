const { Pool, types } = require('pg');
require('dotenv').config();

// Automatically parse PostgreSQL NUMERIC (1700) and BIGINT (20) into JS numbers
types.setTypeParser(1700, val => (val === null ? 0 : parseFloat(val)));
types.setTypeParser(20, val => (val === null ? 0 : parseInt(val, 10)));

function parseDatabaseConfig(rawUrl) {
    const defaults = {
        user: 'postgres',
        password: '@SAPmy522@?',
        host: 'db.srnjpgwpkkudkrjhwkzt.supabase.co',
        port: 5432,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    };

    if (!rawUrl) return defaults;

    let str = rawUrl.trim();
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        str = str.slice(1, -1).trim();
    }

    try {
        const parsed = new URL(str);
        const pass = decodeURIComponent(parsed.password || '');
        return {
            user: decodeURIComponent(parsed.username || defaults.user),
            password: (!pass || pass === '[YOUR-PASSWORD]') ? defaults.password : pass,
            host: parsed.hostname || defaults.host,
            port: parseInt(parsed.port || '5432', 10),
            database: (parsed.pathname ? parsed.pathname.replace(/^\//, '') : '') || defaults.database,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        };
    } catch (e) {
        // Fallback for unencoded characters in password (like '@' or '?')
        const match = str.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?\/([^?]+)(?:\?.*)?$/);
        if (match) {
            let pass = match[2];
            try { pass = decodeURIComponent(pass); } catch (err) {}
            return {
                user: decodeURIComponent(match[1]),
                password: (!pass || pass === '[YOUR-PASSWORD]') ? defaults.password : pass,
                host: match[3],
                port: parseInt(match[4] || '5432', 10),
                database: match[5],
                ssl: { rejectUnauthorized: false },
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000
            };
        }
    }

    return defaults;
}

const poolConfig = parseDatabaseConfig(process.env.DATABASE_URL);
const pool = new Pool(poolConfig);

function toPgSql(sql) {
    let index = 1;
    let pgSql = sql.replace(/\?/g, () => `$${index++}`);
    // Replace SQLite strftime with Postgres TO_CHAR
    pgSql = pgSql.replace(/strftime\('%Y-%m',\s*([^)]+)\)/gi, "TO_CHAR($1::timestamp, 'YYYY-MM')");
    pgSql = pgSql.replace(/strftime\('%m',\s*([^)]+)\)/gi, "TO_CHAR($1::timestamp, 'MM')");
    return pgSql;
}

const db = {
    pool,

    async query(text, params = []) {
        if (!pool) {
            throw new Error('Database connection pool is not configured. Please check DATABASE_URL.');
        }
        const pgText = toPgSql(text);
        return pool.query(pgText, params);
    },

    async get(sql, ...params) {
        const flatParams = Array.isArray(params[0]) && params.length === 1 ? params[0] : params;
        const res = await this.query(sql, flatParams);
        return res.rows && res.rows.length > 0 ? res.rows[0] : null;
    },

    async all(sql, ...params) {
        const flatParams = Array.isArray(params[0]) && params.length === 1 ? params[0] : params;
        const res = await this.query(sql, flatParams);
        return res.rows || [];
    },

    async run(sql, ...params) {
        const flatParams = Array.isArray(params[0]) && params.length === 1 ? params[0] : params;
        let querySql = sql.trim();
        if (/^\s*insert\s+into/i.test(querySql) && !/returning/i.test(querySql)) {
            querySql += ' RETURNING id';
        }
        const res = await this.query(querySql, flatParams);
        const lastInsertRowid = res.rows && res.rows.length > 0 ? res.rows[0].id : null;
        return {
            lastInsertRowid,
            changes: res.rowCount
        };
    },

    prepare(sql) {
        const self = this;
        return {
            async get(...params) {
                return self.get(sql, ...params);
            },
            async all(...params) {
                return self.all(sql, ...params);
            },
            async run(...params) {
                return self.run(sql, ...params);
            }
        };
    },

    transaction(fn) {
        return async (...args) => {
            return await fn(...args);
        };
    },

    async exec(sql) {
        if (!pool) throw new Error('Database pool not configured.');
        return pool.query(sql);
    },

    pragma() {
        // SQLite pragma compatibility no-op
    }
};

module.exports = db;
