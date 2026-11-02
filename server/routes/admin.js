const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const AuditService = require('../services/auditService');

// 1. Users List & Management
router.get('/users', async (req, res) => {
    try {
        const users = await db.prepare(`
            SELECT id, username, email, full_name, role, department, is_active, last_login, created_at
            FROM users
            ORDER BY id ASC
        `).all();
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/users', async (req, res) => {
    try {
        const { username, email, password, full_name, role = 'Accountant', department } = req.body;
        if (!username || !email || !password || !full_name) {
            return res.status(400).json({ success: false, error: 'Username, Email, Password, and Full Name are required.' });
        }

        const validRoles = ['Super Admin', 'Admin', 'Finance Manager', 'Accountant', 'Auditor', 'Viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        }

        const exists = await db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
        if (exists) {
            return res.status(400).json({ success: false, error: 'User with this username or email already exists.' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);

        const stmt = db.prepare(`
            INSERT INTO users (username, email, password_hash, full_name, role, department)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = await stmt.run(username, email, hash, full_name, role, department || null);

        await AuditService.log({
            username: req.user ? req.user.username : 'Admin',
            action: 'CREATE_USER',
            entity: 'User',
            entityId: result.lastInsertRowid,
            details: { username, role }
        });

        res.json({ success: true, id: result.lastInsertRowid, message: `User ${username} created.` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Company Profile
router.get('/company', async (req, res) => {
    try {
        const company = await db.prepare('SELECT * FROM companies LIMIT 1').get();
        res.json({ success: true, company });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/company', async (req, res) => {
    try {
        const { name, legal_name, tax_id, currency, address, city, country, phone, email } = req.body;
        await db.prepare(`
            UPDATE companies
            SET name = ?, legal_name = ?, tax_id = ?, currency = ?, address = ?, city = ?, country = ?, phone = ?, email = ?
            WHERE id = 1
        `).run(name, legal_name, tax_id, currency, address, city, country, phone, email);

        await AuditService.log({
            username: req.user ? req.user.username : 'Admin',
            action: 'UPDATE_COMPANY',
            entity: 'Company',
            entityId: 1,
            details: { name, tax_id }
        });

        res.json({ success: true, message: 'Company settings updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Fiscal Years
router.get('/fiscal-years', async (req, res) => {
    try {
        const years = await db.prepare('SELECT * FROM fiscal_years ORDER BY start_date DESC').all();
        res.json({ success: true, fiscalYears: years });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/fiscal-years', async (req, res) => {
    try {
        const { name, start_date, end_date } = req.body;
        if (!name || !start_date || !end_date) {
            return res.status(400).json({ success: false, error: 'Name, Start Date, and End Date are required.' });
        }

        const stmt = db.prepare(`
            INSERT INTO fiscal_years (company_id, name, start_date, end_date, is_closed, is_active)
            VALUES (1, ?, ?, ?, 0, 1)
        `);
        const result = await stmt.run(name, start_date, end_date);
        res.json({ success: true, id: result.lastInsertRowid, message: 'Fiscal Year created.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Close a Fiscal Year (Year-End Close Entry)
router.post('/fiscal-years/:id/close', async (req, res) => {
    try {
        const fy = await db.prepare('SELECT * FROM fiscal_years WHERE id = ?').get(req.params.id);
        if (!fy) return res.status(404).json({ success: false, error: 'Fiscal Year not found.' });
        if (fy.is_closed) return res.status(400).json({ success: false, error: 'Fiscal Year is already closed.' });

        await db.prepare('UPDATE fiscal_years SET is_closed = 1, closed_at = CURRENT_TIMESTAMP WHERE id = ?').run(fy.id);

        await AuditService.log({
            username: req.user ? req.user.username : 'Admin',
            action: 'CLOSE_FISCAL_YEAR',
            entity: 'FiscalYear',
            entityId: fy.id,
            details: { name: fy.name }
        });

        res.json({ success: true, message: `Fiscal Year ${fy.name} has been closed and transactions locked.` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Audit Trail Logs
router.get('/audit-logs', async (req, res) => {
    try {
        const { limit = 50, offset = 0, entity, action, username } = req.query;
        const result = await AuditService.getLogs({
            limit: Number(limit),
            offset: Number(offset),
            entity,
            action,
            username
        });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Database Status
router.get('/backup', async (req, res) => {
    res.json({ success: true, message: 'Supabase PostgreSQL cloud database is active and managed automatically.' });
});

module.exports = router;
