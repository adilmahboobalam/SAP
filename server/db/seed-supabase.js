require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function seedSupabase() {
    console.log('--- Supabase PostgreSQL Database Initializer ---');

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || dbUrl.includes('[YOUR-PASSWORD]')) {
        console.error('❌ Error: DATABASE_URL is not configured properly in .env');
        console.error('Please open .env and replace [YOUR-PASSWORD] with your actual Supabase database password.');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to Supabase PostgreSQL at db.srnjpgwpkkudkrjhwkzt.supabase.co...');
        const client = await pool.connect();
        console.log('✓ Successfully connected to Supabase!');

        // 1. Run Schema
        const schemaPath = path.join(__dirname, 'schema-supabase.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        console.log('Creating database schema and tables in Supabase...');
        await client.query(schemaSql);
        console.log('✓ All 34 enterprise tables verified/created successfully!');

        // 2. Company Profile
        console.log('Seeding baseline company profile...');
        await client.query(`
            INSERT INTO companies (id, name, legal_name, tax_id, currency, fiscal_year_start, address, city, country, phone, email)
            VALUES (1, 'Enterprise Financials', 'Enterprise Financials Inc.', '', 'USD', '01-01', '', '', 'United States', '', '')
            ON CONFLICT (id) DO NOTHING
        `);

        // 3. Fiscal Year
        console.log('Seeding baseline fiscal year...');
        await client.query(`
            INSERT INTO fiscal_years (id, company_id, name, start_date, end_date, is_closed, is_active)
            VALUES (1, 1, 'FY 2026', '2026-01-01', '2026-12-31', 0, 1)
            ON CONFLICT (id) DO NOTHING
        `);

        // 4. Users with hashed passwords
        console.log('Seeding standard role users...');
        const salt = bcrypt.genSaltSync(10);
        const users = [
            { username: 'admin', email: 'admin@enterprise.local', pass: 'admin123', name: 'System Administrator', role: 'Super Admin', dept: 'Executive' },
            { username: 'finance', email: 'finance@enterprise.local', pass: 'finance123', name: 'Finance Manager', role: 'Finance Manager', dept: 'Finance' },
            { username: 'accountant', email: 'accountant@enterprise.local', pass: 'account123', name: 'Staff Accountant', role: 'Accountant', dept: 'Accounting' },
            { username: 'auditor', email: 'auditor@enterprise.local', pass: 'audit123', name: 'Internal Auditor', role: 'Auditor', dept: 'Internal Audit' },
            { username: 'viewer', email: 'viewer@enterprise.local', pass: 'viewer123', name: 'Executive Viewer', role: 'Viewer', dept: 'Operations' }
        ];

        for (const u of users) {
            await client.query(`
                INSERT INTO users (username, email, password_hash, full_name, role, department)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (username) DO NOTHING
            `, [u.username, u.email, bcrypt.hashSync(u.pass, salt), u.name, u.role, u.dept]);
        }

        // 5. Chart of Accounts (COA)
        console.log('Seeding Standard Chart of Accounts...');
        const accounts = [
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
            { code: '20000', name: 'Accounts Payable', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'Amounts owed to vendors for purchases' },
            { code: '20100', name: 'Accrued Salaries & Wages Payable', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'Accrued employee compensation' },
            { code: '22000', name: 'Output Tax Payable (Sales Tax)', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'VAT/Sales tax collected from customer invoices' },
            { code: '22100', name: 'Payroll Taxes Payable', type: 'LIABILITY', sub_category: 'Current Liabilities', is_reconcilable: 0, desc: 'Withheld employee income tax and social security' },
            { code: '25000', name: 'Commercial Term Loan', type: 'LIABILITY', sub_category: 'Long Term Debt', is_reconcilable: 0, desc: 'Long-term corporate debt financing' },
            { code: '30000', name: 'Common Stock & Paid-In Capital', type: 'EQUITY', sub_category: 'Owner Capital', is_reconcilable: 0, desc: 'Contributed equity capital' },
            { code: '31000', name: 'Retained Earnings', type: 'EQUITY', sub_category: 'Retained Earnings', is_reconcilable: 0, desc: 'Accumulated prior period earnings' },
            { code: '32000', name: 'Shareholder Distributions', type: 'EQUITY', sub_category: 'Owner Capital', is_reconcilable: 0, desc: 'Dividends and equity withdrawals' },
            { code: '40000', name: 'Sales & License Revenue', type: 'REVENUE', sub_category: 'Operating Revenue', is_reconcilable: 0, desc: 'Revenue from software, products and licenses' },
            { code: '41000', name: 'Consulting & Professional Services', type: 'REVENUE', sub_category: 'Operating Revenue', is_reconcilable: 0, desc: 'Consulting, integration and advisory engagements' },
            { code: '42000', name: 'Subscription & Maintenance Revenue', type: 'REVENUE', sub_category: 'Operating Revenue', is_reconcilable: 0, desc: 'Recurring maintenance, SaaS and cloud hosting' },
            { code: '49000', name: 'Interest & Finance Income', type: 'REVENUE', sub_category: 'Other Revenue', is_reconcilable: 0, desc: 'Interest earned on deposits' },
            { code: '50000', name: 'Cost of Goods Sold', type: 'EXPENSE', sub_category: 'Cost of Goods Sold', is_reconcilable: 0, desc: 'Direct cost of merchandise/services recognized upon sale' },
            { code: '50100', name: 'Direct Cloud & Infrastructure Costs', type: 'EXPENSE', sub_category: 'Cost of Goods Sold', is_reconcilable: 0, desc: 'Direct hosting and cloud compute costs' },
            { code: '50200', name: 'Inventory Shrinkage & Adjustments', type: 'EXPENSE', sub_category: 'Cost of Goods Sold', is_reconcilable: 0, desc: 'Stock loss or count reconciliation discrepancies' },
            { code: '60100', name: 'Office Supplies & Software Tools', type: 'EXPENSE', sub_category: 'Administrative Expenses', is_reconcilable: 0, desc: 'Internal software tools and general office supplies' },
            { code: '60200', name: 'Travel & Business Entertainment', type: 'EXPENSE', sub_category: 'Operating Expenses', is_reconcilable: 0, desc: 'Business travel, meals, lodging and transportation' },
            { code: '60300', name: 'Salaries & Employee Compensation', type: 'EXPENSE', sub_category: 'Personnel Expenses', is_reconcilable: 0, desc: 'Staff compensation, bonuses and benefits' },
            { code: '60400', name: 'Rent, Facilities & Utilities', type: 'EXPENSE', sub_category: 'Administrative Expenses', is_reconcilable: 0, desc: 'Facility lease, electricity and maintenance' },
            { code: '60500', name: 'Sales & Marketing Advertising', type: 'EXPENSE', sub_category: 'Sales & Marketing', is_reconcilable: 0, desc: 'Advertising campaigns, sponsorships and conferences' },
            { code: '60600', name: 'Legal, Audit & Professional Fees', type: 'EXPENSE', sub_category: 'Administrative Expenses', is_reconcilable: 0, desc: 'Legal counsel, audit fees and filings' },
            { code: '60700', name: 'Depreciation & Amortization', type: 'EXPENSE', sub_category: 'Depreciation', is_reconcilable: 0, desc: 'Fixed asset wear and depreciation' }
        ];

        for (const acc of accounts) {
            await client.query(`
                INSERT INTO chart_of_accounts (code, name, type, sub_category, is_reconcilable, description)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (code) DO NOTHING
            `, [acc.code, acc.name, acc.type, acc.sub_category, acc.is_reconcilable, acc.desc]);
        }

        // 6. Tax Rates
        console.log('Seeding standard tax rates...');
        const salesTaxAcc = (await client.query("SELECT id FROM chart_of_accounts WHERE code = '22000'")).rows[0];
        const purchaseTaxAcc = (await client.query("SELECT id FROM chart_of_accounts WHERE code = '14000'")).rows[0];

        const taxRates = [
            { name: 'Standard VAT 10%', code: 'VAT-10', rate: 10.0, type: 'BOTH', s: salesTaxAcc?.id, p: purchaseTaxAcc?.id, desc: 'Standard enterprise VAT' },
            { name: 'Reduced Rate 5%', code: 'VAT-05', rate: 5.0, type: 'BOTH', s: salesTaxAcc?.id, p: purchaseTaxAcc?.id, desc: 'Reduced hospitality and essential rate' },
            { name: 'State Tax 8.25%', code: 'ST-825', rate: 8.25, type: 'SALES', s: salesTaxAcc?.id, p: null, desc: 'Regional sales taxation' },
            { name: 'Tax Exempt 0%', code: 'ZERO-00', rate: 0.0, type: 'BOTH', s: salesTaxAcc?.id, p: purchaseTaxAcc?.id, desc: 'Zero rated or exempt' }
        ];

        for (const tr of taxRates) {
            await client.query(`
                INSERT INTO tax_rates (name, code, rate, type, sales_tax_account_id, purchase_tax_account_id, description)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (code) DO NOTHING
            `, [tr.name, tr.code, tr.rate, tr.type, tr.s, tr.p, tr.desc]);
        }

        // 7. Audit log
        await client.query(`
            INSERT INTO audit_logs (username, action, entity, entity_id, details)
            VALUES ('System', 'INITIALIZE_SUPABASE', 'Database', '0', 'Clean baseline enterprise accounting setup successfully initialized on Supabase.')
        `);

        client.release();
        await pool.end();
        console.log('🎉 Supabase Database Successfully Initialized & Ready!');
    } catch (err) {
        console.error('❌ Supabase initialization failed:', err.message);
        process.exit(1);
    }
}

seedSupabase();
