const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const AuditService = require('../services/auditService');

// 1. Users List & Management
router.get('/users', (req, res) => {
    try {
        const users = db.prepare(`
            SELECT id, username, email, full_name, role, department, is_active, last_login, created_at
            FROM users
            ORDER BY id ASC
        `).all();
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/users', (req, res) => {
    try {
        const { username, email, password, full_name, role = 'Accountant', department } = req.body;
        if (!username || !email || !password || !full_name) {
            return res.status(400).json({ success: false, error: 'Username, Email, Password, and Full Name are required.' });
        }

        const validRoles = ['Super Admin', 'Admin', 'Finance Manager', 'Accountant', 'Auditor', 'Viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
        }

        const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
        if (exists) {
            return res.status(400).json({ success: false, error: 'User with this username or email already exists.' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);

        const stmt = db.prepare(`
            INSERT INTO users (username, email, password_hash, full_name, role, department)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(username, email, hash, full_name, role, department || null);

        AuditService.log({
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
router.get('/company', (req, res) => {
    try {
        const company = db.prepare('SELECT * FROM companies LIMIT 1').get();
        res.json({ success: true, company });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/company', (req, res) => {
    try {
        const { name, legal_name, tax_id, currency, address, city, country, phone, email } = req.body;
        db.prepare(`
            UPDATE companies
            SET name = ?, legal_name = ?, tax_id = ?, currency = ?, address = ?, city = ?, country = ?, phone = ?, email = ?
            WHERE id = 1
        `).run(name, legal_name, tax_id, currency, address, city, country, phone, email);

        AuditService.log({
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
router.get('/fiscal-years', (req, res) => {
    try {
        const years = db.prepare('SELECT * FROM fiscal_years ORDER BY start_date DESC').all();
        res.json({ success: true, fiscalYears: years });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/fiscal-years', (req, res) => {
    try {
        const { name, start_date, end_date } = req.body;
        if (!name || !start_date || !end_date) {
            return res.status(400).json({ success: false, error: 'Name, Start Date, and End Date are required.' });
        }

        const stmt = db.prepare(`
            INSERT INTO fiscal_years (company_id, name, start_date, end_date, is_closed, is_active)
            VALUES (1, ?, ?, ?, 0, 1)
        `);
        const result = stmt.run(name, start_date, end_date);
        res.json({ success: true, id: result.lastInsertRowid, message: 'Fiscal Year created.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Close a Fiscal Year (Year-End Close Entry)
router.post('/fiscal-years/:id/close', (req, res) => {
    try {
        const fy = db.prepare('SELECT * FROM fiscal_years WHERE id = ?').get(req.params.id);
        if (!fy) return res.status(404).json({ success: false, error: 'Fiscal Year not found.' });
        if (fy.is_closed) return res.status(400).json({ success: false, error: 'Fiscal Year is already closed.' });

        db.prepare('UPDATE fiscal_years SET is_closed = 1, closed_at = CURRENT_TIMESTAMP WHERE id = ?').run(fy.id);

        AuditService.log({
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
router.get('/audit-logs', (req, res) => {
    try {
        const { limit = 50, offset = 0, entity, action, username } = req.query;
        const result = AuditService.getLogs({
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

// 5. Database Backup
router.get('/backup', (req, res) => {
    try {
        const dbPath = path.join(__dirname, '../db/accounting.db');
        const backupPath = path.join(__dirname, `../db/backup-${Date.now()}.db`);
        fs.copyFileSync(dbPath, backupPath);

        res.download(backupPath, 'AuraERP_Accounting_Backup.db', (err) => {
            try { fs.unlinkSync(backupPath); } catch (e) {}
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
