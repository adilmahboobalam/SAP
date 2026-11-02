const db = require('./database');
const bcrypt = require('bcryptjs');
const AccountingEngine = require('../services/accountingEngine');
const AuditService = require('../services/auditService');

function seedDatabase() {
    console.log('--- Starting Enterprise Accounting Database Seeding ---');

    // 1. Company Profile
    db.prepare('DELETE FROM companies').run();
    const companyStmt = db.prepare(`
        INSERT INTO companies (id, name, legal_name, tax_id, currency, fiscal_year_start, address, city, country, phone, email)
        VALUES (1, 'Apex Enterprise Solutions', 'Apex Enterprise Solutions Corp.', 'US-94-2849102', 'USD', '01-01', '100 Enterprise Blvd, Suite 800', 'New York', 'United States', '+1 (212) 555-0199', 'finance@apexenterprise.com')
    `);
    companyStmt.run();

    // 2. Fiscal Years
    db.prepare('DELETE FROM fiscal_years').run();
    db.prepare(`
        INSERT INTO fiscal_years (id, company_id, name, start_date, end_date, is_closed, is_active)
        VALUES 
        (1, 1, 'FY 2026', '2026-01-01', '2026-12-31', 0, 1),
        (2, 1, 'FY 2025', '2025-01-01', '2025-12-31', 1, 0)
    `).run();

    // 3. Users with hashed passwords
    db.prepare('DELETE FROM users').run();
    const salt = bcrypt.genSaltSync(10);
    const users = [
        { username: 'admin', email: 'admin@apexenterprise.com', pass: 'admin123', name: 'Alexander Wright', role: 'Super Admin', dept: 'Executive' },
        { username: 'finance.manager', email: 'elena.vance@apexenterprise.com', pass: 'finance123', name: 'Elena Vance, CPA', role: 'Finance Manager', dept: 'Finance' },
        { username: 'accountant', email: 'marcus.brooks@apexenterprise.com', pass: 'account123', name: 'Marcus Brooks', role: 'Accountant', dept: 'Accounting' },
        { username: 'auditor', email: 'sophia.chen@apexenterprise.com', pass: 'audit123', name: 'Sophia Chen', role: 'Auditor', dept: 'Internal Audit' },
        { username: 'viewer', email: 'viewer@apexenterprise.com', pass: 'viewer123', name: 'David Miller', role: 'Viewer', dept: 'Operations' }
    ];

    const insertUser = db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, role, department)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const u of users) {
        insertUser.run(u.username, u.email, bcrypt.hashSync(u.pass, salt), u.name, u.role, u.dept);
    }

    // 4. Chart of Accounts (COA)
    db.prepare('DELETE FROM chart_of_accounts').run();
    const accounts = [
        // Assets (10000 - 19999)
        { code: '10100', name: 'Petty Cash', type: 'ASSET', sub_category: 'Cash & Bank', is_reconcilable: 1, desc: 'On-hand petty cash' },
        { code: '10200', name: 'Operating Account (JPMorgan Chase)', type: 'ASSET', sub_category: 'Cash & Bank', is_reconcilable: 1, desc: 'Primary checking operating bank account' },
        { code: '10300', name: 'Payroll Account (Wells Fargo)', type: 'ASSET', sub_category: 'Cash & Bank', is_reconcilable: 1, desc: 'Dedicated payroll funding account' },
        { code: '11000', name: 'Accounts Receivable', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'Amounts owed by customers for billed services/products' },
        { code: '12000', name: 'Allowance for Doubtful Accounts', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'Contra-asset reserve for uncollectible AR' },
        { code: '13000', name: 'Merchandise Inventory', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'Goods and materials held for resale' },
        { code: '14000', name: 'Input Tax Receivable (Purchase Tax)', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'VAT/GST recoverable on purchase invoices' },
        { code: '15000', name: 'Prepaid Expenses & Insurance', type: 'ASSET', sub_category: 'Current Assets', is_reconcilable: 0, desc: 'Advance payments for services' },
        { code: '17000', name: 'IT Infrastructure & Equipment', type: 'ASSET', sub_category: 'Fixed Assets', is_reconcilable: 0, desc: 'Servers, computers and office hardware' },
        { code: '17500', name: 'Accumulated Depreciation - IT Equipment', type: 'ASSET', sub_category: 'Fixed Assets', is_reconcilable: 0, desc: 'Contra-asset cumulative depreciation' },
        
        // Liabilities (20000 - 29999)
        { code: '20000', name: 'Accounts Payable', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'Amounts owed to vendors for purchases' },
        { code: '20100', name: 'Accrued Salaries & Wages Payable', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'Accrued employee compensation' },
        { code: '22000', name: 'Output Tax Payable (Sales Tax)', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'VAT/Sales tax collected from customer invoices' },
        { code: '22100', name: 'Payroll Taxes Payable', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'Withheld employee income tax and social security' },
        { code: '25000', name: 'Commercial Term Loan', type: 'LIABILITY', sub_category: 'Long Term Debt', is_reconcilable: 0, desc: 'Long-term bank financing' },

        // Equity (30000 - 39999)
        { code: '30000', name: 'Common Stock & Paid-In Capital', type: 'EQUITY', sub_category: 'Owner Capital', is_reconcilable: 0, desc: 'Contributed equity capital' },
        { code: '31000', name: 'Retained Earnings', type: 'EQUITY', sub_category: 'Retained Earnings', is_reconcilable: 0, desc: 'Accumulated prior period earnings' },
        { code: '32000', name: 'Shareholder Distributions', type: 'EQUITY', sub_category: 'Owner Capital', is_reconcilable: 0, desc: 'Dividends and equity withdrawals' },

        // Revenue (40000 - 49999)
        { code: '40000', name: 'Software Enterprise Licenses', type: 'REVENUE', sub_category: 'Operating Revenue', is_reconcilable: 0, desc: 'Perpetual and term software licenses' },
        { code: '41000', name: 'Implementation & Consulting Services', type: 'REVENUE', sub_category: 'Operating Revenue', is_reconcilable: 0, desc: 'Professional ERP consulting and custom engineering' },
        { code: '42000', name: 'SaaS Subscriptions & Support', type: 'REVENUE', sub_category: 'Operating Revenue', is_reconcilable: 0, desc: 'Recurring maintenance and cloud hosting' },
        { code: '49000', name: 'Interest & Finance Income', type: 'REVENUE', sub_category: 'Other Revenue', is_reconcilable: 0, desc: 'Bank interest earned' },

        // Cost of Goods Sold (50000 - 59999)
        { code: '50000', name: 'Cost of Goods Sold - Hardware & Licenses', type: 'EXPENSE', sub_category: 'Cost of Goods Sold', is_reconcilable: 0, desc: 'Direct inventory cost recognized upon sale' },
        { code: '50100', name: 'Direct Cloud Infrastructure (AWS/Azure)', type: 'EXPENSE', sub_category: 'Cost of Goods Sold', is_reconcilable: 0, desc: 'Client hosting cost' },
        { code: '50200', name: 'Inventory Shrinkage & Adjustments', type: 'EXPENSE', sub_category: 'Cost of Goods Sold', is_reconcilable: 0, desc: 'Stock loss or audit discrepancy' },

        // Operating Expenses (60000 - 69999)
        { code: '60100', name: 'Office Supplies & Software Tools', type: 'EXPENSE', sub_category: 'Administrative Expenses', is_reconcilable: 0, desc: 'Internal software tooling and supplies' },
        { code: '60200', name: 'Travel & Business Entertainment', type: 'EXPENSE', sub_category: 'Operating Expenses', is_reconcilable: 0, desc: 'Client visits, airfare, meals' },
        { code: '60300', name: 'Salaries & Employee Compensation', type: 'EXPENSE', sub_category: 'Personnel Expenses', is_reconcilable: 0, desc: 'Full-time staff compensation' },
        { code: '60400', name: 'Rent, Facilities & Utilities', type: 'EXPENSE', sub_category: 'Administrative Expenses', is_reconcilable: 0, desc: 'Corporate office lease' },
        { code: '60500', name: 'Sales & Marketing Advertising', type: 'EXPENSE', sub_category: 'Sales & Marketing', is_reconcilable: 0, desc: 'Conferences, campaigns and sponsorships' },
        { code: '60600', name: 'Legal, Audit & Professional Fees', type: 'EXPENSE', sub_category: 'Administrative Expenses', is_reconcilable: 0, desc: 'External legal and statutory audit counsel' },
        { code: '60700', name: 'Depreciation & Amortization', type: 'EXPENSE', sub_category: 'Depreciation', is_reconcilable: 0, desc: 'Non-cash fixed asset wear' }
    ];

    const insertCoa = db.prepare(`
        INSERT INTO chart_of_accounts (code, name, type, sub_category, is_reconcilable, description)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const acc of accounts) {
        insertCoa.run(acc.code, acc.name, acc.type, acc.sub_category, acc.is_reconcilable, acc.desc);
    }

    // 5. Tax Rates
    db.prepare('DELETE FROM tax_rates').run();
    const salesTaxAcc = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '22000'").get();
    const purchaseTaxAcc = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '14000'").get();

    db.prepare(`
        INSERT INTO tax_rates (name, code, rate, type, sales_tax_account_id, purchase_tax_account_id, description)
        VALUES 
        ('Standard Sales VAT 10%', 'VAT-10', 10.0, 'BOTH', ?, ?, 'Standard enterprise goods and services tax rate'),
        ('Reduced Rate 5%', 'VAT-05', 5.0, 'BOTH', ?, ?, 'Reduced hospitality and essential rate'),
        ('Tech State Tax 8.25%', 'ST-825', 8.25, 'SALES', ?, NULL, 'Regional tech service taxation'),
        ('Tax Exempt 0%', 'ZERO-00', 0.0, 'BOTH', ?, ?, 'Zero rated or offshore exports')
    `).run(
        salesTaxAcc.id, purchaseTaxAcc.id,
        salesTaxAcc.id, purchaseTaxAcc.id,
        salesTaxAcc.id,
        salesTaxAcc.id, purchaseTaxAcc.id
    );

    // 6. Bank Accounts
    db.prepare('DELETE FROM bank_accounts').run();
    const chaseGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '10200'").get();
    const wellsGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '10300'").get();
    const pettyGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '10100'").get();

    db.prepare(`
        INSERT INTO bank_accounts (account_code, bank_name, account_number, account_type, gl_account_id, currency, opening_balance)
        VALUES 
        ('BA-CHASE-01', 'JPMorgan Chase Bank, N.A.', '•••• 4892 - Operating Checking', 'CHECKING', ?, 'USD', 350000.00),
        ('BA-WELLS-02', 'Wells Fargo Bank', '•••• 9104 - Payroll Disbursement', 'CHECKING', ?, 'USD', 120000.00),
        ('BA-VAULT-03', 'Headquarters Petty Cash Vault', 'CASH-VAULT-HQ', 'CASH', ?, 'USD', 5000.00)
    `).run(chaseGl.id, wellsGl.id, pettyGl.id);

    // 7. Customers
    db.prepare('DELETE FROM customers').run();
    const customers = [
        { code: 'CUST-001', name: 'Siemens Industrial Systems', email: 'billing@siemens-na.com', phone: '+1 (412) 555-9011', tax: 'US-3829104', address: '500 Tech Blvd', city: 'Pittsburgh, PA', limit: 100000, terms: 30 },
        { code: 'CUST-002', name: 'BMW Manufacturing USA', email: 'ap-portal@bmwusa.com', phone: '+1 (864) 555-4300', tax: 'US-8492019', address: '1400 Highway 101', city: 'Spartanburg, SC', limit: 250000, terms: 45 },
        { code: 'CUST-003', name: 'Deloitte Digital Consulting', email: 'vendor.finance@deloitte.com', phone: '+1 (212) 555-8820', tax: 'US-1394820', address: '30 Rockefeller Plaza', city: 'New York, NY', limit: 150000, terms: 30 },
        { code: 'CUST-004', name: 'Novartis Healthcare Research', email: 'invoices@novartis-us.com', phone: '+1 (862) 555-1200', tax: 'US-2294019', address: 'One Health Plaza', city: 'East Hanover, NJ', limit: 80000, terms: 30 },
        { code: 'CUST-005', name: 'Vanguard Asset Management', email: 'accounts@vanguard-corp.com', phone: '+1 (610) 555-7730', tax: 'US-4920192', address: '100 Vanguard Blvd', city: 'Malvern, PA', limit: 200000, terms: 15 }
    ];

    const insertCust = db.prepare(`
        INSERT INTO customers (code, name, email, phone, tax_number, address, city, credit_limit, payment_terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of customers) {
        insertCust.run(c.code, c.name, c.email, c.phone, c.tax, c.address, c.city, c.limit, c.terms);
    }

    // 8. Suppliers
    db.prepare('DELETE FROM suppliers').run();
    const suppliers = [
        { code: 'SUPP-001', name: 'Amazon Web Services (AWS)', email: 'aws-invoicing@amazon.com', phone: '+1 (206) 555-0100', tax: 'US-9182390', address: '410 Terry Ave N', city: 'Seattle, WA', terms: 30 },
        { code: 'SUPP-002', name: 'Dell Enterprise Technologies', email: 'ar@dell.com', phone: '+1 (800) 555-3355', tax: 'US-7492018', address: 'One Dell Way', city: 'Round Rock, TX', terms: 30 },
        { code: 'SUPP-003', name: 'Regus Executive Workspace', email: 'billing@regus.com', phone: '+1 (212) 555-9000', tax: 'US-5829103', address: '1501 Broadway', city: 'New York, NY', terms: 15 },
        { code: 'SUPP-004', name: 'McKinsey Strategy Partners', email: 'ap-vendor@mckinsey.com', phone: '+1 (212) 555-4400', tax: 'US-1392018', address: '3 World Trade Center', city: 'New York, NY', terms: 30 },
        { code: 'SUPP-005', name: 'Cisco Networking Systems', email: 'orders@cisco.com', phone: '+1 (408) 555-5000', tax: 'US-9428190', address: '170 W Tasman Dr', city: 'San Jose, CA', terms: 30 }
    ];

    const insertSupp = db.prepare(`
        INSERT INTO suppliers (code, name, email, phone, tax_number, address, city, payment_terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of suppliers) {
        insertSupp.run(s.code, s.name, s.email, s.phone, s.tax, s.address, s.city, s.terms);
    }

    // 9. Products & Categories
    db.prepare('DELETE FROM product_categories').run();
    db.prepare('DELETE FROM products').run();

    db.prepare(`
        INSERT INTO product_categories (id, name, code, description)
        VALUES 
        (1, 'Software Licenses', 'CAT-SW', 'Core software systems and seat licenses'),
        (2, 'Hardware & Appliances', 'CAT-HW', 'Dedicated rack servers and security appliances'),
        (3, 'Professional Services', 'CAT-SRV', 'Consulting, integration and advisory engagements')
    `).run();

    const revAcc = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '40000'").get();
    const cogsAcc = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '50000'").get();
    const invAcc = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '13000'").get();

    db.prepare(`
        INSERT INTO products (sku, name, category_id, unit, cost_price, selling_price, current_stock, reorder_level, inventory_account_id, revenue_account_id, cogs_account_id)
        VALUES 
        ('SKU-ERP-CORP', 'AuraERP Enterprise Core License', 1, 'License', 1500.00, 4800.00, 100.0, 10.0, ?, ?, ?),
        ('SKU-SRV-RACK', 'Aura Enterprise Server Node X8', 2, 'Unit', 3200.00, 6900.00, 24.0, 5.0, ?, ?, ?),
        ('SKU-CNS-SPEC', 'ERP Implementation Specialist (Day)', 3, 'Day', 450.00, 1450.00, 200.0, 20.0, ?, ?, ?),
        ('SKU-SEC-APPL', 'Cryptographic Security Gateway V2', 2, 'Unit', 1800.00, 3950.00, 18.0, 5.0, ?, ?, ?)
    `).run(
        invAcc.id, revAcc.id, cogsAcc.id,
        invAcc.id, revAcc.id, cogsAcc.id,
        invAcc.id, revAcc.id, cogsAcc.id,
        invAcc.id, revAcc.id, cogsAcc.id
    );

    // 10. Departments & Employees
    db.prepare('DELETE FROM departments').run();
    db.prepare('DELETE FROM employees').run();

    db.prepare(`
        INSERT INTO departments (id, name, code)
        VALUES 
        (1, 'Executive Leadership', 'DEPT-EXEC'),
        (2, 'Finance & Accounting', 'DEPT-FIN'),
        (3, 'Software Engineering', 'DEPT-ENG'),
        (4, 'Professional Services', 'DEPT-SRV'),
        (5, 'Enterprise Sales', 'DEPT-SALES')
    `).run();

    const employees = [
        { code: 'EMP-001', first: 'Alexander', last: 'Wright', email: 'a.wright@apexenterprise.com', dept: 1, pos: 'Chief Executive Officer', salary: 18000, allow: 2500, bank: 'Chase', acc: '9841' },
        { code: 'EMP-002', first: 'Elena', last: 'Vance', email: 'e.vance@apexenterprise.com', dept: 2, pos: 'Chief Financial Officer, CPA', salary: 14500, allow: 1800, bank: 'Wells Fargo', acc: '3819' },
        { code: 'EMP-003', first: 'Devon', last: 'Kaufman', email: 'd.kaufman@apexenterprise.com', dept: 3, pos: 'Principal Solutions Architect', salary: 13000, allow: 1200, bank: 'Citibank', acc: '1102' },
        { code: 'EMP-004', first: 'Marcus', last: 'Brooks', email: 'm.brooks@apexenterprise.com', dept: 2, pos: 'Senior Controller', salary: 8500, allow: 800, bank: 'Bank of America', acc: '5420' },
        { code: 'EMP-005', first: 'Victoria', last: 'Sterling', email: 'v.sterling@apexenterprise.com', dept: 5, pos: 'VP Global Enterprise Sales', salary: 11000, allow: 3200, bank: 'Chase', acc: '7721' }
    ];

    const insertEmp = db.prepare(`
        INSERT INTO employees (employee_code, first_name, last_name, email, department_id, position, hire_date, basic_salary, allowances, bank_name, bank_account)
        VALUES (?, ?, ?, ?, ?, ?, '2024-01-15', ?, ?, ?, ?)
    `);
    for (const e of employees) {
        insertEmp.run(e.code, e.first, e.last, e.email, e.dept, e.pos, e.salary, e.allow, e.bank, e.acc);
    }

    // 11. Expense Categories
    db.prepare('DELETE FROM expense_categories').run();
    const offSuppGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60100'").get();
    const travelGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60200'").get();
    const rentGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60400'").get();
    const mktGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60500'").get();
    const legalGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '60600'").get();

    db.prepare(`
        INSERT INTO expense_categories (name, code, gl_account_id, description)
        VALUES 
        ('Office Supplies & Software SaaS', 'EXP-OFFICE', ?, 'Internal IT tools, Slack, GitHub, Office 365, stationery'),
        ('Executive Travel & Lodging', 'EXP-TRAVEL', ?, 'Airlines, hotels, ground transportation, business dinners'),
        ('Office Facilities & Lease', 'EXP-RENT', ?, 'Corporate headquarters floor lease and building maintenance'),
        ('Marketing Campaigns & Sponsorships', 'EXP-MKT', ?, 'Enterprise trade shows, Gartner summit, online ads'),
        ('Legal & Compliance Consulting', 'EXP-LEGAL', ?, 'External legal review, SOC2 audits and corporate filings')
    `).run(offSuppGl.id, travelGl.id, rentGl.id, mktGl.id, legalGl.id);

    // 12. Tax Periods
    db.prepare('DELETE FROM tax_periods').run();
    db.prepare(`
        INSERT INTO tax_periods (name, start_date, end_date, status)
        VALUES 
        ('Q1 2026 Tax Period', '2026-01-01', '2026-03-31', 'OPEN'),
        ('Q4 2025 Tax Period', '2025-10-01', '2025-12-31', 'FILED')
    `).run();

    console.log('--- Master Data Initialized. Seeding Accounting Ledger & Transactions ---');

    // Clean up transaction tables
    db.prepare('DELETE FROM journal_items').run();
    db.prepare('DELETE FROM journal_entries').run();
    db.prepare('DELETE FROM sales_invoice_items').run();
    db.prepare('DELETE FROM sales_invoices').run();
    db.prepare('DELETE FROM sales_orders').run();
    db.prepare('DELETE FROM sales_quotations').run();
    db.prepare('DELETE FROM purchase_invoice_items').run();
    db.prepare('DELETE FROM purchase_invoices').run();
    db.prepare('DELETE FROM purchase_orders').run();
    db.prepare('DELETE FROM purchase_quotations').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM bank_transactions').run();
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM payroll_runs').run();
    db.prepare('DELETE FROM payslips').run();
    db.prepare('DELETE FROM stock_movements').run();

    // 13. POSTING OPENING BALANCES (Double-Entry Balanced!)
    // Debit: Cash in Chase (10200) $350,000, Wells Fargo (10300) $120,000, Equipment (17000) $80,000, Inventory (13000) $75,000
    // Total Debits: $625,000
    // Credit: Common Stock (30000) $400,000, Long Term Debt (25000) $150,000, Retained Earnings (31000) $75,000
    // Total Credits: $625,000
    const equipGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '17000'").get();
    const stockGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '30000'").get();
    const loanGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '25000'").get();
    const reGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '31000'").get();

    AccountingEngine.postJournalEntry({
        entryDate: '2026-01-01',
        postingDate: '2026-01-01',
        reference: 'OPEN-2026',
        description: 'Opening Fiscal Year 2026 Balance Sheet Initialization',
        sourceModule: 'MANUAL',
        items: [
            { accountId: chaseGl.id, debit: 350000.00, credit: 0, description: 'Opening Operating Cash - Chase' },
            { accountId: wellsGl.id, debit: 120000.00, credit: 0, description: 'Opening Payroll Cash - Wells Fargo' },
            { accountId: equipGl.id, debit: 80000.00, credit: 0, description: 'Opening IT & Server Assets' },
            { accountId: invAcc.id, debit: 75000.00, credit: 0, description: 'Opening Merchandise Inventory' },
            { accountId: stockGl.id, debit: 0, credit: 400000.00, description: 'Issued Shareholder Equity' },
            { accountId: loanGl.id, debit: 0, credit: 150000.00, description: 'Commercial Term Financing' },
            { accountId: reGl.id, debit: 0, credit: 75000.00, description: 'Prior Period Cumulative Earnings' }
        ],
        createdBy: 'Elena Vance, CPA',
        username: 'finance.manager'
    });

    // 14. SALES INVOICE 1: Siemens Industrial ($48,000 software + $4,800 tax = $52,800)
    const stdTax = db.prepare("SELECT * FROM tax_rates WHERE code = 'VAT-10'").get();
    const prod1 = db.prepare("SELECT * FROM products WHERE sku = 'SKU-ERP-CORP'").get();
    const cust1 = db.prepare("SELECT * FROM customers WHERE code = 'CUST-001'").get();

    const inv1Res = db.prepare(`
        INSERT INTO sales_invoices (invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, notes, created_by)
        VALUES ('INV-2026-00001', ?, '2026-01-10', '2026-02-10', 'DRAFT', 48000.00, 4800.00, 52800.00, 0, 'Annual Enterprise S/4 Connector deployment', 'Elena Vance')
    `).run(cust1.id);
    const inv1Id = inv1Res.lastInsertRowid;

    db.prepare(`
        INSERT INTO sales_invoice_items (invoice_id, product_id, account_id, description, quantity, unit_price, tax_rate_id, tax_amount, line_total)
        VALUES (?, ?, ?, 'AuraERP Enterprise Core License (10 Seats)', 10, 4800.00, ?, 4800.00, 52800.00)
    `).run(inv1Id, prod1.id, revAcc.id, stdTax.id);

    // Post Invoice 1 (Auto creates double-entry journal, deducts inventory, posts AR & Output Tax)
    AccountingEngine.postSalesInvoice(inv1Id, 'finance.manager');

    // Customer Payment for Invoice 1 (Full payment received into Chase bank)
    const chaseBank = db.prepare("SELECT id FROM bank_accounts WHERE account_code = 'BA-CHASE-01'").get();
    const pay1Res = db.prepare(`
        INSERT INTO payments (payment_number, payment_type, entity_type, entity_id, invoice_id, payment_date, bank_account_id, payment_method, amount, reference, notes, created_by)
        VALUES ('PAY-2026-00001', 'RECEIPT', 'CUSTOMER', ?, ?, '2026-01-22', ?, 'BANK_TRANSFER', 52800.00, 'WIRE-SIEMENS-9910', 'Full invoice settlement', 'Marcus Brooks')
    `).run(cust1.id, inv1Id, chaseBank.id);
    AccountingEngine.postCustomerPayment(pay1Res.lastInsertRowid, 'accountant');

    // 15. SALES INVOICE 2: BMW Manufacturing ($69,000 hardware nodes + $6,900 tax = $75,900)
    const prod2 = db.prepare("SELECT * FROM products WHERE sku = 'SKU-SRV-RACK'").get();
    const cust2 = db.prepare("SELECT * FROM customers WHERE code = 'CUST-002'").get();

    const inv2Res = db.prepare(`
        INSERT INTO sales_invoices (invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, notes, created_by)
        VALUES ('INV-2026-00002', ?, '2026-01-18', '2026-03-05', 'DRAFT', 69000.00, 6900.00, 75900.00, 0, 'Server Nodes for Spartanburg Data Center', 'Elena Vance')
    `).run(cust2.id);
    const inv2Id = inv2Res.lastInsertRowid;

    db.prepare(`
        INSERT INTO sales_invoice_items (invoice_id, product_id, account_id, description, quantity, unit_price, tax_rate_id, tax_amount, line_total)
        VALUES (?, ?, ?, 'Aura Enterprise Server Node X8', 10, 6900.00, ?, 6900.00, 75900.00)
    `).run(inv2Id, prod2.id, revAcc.id, stdTax.id);

    AccountingEngine.postSalesInvoice(inv2Id, 'finance.manager');

    // Partial Payment of $35,000 for Invoice 2
    const pay2Res = db.prepare(`
        INSERT INTO payments (payment_number, payment_type, entity_type, entity_id, invoice_id, payment_date, bank_account_id, payment_method, amount, reference, notes, created_by)
        VALUES ('PAY-2026-00002', 'RECEIPT', 'CUSTOMER', ?, ?, '2026-02-01', ?, 'BANK_TRANSFER', 35000.00, 'BMW-AP-TRANS-8120', '50% progress milestone payment', 'Marcus Brooks')
    `).run(cust2.id, inv2Id, chaseBank.id);
    AccountingEngine.postCustomerPayment(pay2Res.lastInsertRowid, 'accountant');

    // 16. SALES INVOICE 3: Deloitte Digital ($29,000 consulting services + $2,900 tax = $31,900) - Unpaid (Outstanding AR)
    const prod3 = db.prepare("SELECT * FROM products WHERE sku = 'SKU-CNS-SPEC'").get();
    const cust3 = db.prepare("SELECT * FROM customers WHERE code = 'CUST-003'").get();
    const cnsRevAcc = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '41000'").get();

    const inv3Res = db.prepare(`
        INSERT INTO sales_invoices (invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, notes, created_by)
        VALUES ('INV-2026-00003', ?, '2026-02-05', '2026-03-07', 'DRAFT', 29000.00, 2900.00, 31900.00, 0, '20 Specialist Days for Architecture Modernization', 'Marcus Brooks')
    `).run(cust3.id);
    const inv3Id = inv3Res.lastInsertRowid;

    db.prepare(`
        INSERT INTO sales_invoice_items (invoice_id, product_id, account_id, description, quantity, unit_price, tax_rate_id, tax_amount, line_total)
        VALUES (?, ?, ?, 'ERP Implementation Specialist (20 Days)', 20, 1450.00, ?, 2900.00, 31900.00)
    `).run(inv3Id, prod3.id, cnsRevAcc.id, stdTax.id);

    AccountingEngine.postSalesInvoice(inv3Id, 'finance.manager');

    // 17. PURCHASE INVOICE 1: Amazon Web Services Cloud Infrastructure ($18,500 + $1,850 tax = $20,350)
    const supp1 = db.prepare("SELECT * FROM suppliers WHERE code = 'SUPP-001'").get();
    const cloudCostGl = db.prepare("SELECT id FROM chart_of_accounts WHERE code = '50100'").get();

    const bill1Res = db.prepare(`
        INSERT INTO purchase_invoices (bill_number, supplier_id, bill_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, notes, created_by)
        VALUES ('BILL-2026-00001', ?, '2026-01-15', '2026-02-15', 'DRAFT', 18500.00, 1850.00, 20350.00, 0, 'Cloud Production Cluster compute & RDS storage', 'Marcus Brooks')
    `).run(supp1.id);
    const bill1Id = bill1Res.lastInsertRowid;

    db.prepare(`
        INSERT INTO purchase_invoice_items (invoice_id, expense_account_id, description, quantity, unit_price, tax_rate_id, tax_amount, line_total)
        VALUES (?, ?, 'AWS Enterprise Cloud Production Hosting', 1, 18500.00, ?, 1850.00, 20350.00)
    `).run(bill1Id, cloudCostGl.id, stdTax.id);

    AccountingEngine.postPurchaseInvoice(bill1Id, 'finance.manager');

    // Pay Bill 1 via Chase Bank
    const payBill1Res = db.prepare(`
        INSERT INTO payments (payment_number, payment_type, entity_type, entity_id, invoice_id, payment_date, bank_account_id, payment_method, amount, reference, notes, created_by)
        VALUES ('PAY-2026-00003', 'DISBURSEMENT', 'SUPPLIER', ?, ?, '2026-02-05', ?, 'BANK_TRANSFER', 20350.00, 'ACH-AWS-JAN2026', 'Full settlement of cloud bill', 'Elena Vance')
    `).run(supp1.id, bill1Id, chaseBank.id);
    AccountingEngine.postSupplierPayment(payBill1Res.lastInsertRowid, 'finance.manager');

    // 18. PURCHASE INVOICE 2: Dell Enterprise Technologies ($32,000 hardware inventory + $3,200 tax = $35,200) - Pending AP
    const supp2 = db.prepare("SELECT * FROM suppliers WHERE code = 'SUPP-002'").get();
    const bill2Res = db.prepare(`
        INSERT INTO purchase_invoices (bill_number, supplier_id, bill_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, notes, created_by)
        VALUES ('BILL-2026-00002', ?, '2026-01-25', '2026-02-25', 'DRAFT', 32000.00, 3200.00, 35200.00, 0, 'Inventory Restock: 10 Server Nodes', 'Marcus Brooks')
    `).run(supp2.id);
    const bill2Id = bill2Res.lastInsertRowid;

    db.prepare(`
        INSERT INTO purchase_invoice_items (invoice_id, product_id, expense_account_id, description, quantity, unit_price, tax_rate_id, tax_amount, line_total)
        VALUES (?, ?, ?, 'Dell PowerEdge Server Nodes (SKU-SRV-RACK)', 10, 3200.00, ?, 3200.00, 35200.00)
    `).run(bill2Id, prod2.id, invAcc.id, stdTax.id);

    AccountingEngine.postPurchaseInvoice(bill2Id, 'finance.manager');

    // 19. EXPENSES:
    // Expense 1: Executive Lodging & Client Strategy ($3,400 + $340 tax = $3,740)
    const expCatTravel = db.prepare("SELECT id FROM expense_categories WHERE code = 'EXP-TRAVEL'").get();
    const exp1Res = db.prepare(`
        INSERT INTO expenses (expense_number, category_id, vendor_name, expense_date, amount, tax_rate_id, tax_amount, total_amount, payment_account_id, department, status, description, created_by)
        VALUES ('EXP-2026-00001', ?, 'Delta Air Lines & Marriott International', '2026-01-28', 3400.00, ?, 340.00, 3740.00, ?, 'Sales', 'SUBMITTED', 'Onsite client alignment sessions in Pittsburgh & Atlanta', 'Victoria Sterling')
    `).run(expCatTravel.id, stdTax.id, chaseBank.id);
    AccountingEngine.postExpense(exp1Res.lastInsertRowid, 'finance.manager');

    // Expense 2: Office Facilities lease ($8,500 rent, no tax)
    const expCatRent = db.prepare("SELECT id FROM expense_categories WHERE code = 'EXP-RENT'").get();
    const zeroTax = db.prepare("SELECT id FROM tax_rates WHERE code = 'ZERO-00'").get();
    const exp2Res = db.prepare(`
        INSERT INTO expenses (expense_number, category_id, vendor_name, expense_date, amount, tax_rate_id, tax_amount, total_amount, payment_account_id, department, status, description, created_by)
        VALUES ('EXP-2026-00002', ?, 'Regus Executive Suites Corp', '2026-02-01', 8500.00, ?, 0.00, 8500.00, ?, 'Administration', 'SUBMITTED', 'February corporate headquarters lease and utilities', 'Marcus Brooks')
    `).run(expCatRent.id, zeroTax.id, chaseBank.id);
    AccountingEngine.postExpense(exp2Res.lastInsertRowid, 'finance.manager');

    // 20. MONTHLY PAYROLL RUN: January 2026
    // Basic: $65,000, Allowances: $9,500, Deductions: $4,000, Tax: $14,000, Net: $56,500
    const wellsBank = db.prepare("SELECT id FROM bank_accounts WHERE account_code = 'BA-WELLS-02'").get();
    const payrollRes = db.prepare(`
        INSERT INTO payroll_runs (run_number, period_name, start_date, end_date, payment_date, total_basic, total_allowances, total_deductions, total_tax, net_payroll, status, created_by)
        VALUES ('PAYROLL-2026-00001', 'January 2026', '2026-01-01', '2026-01-31', '2026-01-31', 65000.00, 9500.00, 4000.00, 14000.00, 56500.00, 'APPROVED', 'Elena Vance')
    `).run();
    const payrollId = payrollRes.lastInsertRowid;

    // Generate individual payslips
    const allEmps = db.prepare('SELECT * FROM employees').all();
    for (const emp of allEmps) {
        const gross = emp.basic_salary + emp.allowances;
        const taxW = Math.round(gross * 0.18 * 100) / 100;
        const ded = Math.round(gross * 0.05 * 100) / 100;
        const net = Math.round((gross - taxW - ded) * 100) / 100;

        db.prepare(`
            INSERT INTO payslips (payroll_run_id, employee_id, basic_salary, allowances, deductions, tax_withheld, net_pay, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'GENERATED')
        `).run(payrollId, emp.id, emp.basic_salary, emp.allowances, ded, taxW, net);
    }

    AccountingEngine.postPayrollRun(payrollId, wellsBank.id, 'finance.manager');

    // 21. Sales Quotations and Sales Orders (Sample pipeline records)
    const quoRes = db.prepare(`
        INSERT INTO sales_quotations (quotation_number, customer_id, quotation_date, valid_until, status, subtotal, tax_amount, total_amount, notes)
        VALUES ('QUO-2026-00001', ?, '2026-02-10', '2026-03-15', 'SENT', 85000.00, 8500.00, 93500.00, 'Global ERP migration proposal')
    `).run(cust1.id);

    db.prepare(`
        INSERT INTO sales_orders (order_number, quotation_id, customer_id, order_date, delivery_date, status, subtotal, tax_amount, total_amount, notes)
        VALUES ('SO-2026-00001', ?, ?, '2026-02-12', '2026-03-30', 'CONFIRMED', 85000.00, 8500.00, 93500.00, 'Confirmed by Procurement VP')
    `).run(quoRes.lastInsertRowid, cust1.id);

    // 22. Audit trail verification
    AuditService.log({
        username: 'System',
        action: 'INITIALIZE_LEDGER',
        entity: 'Database',
        entityId: '0',
        details: 'Enterprise Accounting ERP database successfully populated with balanced double-entry seed data.'
    });

    console.log('--- Enterprise Accounting Database Seeding Complete & Verified ---');
}

seedDatabase();
