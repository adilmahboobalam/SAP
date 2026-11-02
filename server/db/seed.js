const db = require('./database');
const bcrypt = require('bcryptjs');
const AuditService = require('../services/auditService');

function seedDatabase() {
    console.log('--- Initializing Clean Baseline Accounting Database ---');

    db.pragma('foreign_keys = OFF');

    // Clean up all transactional and entity tables
    const tablesToClear = [
        'payslips',
        'payroll_runs',
        'stock_movements',
        'payments',
        'bank_transactions',
        'bank_reconciliations',
        'expenses',
        'expense_categories',
        'debit_notes',
        'purchase_invoice_items',
        'purchase_invoices',
        'purchase_orders',
        'purchase_quotations',
        'credit_notes',
        'sales_invoice_items',
        'sales_invoices',
        'sales_orders',
        'sales_quotations',
        'journal_items',
        'journal_entries',
        'products',
        'product_categories',
        'suppliers',
        'customers',
        'employees',
        'departments',
        'bank_accounts',
        'tax_periods',
        'tax_rates',
        'chart_of_accounts',
        'fiscal_years',
        'users',
        'companies',
        'audit_logs'
    ];

    for (const table of tablesToClear) {
        db.prepare(`DELETE FROM ${table}`).run();
        try {
            db.prepare(`DELETE FROM sqlite_sequence WHERE name = '${table}'`).run();
        } catch (e) {
            // sqlite_sequence may not contain the table, safe to ignore
        }
    }

    db.pragma('foreign_keys = ON');

    // 1. Clean Company Profile
    const companyStmt = db.prepare(`
        INSERT INTO companies (id, name, legal_name, tax_id, currency, fiscal_year_start, address, city, country, phone, email)
        VALUES (1, 'Enterprise Financials', 'Enterprise Financials Inc.', '', 'USD', '01-01', '', '', 'United States', '', '')
    `);
    companyStmt.run();

    // 2. Active Fiscal Year
    db.prepare(`
        INSERT INTO fiscal_years (id, company_id, name, start_date, end_date, is_closed, is_active)
        VALUES (1, 1, 'FY 2026', '2026-01-01', '2026-12-31', 0, 1)
    `).run();

    // 3. Clean Standard Users for Authentication & RBAC
    const salt = bcrypt.genSaltSync(10);
    const users = [
        { username: 'admin', email: 'admin@enterprise.local', pass: 'admin123', name: 'System Administrator', role: 'Super Admin', dept: 'Executive' },
        { username: 'finance', email: 'finance@enterprise.local', pass: 'finance123', name: 'Finance Manager', role: 'Finance Manager', dept: 'Finance' },
        { username: 'accountant', email: 'accountant@enterprise.local', pass: 'account123', name: 'Staff Accountant', role: 'Accountant', dept: 'Accounting' },
        { username: 'auditor', email: 'auditor@enterprise.local', pass: 'audit123', name: 'Internal Auditor', role: 'Auditor', dept: 'Internal Audit' },
        { username: 'viewer', email: 'viewer@enterprise.local', pass: 'viewer123', name: 'Executive Viewer', role: 'Viewer', dept: 'Operations' }
    ];

    const insertUser = db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, role, department)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const u of users) {
        insertUser.run(u.username, u.email, bcrypt.hashSync(u.pass, salt), u.name, u.role, u.dept);
    }

    // 4. Standard Chart of Accounts (COA - Required for Double-Entry Accounting Engine)
    const accounts = [
        // Assets (10000 - 19999)
        { code: '10100', name: 'Petty Cash', type: 'ASSET', sub_category: 'Cash & Bank', is_reconcilable: 1, desc: 'On-hand petty cash fund' },
        { code: '10200', name: 'Operating Bank Account', type: 'ASSET', sub_category: 'Cash & Bank', is_reconcilable: 1, desc: 'Primary operating checking account' },
        { code: '10300', name: 'Payroll Bank Account', type: 'ASSET', sub_category: 'Cash & Bank', is_reconcilable: 1, desc: 'Dedicated payroll funding account' },
        { code: '11000', name: 'Accounts Receivable', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'Amounts owed by customers for billed services/products' },
        { code: '12000', name: 'Allowance for Doubtful Accounts', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'Contra-asset reserve for uncollectible AR' },
        { code: '13000', name: 'Merchandise Inventory', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'Goods and materials held for resale' },
        { code: '14000', name: 'Input Tax Receivable (Purchase Tax)', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'VAT/GST recoverable on purchase invoices' },
        { code: '15000', name: 'Prepaid Expenses & Insurance', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'Advance payments for services and policies' },
        { code: '17000', name: 'IT Infrastructure & Equipment', type: 'ASSET', sub_category: 'Fixed Assets', is_reconcilable: 0, desc: 'Hardware, computers, servers and office equipment' },
        { code: '17500', name: 'Accumulated Depreciation - IT Equipment', type: 'ASSET', sub_category: 'Fixed Assets', is_reconcilable: 0, desc: 'Contra-asset cumulative depreciation' },
        
        // Liabilities (20000 - 29999)
        { code: '20000', name: 'Accounts Payable', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'Amounts owed to vendors for purchases' },
        { code: '20100', name: 'Accrued Salaries & Wages Payable', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'Accrued employee compensation' },
        { code: '22000', name: 'Output Tax Payable (Sales Tax)', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'VAT/Sales tax collected from customer invoices' },
        { code: '22100', name: 'Payroll Taxes Payable', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'Withheld employee income tax and social security' },
        { code: '25000', name: 'Commercial Term Loan', type: 'LIABILITY', sub_category: 'Long Term Debt', is_reconcilable: 0, desc: 'Long-term corporate debt financing' },

        // Equity (30000 - 39999)
        { code: '30000', name: 'Common Stock & Paid-In Capital', type: 'EQUITY', sub_category: 'Owner Capital', is_reconcilable: 0, desc: 'Contributed equity capital' },
        { code: '31000', name: 'Retained Earnings', type: 'EQUITY', sub_category: 'Retained Earnings', is_reconcilable: 0, desc: 'Accumulated prior period earnings' },
        { code: '32000', name: 'Shareholder Distributions', type: 'EQUITY', sub_category: 'Owner Capital', is_reconcilable: 0, desc: 'Dividends and equity withdrawals' },

        // Revenue (40000 - 49999)
        { code: '40000', name: 'Sales & License Revenue', type: 'REVENUE', sub_category: 'Operating Revenue', is_reconcilable: 0, desc: 'Revenue from software, products and licenses' },
        { code: '41000', name: 'Consulting & Professional Services', type: 'REVENUE', sub_category: 'Operating Revenue', is_reconcilable: 0, desc: 'Consulting, integration and advisory engagements' },
        { code: '42000', name: 'Subscription & Maintenance Revenue', type: 'REVENUE', sub_category: 'Operating Revenue', is_reconcilable: 0, desc: 'Recurring maintenance, SaaS and cloud hosting' },
        { code: '49000', name: 'Interest & Finance Income', type: 'REVENUE', sub_category: 'Other Revenue', is_reconcilable: 0, desc: 'Interest earned on deposits' },

        // Cost of Goods Sold (50000 - 59999)
        { code: '50000', name: 'Cost of Goods Sold', type: 'EXPENSE', sub_category: 'Cost of Goods Sold', is_reconcilable: 0, desc: 'Direct cost of merchandise/services recognized upon sale' },
        { code: '50100', name: 'Direct Cloud & Infrastructure Costs', type: 'EXPENSE', sub_category: 'Cost of Goods Sold', is_reconcilable: 0, desc: 'Direct hosting and cloud compute costs' },
        { code: '50200', name: 'Inventory Shrinkage & Adjustments', type: 'EXPENSE', sub_category: 'Cost of Goods Sold', is_reconcilable: 0, desc: 'Stock loss or count reconciliation discrepancies' },

        // Operating Expenses (60000 - 69999)
        { code: '60100', name: 'Office Supplies & Software Tools', type: 'EXPENSE', sub_category: 'Administrative Expenses', is_reconcilable: 0, desc: 'Internal software tools and general office supplies' },
        { code: '60200', name: 'Travel & Business Entertainment', type: 'EXPENSE', sub_category: 'Operating Expenses', is_reconcilable: 0, desc: 'Business travel, meals, lodging and transportation' },
        { code: '60300', name: 'Salaries & Employee Compensation', type: 'EXPENSE', sub_category: 'Personnel Expenses', is_reconcilable: 0, desc: 'Staff compensation, bonuses and benefits' },
        { code: '60400', name: 'Rent, Facilities & Utilities', type: 'EXPENSE', sub_category: 'Administrative Expenses', is_reconcilable: 0, desc: 'Facility lease, electricity and maintenance' },
        { code: '60500', name: 'Sales & Marketing Advertising', type: 'EXPENSE', sub_category: 'Sales & Marketing', is_reconcilable: 0, desc: 'Advertising campaigns, sponsorships and conferences' },
        { code: '60600', name: 'Legal, Audit & Professional Fees', type: 'EXPENSE', sub_category: 'Administrative Expenses', is_reconcilable: 0, desc: 'Legal counsel, audit fees and filings' },
        { code: '60700', name: 'Depreciation & Amortization', type: 'EXPENSE', sub_category: 'Depreciation', is_reconcilable: 0, desc: 'Fixed asset wear and depreciation' }
    ];

    const insertCoa = db.prepare(`
        INSERT INTO chart_of_accounts (code, name, type, sub_category, is_reconcilable, description)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const acc of accounts) {
        insertCoa.run(acc.code, acc.name, acc.type, acc.sub_category, acc.is_reconcilable, acc.desc);
    }

    // 5. Standard Tax Rates
    const salesTaxAcc = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '22000'").get();
    const purchaseTaxAcc = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '14000'").get();

    db.prepare(`
        INSERT INTO tax_rates (name, code, rate, type, sales_tax_account_id, purchase_tax_account_id, description)
        VALUES 
        ('Standard VAT 10%', 'VAT-10', 10.0, 'BOTH', ?, ?, 'Standard enterprise goods and services tax rate'),
        ('Reduced Rate 5%', 'VAT-05', 5.0, 'BOTH', ?, ?, 'Reduced rate for eligible items'),
        ('State Tax 8.25%', 'ST-825', 8.25, 'SALES', ?, NULL, 'Regional sales taxation'),
        ('Tax Exempt 0%', 'ZERO-00', 0.0, 'BOTH', ?, ?, 'Zero rated or exempt transactions')
    `).run(
        salesTaxAcc.id, purchaseTaxAcc.id,
        salesTaxAcc.id, purchaseTaxAcc.id,
        salesTaxAcc.id,
        salesTaxAcc.id, purchaseTaxAcc.id
    );

    // 6. Baseline Expense Categories
    const offSuppGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60100'").get();
    const travelGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60200'").get();
    const rentGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60400'").get();
    const mktGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60500'").get();
    const legalGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60600'").get();

    db.prepare(`
        INSERT INTO expense_categories (name, code, gl_account_id, description)
        VALUES 
        ('Office Supplies & Software SaaS', 'EXP-OFFICE', ?, 'General software tools and office supplies'),
        ('Travel & Lodging', 'EXP-TRAVEL', ?, 'Business travel, flights, lodging and transportation'),
        ('Office Facilities & Lease', 'EXP-RENT', ?, 'Office lease and utilities'),
        ('Marketing & Advertising', 'EXP-MKT', ?, 'Campaigns, advertising and corporate events'),
        ('Legal & Professional Fees', 'EXP-LEGAL', ?, 'Legal, statutory and compliance counsel')
    `).run(offSuppGl.id, travelGl.id, rentGl.id, mktGl.id, legalGl.id);

    // 7. Audit log
    AuditService.log({
        username: 'System',
        action: 'INITIALIZE_SYSTEM',
        entity: 'Database',
        entityId: '0',
        details: 'Clean baseline enterprise accounting setup initialized. No demo data.'
    });

    console.log('--- Clean Baseline Enterprise Accounting Setup Complete ---');
}

seedDatabase();
