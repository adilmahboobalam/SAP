-- Professional Accounting ERP System Database Schema (SAP S/4HANA Inspired)
-- Enforces double-entry bookkeeping, relational integrity, auditability

PRAGMA foreign_keys = ON;

-- 1. Company Configuration
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    tax_id TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    fiscal_year_start TEXT NOT NULL DEFAULT '01-01',
    address TEXT,
    city TEXT,
    country TEXT NOT NULL DEFAULT 'United States',
    phone TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fiscal Years
CREATE TABLE IF NOT EXISTS fiscal_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_closed INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    closed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users & RBAC
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Super Admin', 'Admin', 'Finance Manager', 'Accountant', 'Auditor', 'Viewer')),
    department TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Audit Trail Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    action TEXT NOT NULL, -- CREATE, UPDATE, DELETE, POST, REVERSE, APPROVE
    entity TEXT NOT NULL, -- JournalEntry, Invoice, Bill, Payment, Account, etc.
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Chart of Accounts (COA)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL, -- e.g. 10100 (Cash), 11000 (AR), 20000 (AP), 40000 (Revenue), 50000 (COGS)
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    sub_category TEXT NOT NULL, -- Current Assets, Fixed Assets, Current Liabilities, Long Term, Operating Revenue, etc.
    currency TEXT NOT NULL DEFAULT 'USD',
    parent_id INTEGER REFERENCES chart_of_accounts(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    is_reconcilable INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Journal Entries (Header)
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_number TEXT UNIQUE NOT NULL, -- JE-2026-00001
    entry_date TEXT NOT NULL,
    posting_date TEXT NOT NULL,
    fiscal_year_id INTEGER REFERENCES fiscal_years(id),
    reference TEXT,
    description TEXT NOT NULL,
    source_module TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source_module IN ('MANUAL', 'SALES_INVOICE', 'PURCHASE_BILL', 'PAYMENT_RECEIVED', 'PAYMENT_MADE', 'EXPENSE', 'PAYROLL', 'INVENTORY', 'REVERSAL')),
    source_id TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'POSTED', 'REVERSED')),
    total_debit REAL NOT NULL DEFAULT 0.0,
    total_credit REAL NOT NULL DEFAULT 0.0,
    created_by TEXT NOT NULL,
    posted_by TEXT,
    posted_at DATETIME,
    is_reversed INTEGER NOT NULL DEFAULT 0,
    reversal_entry_id INTEGER REFERENCES journal_entries(id),
    reversed_entry_id INTEGER REFERENCES journal_entries(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Journal Entry Line Items
CREATE TABLE IF NOT EXISTS journal_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    debit REAL NOT NULL DEFAULT 0.0,
    credit REAL NOT NULL DEFAULT 0.0,
    description TEXT,
    reference TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tax Rates
CREATE TABLE IF NOT EXISTS tax_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    rate REAL NOT NULL, -- e.g. 10.0 for 10%
    type TEXT NOT NULL CHECK(type IN ('SALES', 'PURCHASE', 'BOTH')),
    sales_tax_account_id INTEGER REFERENCES chart_of_accounts(id),
    purchase_tax_account_id INTEGER REFERENCES chart_of_accounts(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    description TEXT
);

-- 9. Tax Periods
CREATE TABLE IF NOT EXISTS tax_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'FILED', 'CLOSED')),
    total_output_tax REAL NOT NULL DEFAULT 0.0,
    total_input_tax REAL NOT NULL DEFAULT 0.0,
    net_tax_payable REAL NOT NULL DEFAULT 0.0,
    filed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    tax_number TEXT,
    address TEXT,
    city TEXT,
    credit_limit REAL DEFAULT 0.0,
    payment_terms INTEGER DEFAULT 30, -- Days
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Suppliers / Vendors
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    tax_number TEXT,
    address TEXT,
    city TEXT,
    payment_terms INTEGER DEFAULT 30,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Products & Inventory
CREATE TABLE IF NOT EXISTS product_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES product_categories(id),
    unit TEXT NOT NULL DEFAULT 'Unit',
    cost_price REAL NOT NULL DEFAULT 0.0,
    selling_price REAL NOT NULL DEFAULT 0.0,
    current_stock REAL NOT NULL DEFAULT 0.0,
    reorder_level REAL NOT NULL DEFAULT 10.0,
    inventory_account_id INTEGER REFERENCES chart_of_accounts(id),
    revenue_account_id INTEGER REFERENCES chart_of_accounts(id),
    cogs_account_id INTEGER REFERENCES chart_of_accounts(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    movement_date TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT')),
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL,
    total_cost REAL NOT NULL,
    reference TEXT,
    notes TEXT,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Sales Documents (Quotations, Orders, Invoices)
CREATE TABLE IF NOT EXISTS sales_quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    quotation_date TEXT NOT NULL,
    valid_until TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SENT' CHECK(status IN ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'CONVERTED')),
    subtotal REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    quotation_id INTEGER REFERENCES sales_quotations(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    order_date TEXT NOT NULL,
    delivery_date TEXT,
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('DRAFT', 'CONFIRMED', 'DELIVERED', 'INVOICED', 'CANCELLED')),
    subtotal REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    order_id INTEGER REFERENCES sales_orders(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    invoice_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED')),
    subtotal REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    paid_amount REAL NOT NULL DEFAULT 0.0,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    notes TEXT,
    created_by TEXT NOT NULL DEFAULT 'Admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    account_id INTEGER REFERENCES chart_of_accounts(id),
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1.0,
    unit_price REAL NOT NULL DEFAULT 0.0,
    tax_rate_id INTEGER REFERENCES tax_rates(id),
    tax_amount REAL NOT NULL DEFAULT 0.0,
    discount REAL NOT NULL DEFAULT 0.0,
    line_total REAL NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS credit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_number TEXT UNIQUE NOT NULL,
    invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    note_date TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK(status IN ('DRAFT', 'POSTED')),
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Purchase Documents (Quotations, Orders, Bills)
CREATE TABLE IF NOT EXISTS purchase_quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    quotation_date TEXT NOT NULL,
    valid_until TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(status IN ('DRAFT', 'RECEIVED', 'ACCEPTED', 'EXPIRED')),
    subtotal REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    order_date TEXT NOT NULL,
    expected_date TEXT,
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('DRAFT', 'CONFIRMED', 'RECEIVED', 'BILLED', 'CANCELLED')),
    subtotal REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    order_id INTEGER REFERENCES purchase_orders(id),
    bill_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE')),
    subtotal REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL DEFAULT 0.0,
    paid_amount REAL NOT NULL DEFAULT 0.0,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    notes TEXT,
    created_by TEXT NOT NULL DEFAULT 'Admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    expense_account_id INTEGER REFERENCES chart_of_accounts(id),
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1.0,
    unit_price REAL NOT NULL DEFAULT 0.0,
    tax_rate_id INTEGER REFERENCES tax_rates(id),
    tax_amount REAL NOT NULL DEFAULT 0.0,
    line_total REAL NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS debit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_number TEXT UNIQUE NOT NULL,
    bill_id INTEGER NOT NULL REFERENCES purchase_invoices(id),
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    note_date TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK(status IN ('DRAFT', 'POSTED')),
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Banking & Cash Management
CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_code TEXT UNIQUE NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('CHECKING', 'SAVINGS', 'CASH', 'CREDIT_CARD')),
    gl_account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    currency TEXT NOT NULL DEFAULT 'USD',
    opening_balance REAL NOT NULL DEFAULT 0.0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
    transaction_date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT')),
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    reference TEXT,
    is_reconciled INTEGER NOT NULL DEFAULT 0,
    reconciled_at DATETIME,
    reconciliation_id INTEGER,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_reconciliations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
    statement_date TEXT NOT NULL,
    statement_balance REAL NOT NULL,
    book_balance REAL NOT NULL,
    difference REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'COMPLETED')),
    completed_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. Payments (AR Receipts & AP Disbursements)
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_number TEXT UNIQUE NOT NULL,
    payment_type TEXT NOT NULL CHECK(payment_type IN ('RECEIPT', 'DISBURSEMENT')),
    entity_type TEXT NOT NULL CHECK(entity_type IN ('CUSTOMER', 'SUPPLIER')),
    entity_id INTEGER NOT NULL,
    invoice_id INTEGER, -- Sales Invoice ID or Purchase Invoice ID
    payment_date TEXT NOT NULL,
    bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'CREDIT_CARD')),
    amount REAL NOT NULL,
    reference TEXT,
    notes TEXT,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    created_by TEXT NOT NULL DEFAULT 'Admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. Expense Management
CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    gl_account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    description TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_number TEXT UNIQUE NOT NULL,
    category_id INTEGER NOT NULL REFERENCES expense_categories(id),
    vendor_name TEXT,
    expense_date TEXT NOT NULL,
    amount REAL NOT NULL,
    tax_rate_id INTEGER REFERENCES tax_rates(id),
    tax_amount REAL NOT NULL DEFAULT 0.0,
    total_amount REAL NOT NULL,
    payment_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
    department TEXT NOT NULL CHECK(department IN ('Sales', 'R&D', 'Administration', 'Operations', 'Finance', 'Marketing')),
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED')),
    receipt_filename TEXT,
    receipt_path TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurring_frequency TEXT,
    description TEXT NOT NULL,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    created_by TEXT NOT NULL DEFAULT 'Admin',
    approved_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 18. HR & Payroll
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department_id INTEGER REFERENCES departments(id),
    position TEXT NOT NULL,
    hire_date TEXT NOT NULL,
    basic_salary REAL NOT NULL DEFAULT 0.0,
    allowances REAL NOT NULL DEFAULT 0.0,
    bank_name TEXT,
    bank_account TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_number TEXT UNIQUE NOT NULL,
    period_name TEXT NOT NULL, -- e.g. "October 2026"
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    total_basic REAL NOT NULL DEFAULT 0.0,
    total_allowances REAL NOT NULL DEFAULT 0.0,
    total_deductions REAL NOT NULL DEFAULT 0.0,
    total_tax REAL NOT NULL DEFAULT 0.0,
    net_payroll REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'APPROVED', 'POSTED', 'PAID')),
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    created_by TEXT NOT NULL DEFAULT 'Admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payslips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    basic_salary REAL NOT NULL,
    allowances REAL NOT NULL DEFAULT 0.0,
    deductions REAL NOT NULL DEFAULT 0.0,
    tax_withheld REAL NOT NULL DEFAULT 0.0,
    net_pay REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'GENERATED' CHECK(status IN ('GENERATED', 'PAID')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid querying and reporting performance
CREATE INDEX IF NOT EXISTS idx_journal_items_entry ON journal_items(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_items_account ON journal_items(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(posting_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
