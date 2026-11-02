const express = require('express');
const router = express.Router();
const db = require('../db/database');
const ReportsService = require('../services/reportsService');
const AuditService = require('../services/auditService');

// Tax Rates
router.get('/rates', async (req, res) => {
    try {
        const rates = await db.prepare(`
            SELECT tr.*, 
                   s_coa.name as sales_tax_account_name,
                   p_coa.name as purchase_tax_account_name
            FROM tax_rates tr
            LEFT JOIN chart_of_accounts s_coa ON s_coa.id = tr.sales_tax_account_id
            LEFT JOIN chart_of_accounts p_coa ON p_coa.id = tr.purchase_tax_account_id
            ORDER BY tr.rate DESC
        `).all();
        res.json({
            success: true,
            taxRates: rates.map(r => ({ ...r, rate: Number(r.rate) || 0 }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/rates', async (req, res) => {
    try {
        const { name, code, rate, type = 'BOTH', description } = req.body;
        if (!name || !code || rate === undefined) {
            return res.status(400).json({ success: false, error: 'Name, Code, and Rate are required.' });
        }

        const salesTaxAcc = await db.prepare("SELECT id FROM chart_of_accounts WHERE code = '22000'").get();
        const purchaseTaxAcc = await db.prepare("SELECT id FROM chart_of_accounts WHERE code = '14000'").get();

        const stmt = db.prepare(`
            INSERT INTO tax_rates (name, code, rate, type, sales_tax_account_id, purchase_tax_account_id, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = await stmt.run(
            name, code, Number(rate), type,
            salesTaxAcc ? salesTaxAcc.id : null,
            purchaseTaxAcc ? purchaseTaxAcc.id : null,
            description || ''
        );

        res.json({ success: true, id: result.lastInsertRowid, message: 'Tax rate configured successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Tax Periods
router.get('/periods', async (req, res) => {
    try {
        const periods = await db.prepare('SELECT * FROM tax_periods ORDER BY start_date DESC').all();
        res.json({ success: true, periods });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/periods', async (req, res) => {
    try {
        const { name, start_date, end_date } = req.body;
        if (!name || !start_date || !end_date) {
            return res.status(400).json({ success: false, error: 'Period Name, Start Date, and End Date are required.' });
        }

        const stmt = db.prepare(`
            INSERT INTO tax_periods (name, start_date, end_date, status)
            VALUES (?, ?, ?, 'OPEN')
        `);
        const result = await stmt.run(name, start_date, end_date);
        res.json({ success: true, id: result.lastInsertRowid, message: 'Tax period opened.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// File Tax Period (Lock period and finalize calculated liability)
router.post('/periods/:id/file', async (req, res) => {
    try {
        const period = await db.prepare('SELECT * FROM tax_periods WHERE id = ?').get(req.params.id);
        if (!period) return res.status(404).json({ success: false, error: 'Tax period not found.' });

        const taxSummary = await ReportsService.getTaxReport({ startDate: period.start_date, endDate: period.end_date });

        await db.prepare(`
            UPDATE tax_periods
            SET status = 'FILED', filed_at = CURRENT_TIMESTAMP,
                total_output_tax = ?, total_input_tax = ?, net_tax_payable = ?
            WHERE id = ?
        `).run(taxSummary.outputTax.total, taxSummary.inputTax.total, taxSummary.netTaxLiability, period.id);

        await AuditService.log({
            username: req.user ? req.user.username : 'Admin',
            action: 'FILE_TAX_PERIOD',
            entity: 'TaxPeriod',
            entityId: period.id,
            details: { netTaxPayable: taxSummary.netTaxLiability }
        });

        res.json({ success: true, message: `Tax period ${period.name} finalized and filed. Net liability: $${taxSummary.netTaxLiability.toFixed(2)}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Tax Summary Overview
router.get('/summary', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const summary = await ReportsService.getTaxReport({ startDate, endDate });
        res.json({ success: true, summary });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
