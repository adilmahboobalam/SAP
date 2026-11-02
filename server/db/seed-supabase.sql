-- Supabase Baseline Master Data Seeding
-- Run this in Supabase SQL Editor

-- 1. Company Configuration
INSERT INTO companies (id, name, legal_name, tax_id, currency, fiscal_year_start, address, city, country, phone, email)
VALUES (1, 'Enterprise Financials', 'Enterprise Financials Inc.', '', 'USD', '01-01', '', '', 'United States', '', '')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    legal_name = EXCLUDED.legal_name;

-- 2. Active Fiscal Year
INSERT INTO fiscal_years (id, company_id, name, start_date, end_date, is_closed, is_active)
VALUES (1, 1, 'FY 2026', '2026-01-01', '2026-12-31', 0, 1)
ON CONFLICT (id) DO NOTHING;

-- 3. Standard Users (Passwords: admin123, finance123, account123, audit123, viewer123)
INSERT INTO users (username, email, password_hash, full_name, role, department)
VALUES 
('admin', 'admin@enterprise.local', '$2b$10$8XqxvQMF.SqtoHJz1.63.OmLcGd9yf9GBQqc5oyeTIqW4Zo8UEIea', 'System Administrator', 'Super Admin', 'Executive'),
('finance', 'finance@enterprise.local', '$2b$10$g06bWJXtmImE07yulR9SBe//VHRGKugUKMNrvScxHv7qrC04F3S7u', 'Finance Manager', 'Finance Manager', 'Finance'),
('accountant', 'accountant@enterprise.local', '$2b$10$FnOmiaDCsumspYsYQQP60OtTvqtWlO4dKZlUdpS.maNGLzJz.p5s2', 'Staff Accountant', 'Accountant', 'Accounting'),
('auditor', 'auditor@enterprise.local', '$2b$10$ZhVXqlGwmY6pymmxEe5fge9.NMLfvzDF0Uz5iJ6ygPWjaRjVhCjyS', 'Internal Auditor', 'Auditor', 'Internal Audit'),
('viewer', 'viewer@enterprise.local', '$2b$10$NEyh0ASFAqagWMWTfXPohOg8PhwC859ykJf23LKo4VN2.DsDE3Hte', 'Executive Viewer', 'Viewer', 'Operations')
ON CONFLICT (username) DO NOTHING;

-- 4. Chart of Accounts (COA - 32 Accounts)
INSERT INTO chart_of_accounts (code, name, type, sub_category, is_reconcilable, description)
VALUES 
('10100', 'Petty Cash', 'ASSET', 'Cash & Bank', 1, 'On-hand petty cash fund'),
('10200', 'Operating Bank Account', 'ASSET', 'Cash & Bank', 1, 'Primary operating checking account'),
('10300', 'Payroll Bank Account', 'ASSET', 'Cash & Bank', 1, 'Dedicated payroll funding account'),
('11000', 'Accounts Receivable', 'ASSET', 'Current Assets', 0, 'Amounts owed by customers for billed services/products'),
('12000', 'Allowance for Doubtful Accounts', 'ASSET', 'Current Assets', 0, 'Contra-asset reserve for uncollectible AR'),
('13000', 'Merchandise Inventory', 'ASSET', 'Current Assets', 0, 'Goods and materials held for resale'),
('14000', 'Input Tax Receivable (Purchase Tax)', 'ASSET', 'Current Assets', 0, 'VAT/GST recoverable on purchase invoices'),
('15000', 'Prepaid Expenses & Insurance', 'ASSET', 'Current Assets', 0, 'Advance payments for services and policies'),
('17000', 'IT Infrastructure & Equipment', 'ASSET', 'Fixed Assets', 0, 'Hardware, computers, servers and office equipment'),
('17500', 'Accumulated Depreciation - IT Equipment', 'ASSET', 'Fixed Assets', 0, 'Contra-asset cumulative depreciation'),
('20000', 'Accounts Payable', 'LIABILITY', 'Current Liabilities', 0, 'Amounts owed to vendors for purchases'),
('20100', 'Accrued Salaries & Wages Payable', 'LIABILITY', 'Current Liabilities', 0, 'Accrued employee compensation'),
('22000', 'Output Tax Payable (Sales Tax)', 'LIABILITY', 'Current Liabilities', 0, 'VAT/Sales tax collected from customer invoices'),
('22100', 'Payroll Taxes Payable', 'LIABILITY', 'Current Liabilities', 0, 'Withheld employee income tax and social security'),
('25000', 'Commercial Term Loan', 'LIABILITY', 'Long Term Debt', 0, 'Long-term corporate debt financing'),
('30000', 'Common Stock & Paid-In Capital', 'EQUITY', 'Owner Capital', 0, 'Contributed equity capital'),
('31000', 'Retained Earnings', 'EQUITY', 'Retained Earnings', 0, 'Accumulated prior period earnings'),
('32000', 'Shareholder Distributions', 'EQUITY', 'Owner Capital', 0, 'Dividends and equity withdrawals'),
('40000', 'Sales & License Revenue', 'REVENUE', 'Operating Revenue', 0, 'Revenue from software, products and licenses'),
('41000', 'Consulting & Professional Services', 'REVENUE', 'Operating Revenue', 0, 'Consulting, integration and advisory engagements'),
('42000', 'Subscription & Maintenance Revenue', 'REVENUE', 'Operating Revenue', 0, 'Recurring maintenance, SaaS and cloud hosting'),
('49000', 'Interest & Finance Income', 'REVENUE', 'Other Revenue', 0, 'Interest earned on deposits'),
('50000', 'Cost of Goods Sold', 'EXPENSE', 'Cost of Goods Sold', 0, 'Direct cost of merchandise/services recognized upon sale'),
('50100', 'Direct Cloud & Infrastructure Costs', 'EXPENSE', 'Cost of Goods Sold', 0, 'Direct hosting and cloud compute costs'),
('50200', 'Inventory Shrinkage & Adjustments', 'EXPENSE', 'Cost of Goods Sold', 0, 'Stock loss or count reconciliation discrepancies'),
('60100', 'Office Supplies & Software Tools', 'EXPENSE', 'Administrative Expenses', 0, 'Internal software tools and general office supplies'),
('60200', 'Travel & Business Entertainment', 'EXPENSE', 'Operating Expenses', 0, 'Business travel, meals, lodging and transportation'),
('60300', 'Salaries & Employee Compensation', 'EXPENSE', 'Personnel Expenses', 0, 'Staff compensation, bonuses and benefits'),
('60400', 'Rent, Facilities & Utilities', 'EXPENSE', 'Administrative Expenses', 0, 'Facility lease, electricity and maintenance'),
('60500', 'Sales & Marketing Advertising', 'EXPENSE', 'Sales & Marketing', 0, 'Advertising campaigns, sponsorships and conferences'),
('60600', 'Legal, Audit & Professional Fees', 'EXPENSE', 'Administrative Expenses', 0, 'Legal counsel, audit fees and filings'),
('60700', 'Depreciation & Amortization', 'EXPENSE', 'Depreciation', 0, 'Fixed asset wear and depreciation')
ON CONFLICT (code) DO NOTHING;

-- 5. Tax Rates
INSERT INTO tax_rates (name, code, rate, type, sales_tax_account_id, purchase_tax_account_id, description)
SELECT 'Standard VAT 10%', 'VAT-10', 10.0, 'BOTH', s.id, p.id, 'Standard enterprise goods and services tax rate'
FROM chart_of_accounts s, chart_of_accounts p
WHERE s.code = '22000' AND p.code = '14000'
ON CONFLICT (code) DO NOTHING;

INSERT INTO tax_rates (name, code, rate, type, sales_tax_account_id, purchase_tax_account_id, description)
SELECT 'Reduced Rate 5%', 'VAT-05', 5.0, 'BOTH', s.id, p.id, 'Reduced rate for eligible items'
FROM chart_of_accounts s, chart_of_accounts p
WHERE s.code = '22000' AND p.code = '14000'
ON CONFLICT (code) DO NOTHING;

INSERT INTO tax_rates (name, code, rate, type, sales_tax_account_id, purchase_tax_account_id, description)
SELECT 'State Tax 8.25%', 'ST-825', 8.25, 'SALES', s.id, NULL, 'Regional sales taxation'
FROM chart_of_accounts s
WHERE s.code = '22000'
ON CONFLICT (code) DO NOTHING;

INSERT INTO tax_rates (name, code, rate, type, sales_tax_account_id, purchase_tax_account_id, description)
SELECT 'Tax Exempt 0%', 'ZERO-00', 0.0, 'BOTH', s.id, p.id, 'Zero rated or exempt transactions'
FROM chart_of_accounts s, chart_of_accounts p
WHERE s.code = '22000' AND p.code = '14000'
ON CONFLICT (code) DO NOTHING;

-- 6. Expense Categories
INSERT INTO expense_categories (name, code, gl_account_id, description)
SELECT 'Office Supplies & Software SaaS', 'EXP-OFFICE', id, 'General software tools and office supplies'
FROM chart_of_accounts WHERE code = '60100'
ON CONFLICT (code) DO NOTHING;

INSERT INTO expense_categories (name, code, gl_account_id, description)
SELECT 'Travel & Lodging', 'EXP-TRAVEL', id, 'Business travel, flights, lodging and transportation'
FROM chart_of_accounts WHERE code = '60200'
ON CONFLICT (code) DO NOTHING;

INSERT INTO expense_categories (name, code, gl_account_id, description)
SELECT 'Office Facilities & Lease', 'EXP-RENT', id, 'Office lease and utilities'
FROM chart_of_accounts WHERE code = '60400'
ON CONFLICT (code) DO NOTHING;

INSERT INTO expense_categories (name, code, gl_account_id, description)
SELECT 'Marketing & Advertising', 'EXP-MKT', id, 'Campaigns, advertising and corporate events'
FROM chart_of_accounts WHERE code = '60500'
ON CONFLICT (code) DO NOTHING;

INSERT INTO expense_categories (name, code, gl_account_id, description)
SELECT 'Legal & Professional Fees', 'EXP-LEGAL', id, 'Legal, statutory and compliance counsel'
FROM chart_of_accounts WHERE code = '60600'
ON CONFLICT (code) DO NOTHING;

-- 7. Audit Log
INSERT INTO audit_logs (username, action, entity, entity_id, details)
VALUES ('System', 'INITIALIZE_SUPABASE', 'Database', '0', 'Clean baseline enterprise accounting setup initialized on Supabase.');
