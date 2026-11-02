const express = require('express');
const router = express.Router();
const db = require('../db/database');
const ReportsService = require('../services/reportsService');

router.get('/kpis', (req, res) => {
    try {
        // P&L figures from actual general ledger transactions
        const pnl = ReportsService.getProfitAndLoss();
        // Balance sheet figures from actual general ledger transactions
        const bs = ReportsService.getBalanceSheet();

        // Accounts Receivable (Outstanding balance from unpaid posted sales invoices)
        const arRow = db.prepare(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(total_amount - paid_amount), 0.0) as amount
            FROM sales_invoices
            WHERE status IN ('POSTED', 'PARTIALLY_PAID', 'OVERDUE')
              AND (total_amount - paid_amount) > 0.009
        `).get();

        // Accounts Payable (Outstanding balance from unpaid posted vendor bills)
        const apRow = db.prepare(`
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(total_amount - paid_amount), 0.0) as amount
            FROM purchase_invoices
            WHERE status IN ('POSTED', 'PARTIALLY_PAID', 'OVERDUE')
              AND (total_amount - paid_amount) > 0.009
        `).get();

        // Total Cash & Bank Balance directly calculated from GL Cash & Bank accounts
        const cashRow = db.prepare(`
            SELECT COALESCE(SUM(ji.debit) - SUM(ji.credit), 0.0) as total_cash
            FROM journal_items ji
            JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED'
            JOIN chart_of_accounts coa ON coa.id = ji.account_id
            WHERE coa.sub_category = 'Cash & Bank'
        `).get();

        // Pending Expenses
        const pendingExpRow = db.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0.0) as amount
            FROM expenses
            WHERE status = 'SUBMITTED'
        `).get();

        res.json({
            success: true,
            kpis: {
                totalRevenue: pnl.revenue.total,
                totalExpenses: pnl.cogs.total + pnl.operatingExpenses.total,
                netProfit: pnl.netProfit,
                totalAssets: bs.assets.total,
                totalLiabilities: bs.liabilities.total,
                accountsReceivable: Math.round(arRow.amount * 100) / 100,
                arCount: arRow.count,
                accountsPayable: Math.round(apRow.amount * 100) / 100,
                apCount: apRow.count,
                cashAndBankBalance: Math.round(cashRow.total_cash * 100) / 100,
                pendingExpensesCount: pendingExpRow.count,
                pendingExpensesAmount: Math.round(pendingExpRow.amount * 100) / 100
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/charts', (req, res) => {
    try {
        // Monthly Revenue vs Expenses for the current year
        const monthlyData = db.prepare(`
            SELECT 
                m.month_num,
                m.month_name,
                COALESCE(rev.total_rev, 0.0) as revenue,
                COALESCE(exp.total_exp, 0.0) as expenses
            FROM (
                SELECT '01' as month_num, 'Jan' as month_name UNION ALL
                SELECT '02', 'Feb' UNION ALL
                SELECT '03', 'Mar' UNION ALL
                SELECT '04', 'Apr' UNION ALL
                SELECT '05', 'May' UNION ALL
                SELECT '06', 'Jun' UNION ALL
                SELECT '07', 'Jul' UNION ALL
                SELECT '08', 'Aug' UNION ALL
                SELECT '09', 'Sep' UNION ALL
                SELECT '10', 'Oct' UNION ALL
                SELECT '11', 'Nov' UNION ALL
                SELECT '12', 'Dec'
            ) m
            LEFT JOIN (
                SELECT strftime('%m', je.posting_date) as month,
                       SUM(ji.credit - ji.debit) as total_rev
                FROM journal_items ji
                JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED'
                JOIN chart_of_accounts coa ON coa.id = ji.account_id AND coa.type = 'REVENUE'
                GROUP BY month
            ) rev ON rev.month = m.month_num
            LEFT JOIN (
                SELECT strftime('%m', je.posting_date) as month,
                       SUM(ji.debit - ji.credit) as total_exp
                FROM journal_items ji
                JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED'
                JOIN chart_of_accounts coa ON coa.id = ji.account_id AND coa.type = 'EXPENSE'
                GROUP BY month
            ) exp ON exp.month = m.month_num
            ORDER BY m.month_num ASC
        `).all();

        // Expense category breakdown for donut chart
        const expenseCategories = db.prepare(`
            SELECT ec.name, COALESCE(SUM(e.total_amount), 0.0) as amount
            FROM expense_categories ec
            LEFT JOIN expenses e ON e.category_id = ec.id AND e.status = 'POSTED'
            GROUP BY ec.id
            HAVING amount > 0
            ORDER BY amount DESC
        `).all();

        // AR Aging summary for bar chart
        const arAging = ReportsService.getArAging();

        res.json({
            success: true,
            monthlyComparison: monthlyData,
            expenseBreakdown: expenseCategories,
            arAgingSummary: arAging.totals
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/recent-transactions', (req, res) => {
    try {
        const transactions = db.prepare(`
            SELECT 
                je.id, je.entry_number, je.entry_date, je.posting_date,
                je.reference, je.description, je.source_module, je.status,
                je.total_debit, je.total_credit, je.created_by, je.is_reversed
            FROM journal_entries je
            ORDER BY je.id DESC
            LIMIT 10
        `).all();

        res.json({ success: true, transactions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/upcoming-dues', (req, res) => {
    try {
        // Upcoming Customer Invoices Due
        const upcomingInvoices = db.prepare(`
            SELECT 
                inv.id, inv.invoice_number, inv.due_date,
                (inv.total_amount - inv.paid_amount) as amount_due,
                c.name as customer_name
            FROM sales_invoices inv
            JOIN customers c ON c.id = inv.customer_id
            WHERE inv.status IN ('POSTED', 'PARTIALLY_PAID', 'OVERDUE')
              AND (inv.total_amount - inv.paid_amount) > 0.009
            ORDER BY inv.due_date ASC
            LIMIT 5
        `).all();

        // Upcoming Vendor Bills Due
        const upcomingBills = db.prepare(`
            SELECT 
                bill.id, bill.bill_number, bill.due_date,
                (bill.total_amount - bill.paid_amount) as amount_due,
                s.name as supplier_name
            FROM purchase_invoices bill
            JOIN suppliers s ON s.id = bill.supplier_id
            WHERE bill.status IN ('POSTED', 'PARTIALLY_PAID', 'OVERDUE')
              AND (bill.total_amount - bill.paid_amount) > 0.009
            ORDER BY bill.due_date ASC
            LIMIT 5
        `).all();

        res.json({ success: true, upcomingInvoices, upcomingBills });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
