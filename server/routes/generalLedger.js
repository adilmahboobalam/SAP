const express = require('express');
const router = express.Router();
const db = require('../db/database');
const AccountingEngine = require('../services/accountingEngine');
const ReportsService = require('../services/reportsService');
const AuditService = require('../services/auditService');

// Chart of Accounts: List all accounts with calculated current balance
router.get('/accounts', async (req, res) => {
    try {
        const { type, is_active } = req.query;
        let query = `
            SELECT 
                coa.*,
                COALESCE(SUM(ji.debit), 0.0) as total_debit,
                COALESCE(SUM(ji.credit), 0.0) as total_credit
            FROM chart_of_accounts coa
            LEFT JOIN journal_items ji ON ji.account_id = coa.id
            LEFT JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED'
            WHERE 1=1
        `;
        const params = [];

        if (type) {
            query += ' AND coa.type = ?';
            params.push(type);
        }
        if (is_active !== undefined) {
            query += ' AND coa.is_active = ?';
            params.push(Number(is_active));
        }

        query += ' GROUP BY coa.id ORDER BY coa.code ASC';

        const rows = await db.prepare(query).all(...params);
        const accounts = rows.map(acc => {
            const deb = Number(acc.total_debit) || 0;
            const cred = Number(acc.total_credit) || 0;
            const isDebitNormal = ['ASSET', 'EXPENSE'].includes(acc.type);
            const balance = isDebitNormal ? (deb - cred) : (cred - deb);
            return {
                ...acc,
                balance: Math.round(balance * 100) / 100
            };
        });

        res.json({ success: true, accounts });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Chart of Accounts: Create new account
router.post('/accounts', async (req, res) => {
    try {
        const { code, name, type, sub_category, currency = 'USD', description = '', is_reconcilable = 0 } = req.body;
        if (!code || !name || !type || !sub_category) {
            return res.status(400).json({ success: false, error: 'Code, Name, Type, and Sub-category are required.' });
        }

        const validTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ success: false, error: `Invalid account type. Must be one of: ${validTypes.join(', ')}` });
        }

        const exists = await db.prepare('SELECT id FROM chart_of_accounts WHERE code = ?').get(code);
        if (exists) {
            return res.status(400).json({ success: false, error: `Account with code ${code} already exists.` });
        }

        const stmt = db.prepare(`
            INSERT INTO chart_of_accounts (code, name, type, sub_category, currency, is_reconcilable, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = await stmt.run(code, name, type, sub_category, currency, is_reconcilable ? 1 : 0, description);

        await AuditService.log({
            username: req.user ? req.user.username : 'Admin',
            action: 'CREATE_ACCOUNT',
            entity: 'ChartOfAccounts',
            entityId: result.lastInsertRowid,
            details: { code, name, type }
        });

        res.json({ success: true, id: result.lastInsertRowid, message: `Account ${code} - ${name} created successfully.` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Journal Entries: List with filtering and pagination
router.get('/journals', async (req, res) => {
    try {
        const { source, status, search, limit = 50, offset = 0 } = req.query;
        let query = 'SELECT * FROM journal_entries WHERE 1=1';
        const params = [];

        if (source) {
            query += ' AND source_module = ?';
            params.push(source);
        }
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (search) {
            query += ' AND (entry_number LIKE ? OR reference LIKE ? OR description LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        query += ' ORDER BY posting_date DESC, id DESC LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));

        const entries = await db.prepare(query).all(...params);

        const getItems = db.prepare(`
            SELECT ji.*, coa.code as account_code, coa.name as account_name, coa.type as account_type
            FROM journal_items ji
            JOIN chart_of_accounts coa ON coa.id = ji.account_id
            WHERE ji.journal_entry_id = ?
            ORDER BY ji.debit DESC, ji.id ASC
        `);

        const enriched = await Promise.all(entries.map(async entry => ({
            ...entry,
            items: await getItems.all(entry.id)
        })));

        res.json({ success: true, entries: enriched });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Journal Entry: Get single by ID
router.get('/journals/:id', async (req, res) => {
    try {
        const entry = await db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(req.params.id);
        if (!entry) {
            return res.status(404).json({ success: false, error: 'Journal entry not found' });
        }

        const items = await db.prepare(`
            SELECT ji.*, coa.code as account_code, coa.name as account_name, coa.type as account_type
            FROM journal_items ji
            JOIN chart_of_accounts coa ON coa.id = ji.account_id
            WHERE ji.journal_entry_id = ?
            ORDER BY ji.debit DESC, ji.id ASC
        `).all(entry.id);

        res.json({ success: true, entry: { ...entry, items } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create and Post a Manual Journal Entry (Strict Double-Entry Bookkeeping)
router.post('/journals', async (req, res) => {
    try {
        const { entryDate, postingDate, reference, description, items } = req.body;
        if (!description) {
            return res.status(400).json({ success: false, error: 'Journal description is required.' });
        }
        if (!items || !Array.isArray(items) || items.length < 2) {
            return res.status(400).json({ success: false, error: 'At least two line items (Debit and Credit) are required for double-entry bookkeeping.' });
        }

        const username = req.user ? req.user.username : 'Admin';
        const result = await AccountingEngine.postJournalEntry({
            entryDate: entryDate || new Date().toISOString().split('T')[0],
            postingDate: postingDate || new Date().toISOString().split('T')[0],
            reference: reference || '',
            description,
            sourceModule: 'MANUAL',
            items,
            createdBy: username,
            username
        });

        res.json({ success: true, ...result, message: `Journal Entry ${result.entryNumber} successfully posted.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Reverse a Posted Journal Entry
router.post('/journals/:id/reverse', async (req, res) => {
    try {
        const { reason } = req.body;
        const username = req.user ? req.user.username : 'Admin';
        const result = await AccountingEngine.reverseJournalEntry(req.params.id, reason || 'User requested correction', username);

        res.json({
            success: true,
            ...result,
            message: `Journal entry successfully reversed with compensating entry ${result.entryNumber}.`
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Trial Balance
router.get('/trial-balance', async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const tb = await ReportsService.getTrialBalance({ asOfDate });
        res.json({ success: true, trialBalance: tb });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
