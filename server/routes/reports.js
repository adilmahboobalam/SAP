const express = require('express');
const router = express.Router();
const ReportsService = require('../services/reportsService');

// 1. Profit & Loss Statement
router.get('/pnl', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await ReportsService.getProfitAndLoss({ startDate, endDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Balance Sheet
router.get('/balance-sheet', async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const report = await ReportsService.getBalanceSheet({ asOfDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Cash Flow Statement
router.get('/cash-flow', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await ReportsService.getCashFlowStatement({ startDate, endDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Trial Balance
router.get('/trial-balance', async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const report = await ReportsService.getTrialBalance({ asOfDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. General Ledger Report
router.get('/general-ledger', async (req, res) => {
    try {
        const { accountId, startDate, endDate } = req.query;
        const report = await ReportsService.getGeneralLedgerReport({ accountId, startDate, endDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. AR Aging Report
router.get('/ar-aging', async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const report = await ReportsService.getArAging({ asOfDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. AP Aging Report
router.get('/ap-aging', async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const report = await ReportsService.getApAging({ asOfDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. Expense Report
router.get('/expenses', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await ReportsService.getExpenseReport({ startDate, endDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 9. Sales Report
router.get('/sales', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await ReportsService.getSalesReport({ startDate, endDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 10. Purchase Report
router.get('/purchases', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await ReportsService.getPurchaseReport({ startDate, endDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 11. Tax Report
router.get('/tax', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await ReportsService.getTaxReport({ startDate, endDate });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 12. Bank Reconciliation Report
router.get('/bank-reconciliation/:id', async (req, res) => {
    try {
        const report = await ReportsService.getBankReconciliationReport(req.params.id);
        if (!report) return res.status(404).json({ success: false, error: 'Reconciliation report not found.' });
        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
