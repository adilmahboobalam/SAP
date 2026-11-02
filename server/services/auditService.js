const db = require('../db/database');

class AuditService {
    /**
     * Log an action to the audit trail
     */
    static log({ userId = null, username = 'System', action, entity, entityId = null, details = null, ipAddress = '127.0.0.1' }) {
        try {
            const stmt = db.prepare(`
                INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');
            stmt.run(userId, username, action, entity, String(entityId || ''), detailsStr, ipAddress);
        } catch (err) {
            console.error('Audit logging failed:', err.message);
        }
    }

    /**
     * Retrieve recent audit logs with pagination & filtering
     */
    static getLogs({ limit = 50, offset = 0, entity = null, action = null, username = null } = {}) {
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];

        if (entity) {
            query += ' AND entity = ?';
            params.push(entity);
        }
        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }
        if (username) {
            query += ' AND username = ?';
            params.push(username);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const rows = db.prepare(query).all(...params);
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count').split('ORDER BY')[0];
        const total = db.prepare(countQuery).get(...params.slice(0, params.length - 2)).count;

        return { rows, total, limit, offset };
    }
}

module.exports = AuditService;
