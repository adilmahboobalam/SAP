const db = require('../db/database');

class ReportsService {
    /**
     * 1. Profit & Loss Statement (Income Statement)
     * Revenue - COGS - Operating Expenses = Operating Income, Net Profit
     */
    static async getProfitAndLoss({ startDate, endDate } = {}) {
        let dateFilter = '';
        const params = [];
        if (startDate && endDate) {
            dateFilter = 'AND je.posting_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        // Revenue (type = 'REVENUE'): Normal balance is Credit (credit - debit)
        const revenueAccounts = await db.prepare(`
            SELECT 
                coa.id, coa.code, coa.name, coa.sub_category,
                COALESCE(SUM(ji.credit) - SUM(ji.debit), 0.0) as balance
            FROM chart_of_accounts coa
            LEFT JOIN journal_items ji ON ji.account_id = coa.id
            LEFT JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED' ${dateFilter}
            WHERE coa.type = 'REVENUE' AND coa.is_active = 1
            GROUP BY coa.id
            ORDER BY coa.code
        `).all(...params);

        // Cost of Goods Sold & Expenses (type = 'EXPENSE'): Normal balance is Debit (debit - credit)
        const expenseAccounts = await db.prepare(`
            SELECT 
                coa.id, coa.code, coa.name, coa.sub_category,
                COALESCE(SUM(ji.debit) - SUM(ji.credit), 0.0) as balance
            FROM chart_of_accounts coa
            LEFT JOIN journal_items ji ON ji.account_id = coa.id
            LEFT JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED' ${dateFilter}
            WHERE coa.type = 'EXPENSE' AND coa.is_active = 1
            GROUP BY coa.id
            ORDER BY coa.code
        `).all(...params);

        const totalRevenue = revenueAccounts.reduce((acc, row) => acc + (Number(row.balance) || 0), 0);

        const cogsAccounts = expenseAccounts.filter(a => a.sub_category === 'Cost of Goods Sold');
        const totalCogs = cogsAccounts.reduce((acc, row) => acc + (Number(row.balance) || 0), 0);

        const grossProfit = totalRevenue - totalCogs;

        const operatingExpenseAccounts = expenseAccounts.filter(a => a.sub_category !== 'Cost of Goods Sold');
        const totalOperatingExpenses = operatingExpenseAccounts.reduce((acc, row) => acc + (Number(row.balance) || 0), 0);

        const netProfit = grossProfit - totalOperatingExpenses;

        return {
            period: { startDate: startDate || 'All Time', endDate: endDate || 'Current' },
            revenue: { accounts: revenueAccounts, total: Math.round(totalRevenue * 100) / 100 },
            cogs: { accounts: cogsAccounts, total: Math.round(totalCogs * 100) / 100 },
            grossProfit: Math.round(grossProfit * 100) / 100,
            operatingExpenses: { accounts: operatingExpenseAccounts, total: Math.round(totalOperatingExpenses * 100) / 100 },
            netProfit: Math.round(netProfit * 100) / 100
        };
    }

    /**
     * 2. Balance Sheet
     * Assets = Liabilities + Equity
     */
    static async getBalanceSheet({ asOfDate } = {}) {
        let dateFilter = '';
        const params = [];
        if (asOfDate) {
            dateFilter = 'AND je.posting_date <= ?';
            params.push(asOfDate);
        }

        // Assets: Normal balance Debit (debit - credit)
        const assets = await db.prepare(`
            SELECT 
                coa.id, coa.code, coa.name, coa.sub_category,
                COALESCE(SUM(ji.debit) - SUM(ji.credit), 0.0) as balance
            FROM chart_of_accounts coa
            LEFT JOIN journal_items ji ON ji.account_id = coa.id
            LEFT JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED' ${dateFilter}
            WHERE coa.type = 'ASSET' AND coa.is_active = 1
            GROUP BY coa.id
            HAVING (COALESCE(SUM(ji.debit) - SUM(ji.credit), 0.0) != 0 OR coa.is_active = 1)
            ORDER BY coa.code
        `).all(...params);

        // Liabilities: Normal balance Credit (credit - debit)
        const liabilities = await db.prepare(`
            SELECT 
                coa.id, coa.code, coa.name, coa.sub_category,
                COALESCE(SUM(ji.credit) - SUM(ji.debit), 0.0) as balance
            FROM chart_of_accounts coa
            LEFT JOIN journal_items ji ON ji.account_id = coa.id
            LEFT JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED' ${dateFilter}
            WHERE coa.type = 'LIABILITY' AND coa.is_active = 1
            GROUP BY coa.id
            ORDER BY coa.code
        `).all(...params);

        // Equity: Normal balance Credit (credit - debit)
        const equity = await db.prepare(`
            SELECT 
                coa.id, coa.code, coa.name, coa.sub_category,
                COALESCE(SUM(ji.credit) - SUM(ji.debit), 0.0) as balance
            FROM chart_of_accounts coa
            LEFT JOIN journal_items ji ON ji.account_id = coa.id
            LEFT JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED' ${dateFilter}
            WHERE coa.type = 'EQUITY' AND coa.is_active = 1
            GROUP BY coa.id
            ORDER BY coa.code
        `).all(...params);

        // Retained Earnings calculation (Current Year Earnings from P&L up to asOfDate)
        const pnl = await this.getProfitAndLoss({ endDate: asOfDate });
        const currentYearEarnings = pnl.netProfit;

        const totalAssets = assets.reduce((acc, row) => acc + (Number(row.balance) || 0), 0);
        const totalLiabilities = liabilities.reduce((acc, row) => acc + (Number(row.balance) || 0), 0);
        const baseEquityTotal = equity.reduce((acc, row) => acc + (Number(row.balance) || 0), 0);
        const totalEquity = baseEquityTotal + currentYearEarnings;
        const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

        // Group assets by sub-category
        const currentAssets = assets.filter(a => a.sub_category === 'Current Assets' || a.sub_category === 'Cash & Bank');
        const nonCurrentAssets = assets.filter(a => a.sub_category !== 'Current Assets' && a.sub_category !== 'Cash & Bank');

        return {
            asOfDate: asOfDate || new Date().toISOString().split('T')[0],
            assets: {
                current: currentAssets,
                nonCurrent: nonCurrentAssets,
                all: assets,
                total: Math.round(totalAssets * 100) / 100
            },
            liabilities: {
                accounts: liabilities,
                total: Math.round(totalLiabilities * 100) / 100
            },
            equity: {
                accounts: equity,
                retainedEarnings: currentYearEarnings,
                total: Math.round(totalEquity * 100) / 100
            },
            totalLiabilitiesAndEquity: Math.round(totalLiabilitiesAndEquity * 100) / 100,
            isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.05
        };
    }

    /**
     * 3. Cash Flow Statement
     * Operating, Investing, Financing activities
     */
    static async getCashFlowStatement({ startDate, endDate } = {}) {
        let dateFilter = '';
        const params = [];
        if (startDate && endDate) {
            dateFilter = 'AND je.posting_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        // Cash flow from Operating Activities
        const custRow = await db.prepare(`
            SELECT COALESCE(SUM(amount), 0.0) as total
            FROM payments
            WHERE payment_type = 'RECEIPT' AND entity_type = 'CUSTOMER'
            ${startDate && endDate ? 'AND payment_date BETWEEN ? AND ?' : ''}
        `).get(...(startDate && endDate ? [startDate, endDate] : []));
        const customerReceipts = custRow ? Number(custRow.total) || 0 : 0;

        const suppRow = await db.prepare(`
            SELECT COALESCE(SUM(amount), 0.0) as total
            FROM payments
            WHERE payment_type = 'DISBURSEMENT' AND entity_type = 'SUPPLIER'
            ${startDate && endDate ? 'AND payment_date BETWEEN ? AND ?' : ''}
        `).get(...(startDate && endDate ? [startDate, endDate] : []));
        const supplierPayments = suppRow ? Number(suppRow.total) || 0 : 0;

        const expRow = await db.prepare(`
            SELECT COALESCE(SUM(total_amount), 0.0) as total
            FROM expenses
            WHERE status = 'POSTED'
            ${startDate && endDate ? 'AND expense_date BETWEEN ? AND ?' : ''}
        `).get(...(startDate && endDate ? [startDate, endDate] : []));
        const operatingExpenses = expRow ? Number(expRow.total) || 0 : 0;

        const payRow = await db.prepare(`
            SELECT COALESCE(SUM(net_payroll), 0.0) as total
            FROM payroll_runs
            WHERE status = 'POSTED'
            ${startDate && endDate ? 'AND payment_date BETWEEN ? AND ?' : ''}
        `).get(...(startDate && endDate ? [startDate, endDate] : []));
        const payrollPayments = payRow ? Number(payRow.total) || 0 : 0;

        const netOperatingCash = customerReceipts - supplierPayments - operatingExpenses - payrollPayments;

        // Investing activities (Fixed assets purchased)
        const investingRow = await db.prepare(`
            SELECT COALESCE(SUM(ji.debit) - SUM(ji.credit), 0.0) as total
            FROM journal_items ji
            JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED' ${dateFilter}
            JOIN chart_of_accounts coa ON coa.id = ji.account_id
            WHERE coa.sub_category = 'Fixed Assets'
        `).get(...params);
        const investingTotal = investingRow ? Number(investingRow.total) || 0 : 0;
        const netInvestingCash = -investingTotal;

        // Financing activities
        const financingRow = await db.prepare(`
            SELECT COALESCE(SUM(ji.credit) - SUM(ji.debit), 0.0) as total
            FROM journal_items ji
            JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED' ${dateFilter}
            JOIN chart_of_accounts coa ON coa.id = ji.account_id
            WHERE coa.sub_category IN ('Common Stock', 'Owner Capital', 'Long Term Debt')
        `).get(...params);
        const netFinancingCash = financingRow ? Number(financingRow.total) || 0 : 0;

        const netCashChange = netOperatingCash + netInvestingCash + netFinancingCash;

        return {
            period: { startDate: startDate || 'All Time', endDate: endDate || 'Current' },
            operating: {
                customerReceipts: Math.round(customerReceipts * 100) / 100,
                supplierPayments: Math.round(supplierPayments * 100) / 100,
                operatingExpenses: Math.round(operatingExpenses * 100) / 100,
                payrollPayments: Math.round(payrollPayments * 100) / 100,
                netOperatingCash: Math.round(netOperatingCash * 100) / 100
            },
            investing: {
                fixedAssetsPurchased: Math.round(investingTotal * 100) / 100,
                netInvestingCash: Math.round(netInvestingCash * 100) / 100
            },
            financing: {
                capitalAndDebt: Math.round(netFinancingCash * 100) / 100,
                netFinancingCash: Math.round(netFinancingCash * 100) / 100
            },
            netCashChange: Math.round(netCashChange * 100) / 100
        };
    }

    /**
     * 4. Trial Balance
     * Code, Account Name, Type, Total Debit, Total Credit, Net Debit, Net Credit
     */
    static async getTrialBalance({ asOfDate } = {}) {
        let dateFilter = '';
        const params = [];
        if (asOfDate) {
            dateFilter = 'AND je.posting_date <= ?';
            params.push(asOfDate);
        }

        const rows = await db.prepare(`
            SELECT 
                coa.id, coa.code, coa.name, coa.type, coa.sub_category,
                COALESCE(SUM(ji.debit), 0.0) as total_debit,
                COALESCE(SUM(ji.credit), 0.0) as total_credit
            FROM chart_of_accounts coa
            LEFT JOIN journal_items ji ON ji.account_id = coa.id
            LEFT JOIN journal_entries je ON je.id = ji.journal_entry_id AND je.status = 'POSTED' ${dateFilter}
            WHERE coa.is_active = 1
            GROUP BY coa.id
            ORDER BY coa.code
        `).all(...params);

        let sumDebit = 0;
        let sumCredit = 0;

        const accounts = rows.map(r => {
            const rawDeb = Number(r.total_debit) || 0;
            const rawCred = Number(r.total_credit) || 0;
            const net = rawDeb - rawCred;
            let debitBalance = 0;
            let creditBalance = 0;

            if (['ASSET', 'EXPENSE'].includes(r.type)) {
                if (net >= 0) debitBalance = net;
                else creditBalance = Math.abs(net);
            } else {
                if (net <= 0) creditBalance = Math.abs(net);
                else debitBalance = net;
            }

            debitBalance = Math.round(debitBalance * 100) / 100;
            creditBalance = Math.round(creditBalance * 100) / 100;

            sumDebit += debitBalance;
            sumCredit += creditBalance;

            return {
                id: r.id,
                code: r.code,
                name: r.name,
                type: r.type,
                subCategory: r.sub_category,
                rawDebit: rawDeb,
                rawCredit: rawCred,
                debit: debitBalance,
                credit: creditBalance
            };
        });

        sumDebit = Math.round(sumDebit * 100) / 100;
        sumCredit = Math.round(sumCredit * 100) / 100;

        return {
            asOfDate: asOfDate || new Date().toISOString().split('T')[0],
            accounts,
            totalDebit: sumDebit,
            totalCredit: sumCredit,
            isBalanced: Math.abs(sumDebit - sumCredit) < 0.05
        };
    }

    /**
     * 5. General Ledger Report
     * Filterable by account and date range, calculates running balance
     */
    static async getGeneralLedgerReport({ accountId, startDate, endDate } = {}) {
        let query = `
            SELECT 
                je.id as entry_id, je.entry_number, je.posting_date, je.reference,
                je.source_module, ji.description, ji.debit, ji.credit,
                coa.id as account_id, coa.code as account_code, coa.name as account_name, coa.type as account_type
            FROM journal_items ji
            JOIN journal_entries je ON je.id = ji.journal_entry_id
            JOIN chart_of_accounts coa ON coa.id = ji.account_id
            WHERE je.status = 'POSTED'
        `;
        const params = [];

        if (accountId) {
            query += ' AND coa.id = ?';
            params.push(accountId);
        }
        if (startDate && endDate) {
            query += ' AND je.posting_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        query += ' ORDER BY coa.code, je.posting_date ASC, je.id ASC';

        const rawRows = await db.prepare(query).all(...params);

        // Group by account and compute running balance
        const grouped = {};
        for (const row of rawRows) {
            if (!grouped[row.account_id]) {
                grouped[row.account_id] = {
                    accountId: row.account_id,
                    code: row.account_code,
                    name: row.account_name,
                    type: row.account_type,
                    runningBalance: 0,
                    transactions: []
                };
            }

            const isDebitNormal = ['ASSET', 'EXPENSE'].includes(row.account_type);
            const deb = Number(row.debit) || 0;
            const cred = Number(row.credit) || 0;
            const netChange = isDebitNormal ? (deb - cred) : (cred - deb);
            grouped[row.account_id].runningBalance = Math.round((grouped[row.account_id].runningBalance + netChange) * 100) / 100;

            grouped[row.account_id].transactions.push({
                entryId: row.entry_id,
                entryNumber: row.entry_number,
                date: row.posting_date,
                reference: row.reference,
                sourceModule: row.source_module,
                description: row.description,
                debit: deb,
                credit: cred,
                balance: grouped[row.account_id].runningBalance
            });
        }

        return Object.values(grouped);
    }

    /**
     * 6. Accounts Receivable Aging Report
     * Aging buckets: Current, 1-30, 31-60, 61-90, 90+ days
     */
    static async getArAging({ asOfDate = new Date().toISOString().split('T')[0] } = {}) {
        const invoices = await db.prepare(`
            SELECT 
                inv.id, inv.invoice_number, inv.invoice_date, inv.due_date,
                inv.total_amount, inv.paid_amount, (inv.total_amount - inv.paid_amount) as balance_due,
                c.id as customer_id, c.code as customer_code, c.name as customer_name, c.payment_terms
            FROM sales_invoices inv
            JOIN customers c ON c.id = inv.customer_id
            WHERE inv.status IN ('POSTED', 'PARTIALLY_PAID', 'OVERDUE')
              AND (inv.total_amount - inv.paid_amount) > 0.009
              AND inv.invoice_date <= ?
            ORDER BY c.name, inv.due_date ASC
        `).all(asOfDate);

        const customerAging = {};
        const asOf = new Date(asOfDate);

        for (const inv of invoices) {
            if (!customerAging[inv.customer_id]) {
                customerAging[inv.customer_id] = {
                    customerId: inv.customer_id,
                    customerCode: inv.customer_code,
                    customerName: inv.customer_name,
                    current: 0,
                    days1_30: 0,
                    days31_60: 0,
                    days61_90: 0,
                    days90Plus: 0,
                    totalDue: 0,
                    invoices: []
                };
            }

            const dueDate = new Date(inv.due_date);
            const diffTime = asOf - dueDate;
            const daysPastDue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const amount = Math.round((Number(inv.balance_due) || 0) * 100) / 100;

            customerAging[inv.customer_id].totalDue += amount;

            if (daysPastDue <= 0) {
                customerAging[inv.customer_id].current += amount;
            } else if (daysPastDue <= 30) {
                customerAging[inv.customer_id].days1_30 += amount;
            } else if (daysPastDue <= 60) {
                customerAging[inv.customer_id].days31_60 += amount;
            } else if (daysPastDue <= 90) {
                customerAging[inv.customer_id].days61_90 += amount;
            } else {
                customerAging[inv.customer_id].days90Plus += amount;
            }

            customerAging[inv.customer_id].invoices.push({
                invoiceNumber: inv.invoice_number,
                invoiceDate: inv.invoice_date,
                dueDate: inv.due_date,
                daysPastDue: Math.max(0, daysPastDue),
                balanceDue: amount
            });
        }

        const result = Object.values(customerAging).map(c => ({
            ...c,
            current: Math.round(c.current * 100) / 100,
            days1_30: Math.round(c.days1_30 * 100) / 100,
            days31_60: Math.round(c.days31_60 * 100) / 100,
            days61_90: Math.round(c.days61_90 * 100) / 100,
            days90Plus: Math.round(c.days90Plus * 100) / 100,
            totalDue: Math.round(c.totalDue * 100) / 100
        }));

        const totals = result.reduce((acc, c) => ({
            current: acc.current + c.current,
            days1_30: acc.days1_30 + c.days1_30,
            days31_60: acc.days31_60 + c.days31_60,
            days61_90: acc.days61_90 + c.days61_90,
            days90Plus: acc.days90Plus + c.days90Plus,
            totalDue: acc.totalDue + c.totalDue
        }), { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0, totalDue: 0 });

        return { asOfDate, customers: result, totals };
    }

    /**
     * 7. Accounts Payable Aging Report
     */
    static async getApAging({ asOfDate = new Date().toISOString().split('T')[0] } = {}) {
        const bills = await db.prepare(`
            SELECT 
                bill.id, bill.bill_number, bill.bill_date, bill.due_date,
                bill.total_amount, bill.paid_amount, (bill.total_amount - bill.paid_amount) as balance_due,
                s.id as supplier_id, s.code as supplier_code, s.name as supplier_name
            FROM purchase_invoices bill
            JOIN suppliers s ON s.id = bill.supplier_id
            WHERE bill.status IN ('POSTED', 'PARTIALLY_PAID', 'OVERDUE')
              AND (bill.total_amount - bill.paid_amount) > 0.009
              AND bill.bill_date <= ?
            ORDER BY s.name, bill.due_date ASC
        `).all(asOfDate);

        const supplierAging = {};
        const asOf = new Date(asOfDate);

        for (const bill of bills) {
            if (!supplierAging[bill.supplier_id]) {
                supplierAging[bill.supplier_id] = {
                    supplierId: bill.supplier_id,
                    supplierCode: bill.supplier_code,
                    supplierName: bill.supplier_name,
                    current: 0,
                    days1_30: 0,
                    days31_60: 0,
                    days61_90: 0,
                    days90Plus: 0,
                    totalDue: 0,
                    bills: []
                };
            }

            const dueDate = new Date(bill.due_date);
            const diffTime = asOf - dueDate;
            const daysPastDue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const amount = Math.round((Number(bill.balance_due) || 0) * 100) / 100;

            supplierAging[bill.supplier_id].totalDue += amount;

            if (daysPastDue <= 0) {
                supplierAging[bill.supplier_id].current += amount;
            } else if (daysPastDue <= 30) {
                supplierAging[bill.supplier_id].days1_30 += amount;
            } else if (daysPastDue <= 60) {
                supplierAging[bill.supplier_id].days31_60 += amount;
            } else if (daysPastDue <= 90) {
                supplierAging[bill.supplier_id].days61_90 += amount;
            } else {
                supplierAging[bill.supplier_id].days90Plus += amount;
            }

            supplierAging[bill.supplier_id].bills.push({
                billNumber: bill.bill_number,
                billDate: bill.bill_date,
                dueDate: bill.due_date,
                daysPastDue: Math.max(0, daysPastDue),
                balanceDue: amount
            });
        }

        const result = Object.values(supplierAging).map(s => ({
            ...s,
            current: Math.round(s.current * 100) / 100,
            days1_30: Math.round(s.days1_30 * 100) / 100,
            days31_60: Math.round(s.days31_60 * 100) / 100,
            days61_90: Math.round(s.days61_90 * 100) / 100,
            days90Plus: Math.round(s.days90Plus * 100) / 100,
            totalDue: Math.round(s.totalDue * 100) / 100
        }));

        const totals = result.reduce((acc, s) => ({
            current: acc.current + s.current,
            days1_30: acc.days1_30 + s.days1_30,
            days31_60: acc.days31_60 + s.days31_60,
            days61_90: acc.days61_90 + s.days61_90,
            days90Plus: acc.days90Plus + s.days90Plus,
            totalDue: acc.totalDue + s.totalDue
        }), { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0, totalDue: 0 });

        return { asOfDate, suppliers: result, totals };
    }

    /**
     * 8. Expense Report
     * Grouped by category and department
     */
    static async getExpenseReport({ startDate, endDate } = {}) {
        const byCategory = await db.prepare(`
            SELECT ec.id, ec.name as category_name, COUNT(e.id) as count, COALESCE(SUM(e.total_amount), 0.0) as total
            FROM expense_categories ec
            LEFT JOIN expenses e ON e.category_id = ec.id AND e.status = 'POSTED' ${startDate && endDate ? 'AND e.expense_date BETWEEN ? AND ?' : ''}
            GROUP BY ec.id
            ORDER BY total DESC
        `).all(...(startDate && endDate ? [startDate, endDate] : []));

        const byDepartment = await db.prepare(`
            SELECT e.department, COUNT(e.id) as count, COALESCE(SUM(e.total_amount), 0.0) as total
            FROM expenses e
            WHERE e.status = 'POSTED' ${startDate && endDate ? 'AND e.expense_date BETWEEN ? AND ?' : ''}
            GROUP BY e.department
            ORDER BY total DESC
        `).all(...(startDate && endDate ? [startDate, endDate] : []));

        const totalExpenses = byCategory.reduce((acc, r) => acc + (Number(r.total) || 0), 0);

        return {
            period: { startDate: startDate || 'All Time', endDate: endDate || 'Current' },
            byCategory,
            byDepartment,
            totalExpenses: Math.round(totalExpenses * 100) / 100
        };
    }

    /**
     * 9. Sales Report
     * By customer, product, and month
     */
    static async getSalesReport({ startDate, endDate } = {}) {
        const byCustomer = await db.prepare(`
            SELECT c.id, c.code, c.name, COUNT(inv.id) as invoice_count, COALESCE(SUM(inv.total_amount), 0.0) as total_sales
            FROM customers c
            JOIN sales_invoices inv ON inv.customer_id = c.id AND inv.status IN ('POSTED', 'PAID', 'PARTIALLY_PAID')
            ${startDate && endDate ? 'WHERE inv.invoice_date BETWEEN ? AND ?' : ''}
            GROUP BY c.id
            ORDER BY total_sales DESC
        `).all(...(startDate && endDate ? [startDate, endDate] : []));

        const byMonth = await db.prepare(`
            SELECT strftime('%Y-%m', inv.invoice_date) as month, COUNT(inv.id) as count, SUM(inv.total_amount) as total
            FROM sales_invoices inv
            WHERE inv.status IN ('POSTED', 'PAID', 'PARTIALLY_PAID')
            ${startDate && endDate ? 'AND inv.invoice_date BETWEEN ? AND ?' : ''}
            GROUP BY month
            ORDER BY month ASC
        `).all(...(startDate && endDate ? [startDate, endDate] : []));

        const total = byCustomer.reduce((acc, r) => acc + (Number(r.total_sales) || 0), 0);

        return {
            period: { startDate: startDate || 'All Time', endDate: endDate || 'Current' },
            byCustomer,
            byMonth,
            totalSales: Math.round(total * 100) / 100
        };
    }

    /**
     * 10. Purchase Report
     * By supplier and month
     */
    static async getPurchaseReport({ startDate, endDate } = {}) {
        const bySupplier = await db.prepare(`
            SELECT s.id, s.code, s.name, COUNT(bill.id) as bill_count, COALESCE(SUM(bill.total_amount), 0.0) as total_purchases
            FROM suppliers s
            JOIN purchase_invoices bill ON bill.supplier_id = s.id AND bill.status IN ('POSTED', 'PAID', 'PARTIALLY_PAID')
            ${startDate && endDate ? 'WHERE bill.bill_date BETWEEN ? AND ?' : ''}
            GROUP BY s.id
            ORDER BY total_purchases DESC
        `).all(...(startDate && endDate ? [startDate, endDate] : []));

        const total = bySupplier.reduce((acc, r) => acc + (Number(r.total_purchases) || 0), 0);

        return {
            period: { startDate: startDate || 'All Time', endDate: endDate || 'Current' },
            bySupplier,
            totalPurchases: Math.round(total * 100) / 100
        };
    }

    /**
     * 11. Tax Report
     * Input Tax (Purchases/Expenses) vs Output Tax (Sales), Net Tax Liability
     */
    static async getTaxReport({ startDate, endDate } = {}) {
        let dateFilterSales = '';
        let dateFilterPurchases = '';
        let dateFilterExpenses = '';
        const params = [];

        if (startDate && endDate) {
            dateFilterSales = 'AND inv.invoice_date BETWEEN ? AND ?';
            dateFilterPurchases = 'AND bill.bill_date BETWEEN ? AND ?';
            dateFilterExpenses = 'AND e.expense_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        // Output Tax from Sales Invoices
        const outputTax = await db.prepare(`
            SELECT 
                tr.name as tax_name, tr.rate,
                COUNT(item.id) as count,
                COALESCE(SUM(item.line_total - item.tax_amount), 0.0) as taxable_amount,
                COALESCE(SUM(item.tax_amount), 0.0) as tax_amount
            FROM sales_invoice_items item
            JOIN sales_invoices inv ON inv.id = item.invoice_id AND inv.status IN ('POSTED', 'PAID', 'PARTIALLY_PAID') ${dateFilterSales}
            JOIN tax_rates tr ON tr.id = item.tax_rate_id
            GROUP BY tr.id
        `).all(...(startDate && endDate ? [startDate, endDate] : []));

        // Input Tax from Purchase Invoices
        const inputTaxBills = await db.prepare(`
            SELECT 
                tr.name as tax_name, tr.rate,
                COUNT(item.id) as count,
                COALESCE(SUM(item.line_total - item.tax_amount), 0.0) as taxable_amount,
                COALESCE(SUM(item.tax_amount), 0.0) as tax_amount
            FROM purchase_invoice_items item
            JOIN purchase_invoices bill ON bill.id = item.invoice_id AND bill.status IN ('POSTED', 'PAID', 'PARTIALLY_PAID') ${dateFilterPurchases}
            JOIN tax_rates tr ON tr.id = item.tax_rate_id
            GROUP BY tr.id
        `).all(...(startDate && endDate ? [startDate, endDate] : []));

        // Input Tax from Expenses
        const inputTaxExpenses = await db.prepare(`
            SELECT 
                tr.name as tax_name, tr.rate,
                COUNT(e.id) as count,
                COALESCE(SUM(e.total_amount - e.tax_amount), 0.0) as taxable_amount,
                COALESCE(SUM(e.tax_amount), 0.0) as tax_amount
            FROM expenses e
            JOIN tax_rates tr ON tr.id = e.tax_rate_id
            WHERE e.status = 'POSTED' AND e.tax_amount > 0 ${dateFilterExpenses}
            GROUP BY tr.id
        `).all(...(startDate && endDate ? [startDate, endDate] : []));

        const totalOutputTax = outputTax.reduce((acc, r) => acc + (Number(r.tax_amount) || 0), 0);
        const totalInputTaxBills = inputTaxBills.reduce((acc, r) => acc + (Number(r.tax_amount) || 0), 0);
        const totalInputTaxExpenses = inputTaxExpenses.reduce((acc, r) => acc + (Number(r.tax_amount) || 0), 0);
        const totalInputTax = totalInputTaxBills + totalInputTaxExpenses;

        const netTaxLiability = totalOutputTax - totalInputTax;

        return {
            period: { startDate: startDate || 'All Time', endDate: endDate || 'Current' },
            outputTax: { items: outputTax, total: Math.round(totalOutputTax * 100) / 100 },
            inputTax: { bills: inputTaxBills, expenses: inputTaxExpenses, total: Math.round(totalInputTax * 100) / 100 },
            netTaxLiability: Math.round(netTaxLiability * 100) / 100
        };
    }

    /**
     * 12. Bank Reconciliation Report
     */
    static async getBankReconciliationReport(reconciliationId) {
        const rec = await db.prepare(`
            SELECT br.*, ba.bank_name, ba.account_number, ba.currency
            FROM bank_reconciliations br
            JOIN bank_accounts ba ON ba.id = br.bank_account_id
            WHERE br.id = ?
        `).get(reconciliationId);

        if (!rec) return null;

        const clearedTransactions = await db.prepare(`
            SELECT * FROM bank_transactions
            WHERE reconciliation_id = ?
            ORDER BY transaction_date ASC
        `).all(reconciliationId);

        return { reconciliation: rec, transactions: clearedTransactions };
    }
}

module.exports = ReportsService;
