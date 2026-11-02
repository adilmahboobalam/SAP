# ApexERP Financials - Enterprise Accounting Platform (SAP S/4HANA Inspired)

A complete, enterprise-grade Accounting ERP System engineered for certified public accountants, corporate controllers, finance managers, accounting firms, and CFOs. Inspired by the functional architecture, high information density, and design principles of **SAP S/4HANA Finance (Fiori Horizon)**.

---

## 🌟 Key Features & Functional Modules

### 1. Executive Financial Dashboard
- **8 Real-time KPI Tiles**: Total Revenue, Total Expenses, Net Profit, Liquid Cash & Bank Reserves, Total Assets, Total Liabilities, Accounts Receivable, and Accounts Payable.
- **Interactive SVG Charts**: 
  - Monthly Revenue vs Expenses comparative bar chart with hover tooltips.
  - Operating Expenses Category Breakdown donut chart with interactive percentage legend.
- **Recent Ledger Postings Feed**: Live double-entry journal vouchers with status badges and drilldown.
- **Upcoming Due Dates Tracker**: Customer invoices due for collection and vendor bills scheduled for disbursement.

### 2. Core Accounting & General Ledger (Double-Entry Engine)
- **Strict Double-Entry Bookkeeping**: Every financial transaction enforces `Total Debits == Total Credits` before database commit.
- **Chart of Accounts (COA)**: Standard 5-digit enterprise numbering across Assets (10000s), Liabilities (20000s), Equity (30000s), Revenue (40000s), and Expenses (50000s/60000s).
- **Interactive Journal Entry Balancer Modal**: Real-time line-item editor with live debit/credit tally and visual green/red balance indicators.
- **Transaction Locking & Audit Reversals**: Posted financial transactions are never deleted; compensating reversal journal entries are generated with full audit tracking.
- **Account Ledger Drilldown**: Complete transactional history and running balance calculation for any chosen GL account.
- **Real-Time Trial Balance**: Real-time trial balance proving debit and credit equality.

### 3. Sales & Accounts Receivable (A/R)
- **Customer Directory**: Customer codes, contact profiles, credit limits, payment terms (Net 30/45/60), and real-time outstanding balances.
- **Sales Invoices**: Line-item billing with automated tax calculations, stock deductions, and auto-posting to GL:
  - `Dr Accounts Receivable (11000)`
  - `Cr Sales Revenue (40000)`
  - `Cr Output Sales Tax Payable (22000)`
  - `Dr Cost of Goods Sold (50000)` & `Cr Inventory Asset (13000)` (for physical goods)
- **Customer Receipts (Payments)**: Record customer payments into specific bank accounts with automatic settlement:
  - `Dr Bank Account (10200)`
  - `Cr Accounts Receivable (11000)`
- **Credit Notes**: Manage sales returns and price adjustments with compensating entries.
- **Customer Account Statements**: Comprehensive statement view of all billed invoices and payments.

### 4. Purchases & Accounts Payable (A/P)
- **Supplier / Vendor Management**: Vendor profiles, tax identifiers, payment terms, and outstanding balances.
- **Purchase Invoices (Vendor Bills)**: Line-item bill entry with expense/inventory account mapping and input tax tracking:
  - `Dr Expense Account / Inventory (13000)`
  - `Dr Input Tax Receivable (14000)`
  - `Cr Accounts Payable (20000)`
- **Disbursements (Vendor Payments)**: Disburse payments via Bank Wire, ACH, or Corporate Check:
  - `Dr Accounts Payable (20000)`
  - `Cr Bank Account (10200)`
- **Debit Notes**: Vendor return deductions and debit adjustments.
- **Supplier Statements**: Complete invoice and payment history per vendor.

### 5. Banking & Cash Management
- **Multiple Bank & Cash Accounts**: Operating checking (Chase), payroll disbursement (Wells Fargo), and headquarters petty cash vault.
- **Inter-Account Bank Transfers**: Funds transfer between company accounts with automatic double-entry voucher generation.
- **Bank Reconciliation Engine**: Statement balance input vs general ledger book balance, checkbox clearing of cleared transactions, variance calculation, and statement reconciliation reports.

### 6. Expense Management & Corporate Spend
- **Corporate Expense Entry**: Department cost center tagging, category allocation, and receipt attachment uploads.
- **Approval Workflow**: Multi-stage workflow (`SUBMITTED` -> `APPROVED` -> `POSTED`).
- **Automatic Payment & Tax Postings**: Direct deduction from bank account and input tax capture.

### 7. Inventory & Materials Management
- **Product SKUs**: Cost prices, selling prices, inventory asset account linking, and real-time stock on-hand.
- **Stock Movement Ledger**: Full audit history of purchase stock-ins, sales stock-outs, and adjustments.
- **Physical Stock Adjustments**: Stock count reconciliation with automatic inventory shrinkage/gain postings (`50200`).
- **Inventory Valuation**: Total real-time merchandise valuation.

### 8. Employee & Payroll Management
- **Employee Directory**: Corporate titles, departments, base compensation, allowances, and direct deposit details.
- **Monthly Payroll Processing**: Automated calculation of gross wages, statutory income tax withholdings (18%), and benefits deductions (5%).
- **Automated Payroll Journal**:
  - `Dr Salaries & Wages Expense (60300)`
  - `Cr Payroll Taxes Payable (22100)`
  - `Cr Payroll Bank Account (10300)`
- **Payslip Generator**: Individual employee payslips with breakdown of gross, deductions, and net compensation.

### 9. Tax Management
- **Configurable Tax Rates**: Standard VAT 10%, Reduced Rate 5%, Tech Service Tax 8.25%, and Zero-rate exports.
- **Output Tax vs Input Tax**: Continuous calculation of sales tax liability vs purchase/expense tax recoverable.
- **Statutory Tax Periods**: Quarterly and monthly tax filing periods with finalization and locking.

### 10. Financial Statements & Operational Reports (All 12 Reports)
1. **Profit & Loss Statement (Income Statement)**: Revenue, Cost of Goods Sold, Gross Profit, Operating Expenses, Operating Income, and Net Profit.
2. **Balance Sheet (Statement of Financial Position)**: Assets = Liabilities + Equity verified to the penny.
3. **Statement of Cash Flows**: Direct method cash flow across Operating, Investing, and Financing activities.
4. **Trial Balance**: Comprehensive debit and credit equality verification.
5. **General Ledger Transaction Report**: Filterable by account and date range with running balance.
6. **Accounts Receivable Aging Report**: Current, 1-30, 31-60, 61-90, and 90+ days past due.
7. **Accounts Payable Aging Report**: Current and past due vendor obligations.
8. **Operating Expense Report**: Grouped by category and departmental cost center.
9. **Sales Report**: Revenue breakdowns by customer and monthly trend.
10. **Purchase Report**: Procurement spend by vendor.
11. **Statutory Tax Report**: Comprehensive output tax collected vs input tax paid.
12. **Bank Reconciliation Report**: Statement balance vs book balance audit proof.

---

## 🏛️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Backend Runtime** | Node.js (v24 LTS) with Express |
| **Database Engine** | SQLite 3 via `better-sqlite3` with Write-Ahead Logging (WAL) and strict Foreign Keys |
| **Accounting Engine** | ACID-compliant transaction-wrapped double-entry ledger with automatic balancing validation |
| **Authentication & RBAC** | JWT tokens, bcrypt password hashing, and dynamic enterprise role switcher |
| **Frontend Architecture** | Modern Vanilla JavaScript SPA (Modular ES6 Component architecture) |
| **Enterprise Design System** | Vanilla CSS custom properties inspired by SAP Fiori Horizon (Clean, high-density, authoritative quartz palette) |
| **Data Export** | Native CSV Export on all tables & print-ready layout formatting |

---

## 🚀 Running the System

### 1. Start the Application Server
```bash
npm start
```
The application will be live at **`http://localhost:3000`**.

### 2. Reset / Re-seed Master Accounting Data (Optional)
```bash
npm run seed
```

---

## 🔐 Enterprise User Personas & Demo Accounts

Use the **User Chip** in the top navigation bar to switch between user personas:

| Username | Name | Role | Access Level |
|---|---|---|---|
| `admin` | Alexander Wright | **Super Admin** | Full master control, system administration, and accounting |
| `finance.manager` | Elena Vance, CPA | **Finance Manager** | Financial statements, GL posting, reversals, and approvals |
| `accountant` | Marcus Brooks | **Accountant** | Daily bookkeeping, billing, vendor bills, and bank transfers |
| `auditor` | Sophia Chen | **Auditor** | Read-only ledger verification, trial balances, and audit trails |
| `viewer` | David Miller | **Viewer** | Executive read-only financial statement inspection |
