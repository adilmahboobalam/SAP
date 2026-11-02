const express = require('express');
const router = express.Router();
const db = require('../db/database');
const AccountingEngine = require('../services/accountingEngine');
const AuditService = require('../services/auditService');

// Expense Categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await db.prepare(`
            SELECT ec.*, coa.code as gl_account_code, coa.name as gl_account_name,
                   COUNT(e.id) as expense_count, COALESCE(SUM(e.total_amount), 0.0) as total_spent
            FROM expense_categories ec
            JOIN chart_of_accounts coa ON coa.id = ec.gl_account_id
            LEFT JOIN expenses e ON e.category_id = ec.id AND e.status = 'POSTED'
            GROUP BY ec.id, coa.code, coa.name
            ORDER BY ec.name ASC
        `).all();

        res.json({
            success: true,
            categories: categories.map(c => ({
                ...c,
                expense_count: Number(c.expense_count) || 0,
                total_spent: Number(c.total_spent) || 0
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/categories', async (req, res) => {
    try {
        const { name, code, gl_account_id, description } = req.body;
        if (!name || !code || !gl_account_id) {
            return res.status(400).json({ success: false, error: 'Name, Code, and GL Account are required.' });
        }

        const stmt = db.prepare(`
            INSERT INTO expense_categories (name, code, gl_account_id, description)
            VALUES (?, ?, ?, ?)
        `);
        const result = await stmt.run(name, code, gl_account_id, description);
        res.json({ success: true, id: result.lastInsertRowid, message: 'Expense category added.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Expenses List
router.get('/', async (req, res) => {
    try {
        const { department, status, category_id } = req.query;
        let query = `
            SELECT e.*, ec.name as category_name, ba.bank_name,
                   tr.name as tax_rate_name, je.entry_number as journal_entry_number
            FROM expenses e
            JOIN expense_categories ec ON ec.id = e.category_id
            JOIN bank_accounts ba ON ba.id = e.payment_account_id
            LEFT JOIN tax_rates tr ON tr.id = e.tax_rate_id
            LEFT JOIN journal_entries je ON je.id = e.journal_entry_id
            WHERE 1=1
        `;
        const params = [];

        if (department) {
            query += ' AND e.department = ?';
            params.push(department);
        }
        if (status) {
            query += ' AND e.status = ?';
            params.push(status);
        }
        if (category_id) {
            query += ' AND e.category_id = ?';
            params.push(category_id);
        }

        query += ' ORDER BY e.expense_date DESC, e.id DESC';

        const expenses = await db.prepare(query).all(...params);
        res.json({ success: true, expenses });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Single Expense
router.get('/:id', async (req, res) => {
    try {
        const expense = await db.prepare(`
            SELECT e.*, ec.name as category_name, ba.bank_name,
                   tr.name as tax_rate_name, je.entry_number as journal_entry_number
            FROM expenses e
            JOIN expense_categories ec ON ec.id = e.category_id
            JOIN bank_accounts ba ON ba.id = e.payment_account_id
            LEFT JOIN tax_rates tr ON tr.id = e.tax_rate_id
            LEFT JOIN journal_entries je ON je.id = e.journal_entry_id
            WHERE e.id = ?
        `).get(req.params.id);

        if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });
        res.json({ success: true, expense });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Record New Expense
router.post('/', async (req, res) => {
    try {
        const {
            category_id, vendor_name, expense_date, amount, tax_rate_id,
            payment_account_id, department = 'Administration', is_recurring = 0,
            recurring_frequency, description, receipt_path, auto_post = true
        } = req.body;

        if (!category_id || !expense_date || !amount || !payment_account_id || !description) {
            return res.status(400).json({ success: false, error: 'Category, Date, Amount, Payment Account, and Description are required.' });
        }

        const netAmount = Number(amount);
        let taxAmount = 0;
        if (tax_rate_id) {
            const tr = await db.prepare('SELECT rate FROM tax_rates WHERE id = ?').get(tax_rate_id);
            if (tr) taxAmount = Math.round((netAmount * ((Number(tr.rate) || 0) / 100)) * 100) / 100;
        }
        const totalAmount = Math.round((netAmount + taxAmount) * 100) / 100;

        const expense_number = await AccountingEngine.getNextNumber('EXP');
        const username = req.user ? req.user.username : 'Admin';

        const tx = db.transaction(async () => {
            const stmt = db.prepare(`
                INSERT INTO expenses (
                    expense_number, category_id, vendor_name, expense_date, amount,
                    tax_rate_id, tax_amount, total_amount, payment_account_id,
                    department, status, receipt_path, is_recurring, recurring_frequency,
                    description, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?, ?)
            `);
            const result = await stmt.run(
                expense_number, category_id, vendor_name || '', expense_date, netAmount,
                tax_rate_id || null, taxAmount, totalAmount, payment_account_id,
                department, receipt_path || null, is_recurring ? 1 : 0, recurring_frequency || null,
                description, username
            );
            const expenseId = result.lastInsertRowid;

            let jeResult = null;
            if (auto_post) {
                jeResult = await AccountingEngine.postExpense(expenseId, username);
            }

            return { expenseId, expense_number, totalAmount, jeResult };
        });

        const resData = await tx();
        res.json({ success: true, ...resData, message: `Expense ${expense_number} recorded and posted.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Approve & Post an Expense
router.post('/:id/approve', async (req, res) => {
    try {
        const username = req.user ? req.user.username : 'Admin';
        const jeResult = await AccountingEngine.postExpense(req.params.id, username);
        res.json({ success: true, ...jeResult, message: 'Expense approved and posted to General Ledger.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
