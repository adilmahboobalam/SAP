const db = require('../db/database');
const AuditService = require('./auditService');

class AccountingEngine {
    /**
     * Get or create next document sequence number
     */
    static getNextNumber(prefix) {
        const year = new Date().getFullYear();
        const pattern = `${prefix}-${year}-%`;
        
        // Find maximum number with this prefix for current year
        let maxRow = null;
        if (prefix === 'JE') {
            maxRow = db.prepare(`SELECT entry_number as num FROM journal_entries WHERE entry_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'INV') {
            maxRow = db.prepare(`SELECT invoice_number as num FROM sales_invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'BILL') {
            maxRow = db.prepare(`SELECT bill_number as num FROM purchase_invoices WHERE bill_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'PAY') {
            maxRow = db.prepare(`SELECT payment_number as num FROM payments WHERE payment_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'EXP') {
            maxRow = db.prepare(`SELECT expense_number as num FROM expenses WHERE expense_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'SO') {
            maxRow = db.prepare(`SELECT order_number as num FROM sales_orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'PO') {
            maxRow = db.prepare(`SELECT order_number as num FROM purchase_orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'QUO') {
            maxRow = db.prepare(`SELECT quotation_number as num FROM sales_quotations WHERE quotation_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'CN') {
            maxRow = db.prepare(`SELECT note_number as num FROM credit_notes WHERE note_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'DN') {
            maxRow = db.prepare(`SELECT note_number as num FROM debit_notes WHERE note_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        } else if (prefix === 'PAYROLL') {
            maxRow = db.prepare(`SELECT run_number as num FROM payroll_runs WHERE run_number LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
        }

        let nextSeq = 1;
        if (maxRow && maxRow.num) {
            const parts = maxRow.num.split('-');
            const lastSeq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }

        return `${prefix}-${year}-${String(nextSeq).padStart(5, '0')}`;
    }

    /**
     * Helper to find standard Chart of Account by code or type
     */
    static getAccountByCode(code) {
        const account = db.prepare('SELECT * FROM chart_of_accounts WHERE code = ?').get(code);
        if (!account) {
            throw new Error(`Chart of Account with code ${code} not found`);
        }
        return account;
    }

    /**
     * Core Double-Entry Bookkeeping Validator & Poster
     * Every posted journal entry MUST satisfy: Total Debits == Total Credits
     */
    static postJournalEntry({
        entryDate = new Date().toISOString().split('T')[0],
        postingDate = new Date().toISOString().split('T')[0],
        reference = '',
        description,
        sourceModule = 'MANUAL',
        sourceId = null,
        items = [], // Array of { accountId, debit, credit, description }
        createdBy = 'Admin',
        username = 'Admin'
    }) {
        if (!items || items.length < 2) {
            throw new Error('A valid journal entry must contain at least two line items (double-entry requirement).');
        }

        // Round to 2 decimal places and validate
        let totalDebit = 0;
        let totalCredit = 0;

        const normalizedItems = items.map(item => {
            const debit = Math.round((Number(item.debit) || 0) * 100) / 100;
            const credit = Math.round((Number(item.credit) || 0) * 100) / 100;

            if (debit < 0 || credit < 0) {
                throw new Error('Debit and credit amounts must be non-negative.');
            }
            if (debit === 0 && credit === 0) {
                throw new Error('Each line item must have either a debit or credit amount.');
            }
            if (debit > 0 && credit > 0) {
                throw new Error('A single line item cannot have both debit and credit. Split into separate lines.');
            }

            totalDebit += debit;
            totalCredit += credit;

            return {
                accountId: Number(item.accountId),
                debit,
                credit,
                description: item.description || description
            };
        });

        totalDebit = Math.round(totalDebit * 100) / 100;
        totalCredit = Math.round(totalCredit * 100) / 100;

        // Double-entry validation
        const diff = Math.abs(totalDebit - totalCredit);
        if (diff > 0.005) {
            throw new Error(`Double-entry validation failed: Total Debits ($${totalDebit.toFixed(2)}) must exactly equal Total Credits ($${totalCredit.toFixed(2)}). Difference: $${diff.toFixed(2)}`);
        }

        // Active Fiscal Year validation
        const activeFY = db.prepare('SELECT * FROM fiscal_years WHERE is_active = 1 AND is_closed = 0 LIMIT 1').get();
        const fiscalYearId = activeFY ? activeFY.id : null;

        const entryNumber = this.getNextNumber('JE');

        // Execute transaction
        const insertTx = db.transaction(() => {
            const insertEntryStmt = db.prepare(`
                INSERT INTO journal_entries (
                    entry_number, entry_date, posting_date, fiscal_year_id,
                    reference, description, source_module, source_id,
                    status, total_debit, total_credit, created_by, posted_by, posted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);

            const result = insertEntryStmt.run(
                entryNumber,
                entryDate,
                postingDate,
                fiscalYearId,
                reference,
                description,
                sourceModule,
                sourceId ? String(sourceId) : null,
                totalDebit,
                totalCredit,
                createdBy,
                username
            );

            const journalEntryId = result.lastInsertRowid;

            const insertItemStmt = db.prepare(`
                INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, description, reference)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (const item of normalizedItems) {
                insertItemStmt.run(journalEntryId, item.accountId, item.debit, item.credit, item.description, reference);
            }

            // Audit Trail
            AuditService.log({
                username,
                action: 'POST_JOURNAL',
                entity: 'JournalEntry',
                entityId: journalEntryId,
                details: { entryNumber, totalDebit, totalCredit, sourceModule, sourceId }
            });

            return { journalEntryId, entryNumber, totalDebit, totalCredit };
        });

        return insertTx();
    }

    /**
     * Reverse a posted Journal Entry
     * Principle: Never delete posted transactions. Issue an exact compensating reversal entry.
     */
    static reverseJournalEntry(journalEntryId, reason = 'Correction Reversal', username = 'Admin') {
        const entry = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(journalEntryId);
        if (!entry) {
            throw new Error(`Journal Entry #${journalEntryId} not found.`);
        }
        if (entry.status === 'REVERSED' || entry.is_reversed === 1) {
            throw new Error(`Journal Entry ${entry.entry_number} is already reversed.`);
        }

        const items = db.prepare('SELECT * FROM journal_items WHERE journal_entry_id = ?').all(journalEntryId);
        if (!items || items.length === 0) {
            throw new Error(`No line items found for Journal Entry ${entry.entry_number}.`);
        }

        // Invert debits and credits
        const reversalItems = items.map(item => ({
            accountId: item.account_id,
            debit: item.credit,  // swapped!
            credit: item.debit,  // swapped!
            description: `Reversal of ${entry.entry_number}: ${item.description || ''}`
        }));

        const reversalTx = db.transaction(() => {
            // Post new reversal journal entry
            const reversalResult = this.postJournalEntry({
                entryDate: new Date().toISOString().split('T')[0],
                postingDate: new Date().toISOString().split('T')[0],
                reference: `REV-${entry.entry_number}`,
                description: `Reversal of ${entry.entry_number}: ${reason}`,
                sourceModule: 'REVERSAL',
                sourceId: entry.id,
                items: reversalItems,
                createdBy: username,
                username
            });

            // Mark original entry as REVERSED and link
            db.prepare(`
                UPDATE journal_entries 
                SET status = 'REVERSED', is_reversed = 1, reversal_entry_id = ?
                WHERE id = ?
            `).run(reversalResult.journalEntryId, entry.id);

            // Link reverse reference on new entry
            db.prepare(`
                UPDATE journal_entries
                SET reversed_entry_id = ?
                WHERE id = ?
            `).run(entry.id, reversalResult.journalEntryId);

            AuditService.log({
                username,
                action: 'REVERSE_JOURNAL',
                entity: 'JournalEntry',
                entityId: entry.id,
                details: {
                    originalEntryNumber: entry.entry_number,
                    reversalEntryNumber: reversalResult.entryNumber,
                    reason
                }
            });

            return reversalResult;
        });

        return reversalTx();
    }

    /**
     * Auto-Posting: Sales Invoice
     * Dr Accounts Receivable (Total)
     * Cr Sales Revenue (Subtotal)
     * Cr Sales Tax Output Payable (Tax Amount)
     * (Plus Inventory/COGS if goods sold)
     */
    static postSalesInvoice(invoiceId, username = 'Admin') {
        const invoice = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(invoiceId);
        if (!invoice) throw new Error('Sales Invoice not found.');
        if (invoice.status === 'POSTED' || invoice.status === 'PAID') {
            throw new Error('Invoice is already posted.');
        }

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(invoice.customer_id);
        const items = db.prepare('SELECT * FROM sales_invoice_items WHERE invoice_id = ?').all(invoiceId);

        if (!items || items.length === 0) {
            throw new Error('Cannot post an invoice without line items.');
        }

        const arAccount = this.getAccountByCode('11000'); // Accounts Receivable
        const defaultRevAccount = this.getAccountByCode('40000'); // Sales Revenue
        const taxAccount = this.getAccountByCode('22000'); // Sales Tax Payable (Output Tax)
        const cogsAccount = this.getAccountByCode('50000'); // Cost of Goods Sold
        const inventoryAccount = this.getAccountByCode('13000'); // Merchandise Inventory

        const journalItems = [];

        // 1. Debit Accounts Receivable for Total Invoice Amount
        journalItems.push({
            accountId: arAccount.id,
            debit: invoice.total_amount,
            credit: 0,
            description: `A/R - Invoice ${invoice.invoice_number} - ${customer ? customer.name : ''}`
        });

        // 2. Credit Revenue accounts per item
        let totalCostOfGoods = 0;
        const stockDeductions = [];

        for (const item of items) {
            const revAccountId = item.account_id || defaultRevAccount.id;
            const itemSubtotal = Math.round((item.line_total - item.tax_amount) * 100) / 100;

            journalItems.push({
                accountId: revAccountId,
                debit: 0,
                credit: itemSubtotal,
                description: `Revenue: ${item.description}`
            });

            // If product has inventory tracking
            if (item.product_id) {
                const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
                if (prod && prod.cost_price > 0) {
                    const itemCost = Math.round(prod.cost_price * item.quantity * 100) / 100;
                    totalCostOfGoods += itemCost;
                    stockDeductions.push({
                        productId: prod.id,
                        qty: item.quantity,
                        costPrice: prod.cost_price,
                        totalCost: itemCost
                    });
                }
            }
        }

        // 3. Credit Output Tax Payable if any
        if (invoice.tax_amount > 0) {
            journalItems.push({
                accountId: taxAccount.id,
                debit: 0,
                credit: invoice.tax_amount,
                description: `Output Tax Payable - Invoice ${invoice.invoice_number}`
            });
        }

        // 4. If goods were sold, post COGS & Inventory Asset movement
        if (totalCostOfGoods > 0) {
            journalItems.push({
                accountId: cogsAccount.id,
                debit: totalCostOfGoods,
                credit: 0,
                description: `COGS - Invoice ${invoice.invoice_number}`
            });
            journalItems.push({
                accountId: inventoryAccount.id,
                debit: 0,
                credit: totalCostOfGoods,
                description: `Inventory reduction - Invoice ${invoice.invoice_number}`
            });
        }

        const tx = db.transaction(() => {
            const jeResult = this.postJournalEntry({
                entryDate: invoice.invoice_date,
                postingDate: invoice.invoice_date,
                reference: invoice.invoice_number,
                description: `Sales Invoice ${invoice.invoice_number} to ${customer ? customer.name : 'Customer'}`,
                sourceModule: 'SALES_INVOICE',
                sourceId: invoice.id,
                items: journalItems,
                createdBy: username,
                username
            });

            // Update invoice status & link journal entry
            db.prepare(`
                UPDATE sales_invoices
                SET status = 'POSTED', journal_entry_id = ?
                WHERE id = ?
            `).run(jeResult.journalEntryId, invoice.id);

            // Deduct stock for products
            for (const item of stockDeductions) {
                db.prepare(`
                    UPDATE products
                    SET current_stock = current_stock - ?
                    WHERE id = ?
                `).run(item.qty, item.productId);

                db.prepare(`
                    INSERT INTO stock_movements (
                        product_id, movement_date, movement_type, quantity,
                        unit_cost, total_cost, reference, notes, journal_entry_id
                    ) VALUES (?, ?, 'SALE', ?, ?, ?, ?, 'Sales Invoice Deduction', ?)
                `).run(
                    item.productId,
                    invoice.invoice_date,
                    -item.qty,
                    item.costPrice,
                    item.totalCost,
                    invoice.invoice_number,
                    jeResult.journalEntryId
                );
            }

            return jeResult;
        });

        return tx();
    }

    /**
     * Auto-Posting: Customer Payment Received
     * Dr Cash/Bank
     * Cr Accounts Receivable
     */
    static postCustomerPayment(paymentId, username = 'Admin') {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
        if (!payment) throw new Error('Payment not found.');
        if (payment.journal_entry_id) throw new Error('Payment is already posted to ledger.');

        const bankAcc = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(payment.bank_account_id);
        const arAccount = this.getAccountByCode('11000'); // Accounts Receivable
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(payment.entity_id);

        const items = [
            {
                accountId: bankAcc.gl_account_id,
                debit: payment.amount,
                credit: 0,
                description: `Receipt from ${customer ? customer.name : 'Customer'} via ${payment.payment_method}`
            },
            {
                accountId: arAccount.id,
                debit: 0,
                credit: payment.amount,
                description: `A/R Settlement - ${payment.reference || payment.payment_number}`
            }
        ];

        const tx = db.transaction(() => {
            const jeResult = this.postJournalEntry({
                entryDate: payment.payment_date,
                postingDate: payment.payment_date,
                reference: payment.payment_number,
                description: `Customer Receipt ${payment.payment_number} from ${customer ? customer.name : 'Customer'}`,
                sourceModule: 'PAYMENT_RECEIVED',
                sourceId: payment.id,
                items,
                createdBy: username,
                username
            });

            // Update payment record
            db.prepare('UPDATE payments SET journal_entry_id = ? WHERE id = ?').run(jeResult.journalEntryId, payment.id);

            // Update bank transaction
            db.prepare(`
                INSERT INTO bank_transactions (
                    bank_account_id, transaction_date, type, amount, description, reference, journal_entry_id
                ) VALUES (?, ?, 'DEPOSIT', ?, ?, ?, ?)
            `).run(
                payment.bank_account_id,
                payment.payment_date,
                payment.amount,
                `Customer Receipt - ${customer ? customer.name : ''}`,
                payment.payment_number,
                jeResult.journalEntryId
            );

            // Update invoice paid amount and status if linked
            if (payment.invoice_id) {
                const inv = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(payment.invoice_id);
                if (inv) {
                    const newPaid = Math.round((inv.paid_amount + payment.amount) * 100) / 100;
                    const newStatus = newPaid >= inv.total_amount ? 'PAID' : 'PARTIALLY_PAID';
                    db.prepare('UPDATE sales_invoices SET paid_amount = ?, status = ? WHERE id = ?')
                        .run(newPaid, newStatus, inv.id);
                }
            }

            return jeResult;
        });

        return tx();
    }

    /**
     * Auto-Posting: Purchase Invoice (Vendor Bill)
     * Dr Expense / Inventory Account
     * Dr Input Tax Receivable (14000)
     * Cr Accounts Payable (20000)
     */
    static postPurchaseInvoice(billId, username = 'Admin') {
        const bill = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(billId);
        if (!bill) throw new Error('Vendor Bill not found.');
        if (bill.status === 'POSTED' || bill.status === 'PAID') throw new Error('Bill is already posted.');

        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(bill.supplier_id);
        const items = db.prepare('SELECT * FROM purchase_invoice_items WHERE invoice_id = ?').all(billId);

        if (!items || items.length === 0) throw new Error('Cannot post a bill without line items.');

        const apAccount = this.getAccountByCode('20000'); // Accounts Payable
        const inputTaxAccount = this.getAccountByCode('14000'); // Input Tax Receivable
        const defaultExpenseAccount = this.getAccountByCode('60100'); // Office Supplies / Expense
        const inventoryAccount = this.getAccountByCode('13000'); // Inventory Asset

        const journalItems = [];
        const stockAdditions = [];

        // 1. Debit expense or inventory per item
        for (const item of items) {
            let targetAccountId = item.expense_account_id || defaultExpenseAccount.id;
            
            // If linked to inventory product
            if (item.product_id) {
                targetAccountId = inventoryAccount.id;
                stockAdditions.push({
                    productId: item.product_id,
                    qty: item.quantity,
                    costPrice: item.unit_price,
                    totalCost: item.line_total - item.tax_amount
                });
            }

            const itemSubtotal = Math.round((item.line_total - item.tax_amount) * 100) / 100;
            journalItems.push({
                accountId: targetAccountId,
                debit: itemSubtotal,
                credit: 0,
                description: item.description || `Purchase item`
            });
        }

        // 2. Debit Input Tax if any
        if (bill.tax_amount > 0) {
            journalItems.push({
                accountId: inputTaxAccount.id,
                debit: bill.tax_amount,
                credit: 0,
                description: `Input Tax Receivable - Bill ${bill.bill_number}`
            });
        }

        // 3. Credit Accounts Payable for Total Amount
        journalItems.push({
            accountId: apAccount.id,
            debit: 0,
            credit: bill.total_amount,
            description: `A/P - Bill ${bill.bill_number} - ${supplier ? supplier.name : 'Supplier'}`
        });

        const tx = db.transaction(() => {
            const jeResult = this.postJournalEntry({
                entryDate: bill.bill_date,
                postingDate: bill.bill_date,
                reference: bill.bill_number,
                description: `Vendor Bill ${bill.bill_number} from ${supplier ? supplier.name : 'Supplier'}`,
                sourceModule: 'PURCHASE_BILL',
                sourceId: bill.id,
                items: journalItems,
                createdBy: username,
                username
            });

            db.prepare(`
                UPDATE purchase_invoices
                SET status = 'POSTED', journal_entry_id = ?
                WHERE id = ?
            `).run(jeResult.journalEntryId, bill.id);

            // Add stock if products purchased
            for (const item of stockAdditions) {
                db.prepare(`
                    UPDATE products
                    SET current_stock = current_stock + ?, cost_price = ?
                    WHERE id = ?
                `).run(item.qty, item.costPrice, item.productId);

                db.prepare(`
                    INSERT INTO stock_movements (
                        product_id, movement_date, movement_type, quantity,
                        unit_cost, total_cost, reference, notes, journal_entry_id
                    ) VALUES (?, ?, 'PURCHASE', ?, ?, ?, ?, 'Purchase Invoice Stock In', ?)
                `).run(
                    item.productId,
                    bill.bill_date,
                    item.qty,
                    item.costPrice,
                    item.totalCost,
                    bill.bill_number,
                    jeResult.journalEntryId
                );
            }

            return jeResult;
        });

        return tx();
    }

    /**
     * Auto-Posting: Supplier Payment Made
     * Dr Accounts Payable
     * Cr Cash/Bank
     */
    static postSupplierPayment(paymentId, username = 'Admin') {
        const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
        if (!payment) throw new Error('Payment record not found.');
        if (payment.journal_entry_id) throw new Error('Payment already posted.');

        const bankAcc = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(payment.bank_account_id);
        const apAccount = this.getAccountByCode('20000'); // Accounts Payable
        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(payment.entity_id);

        const items = [
            {
                accountId: apAccount.id,
                debit: payment.amount,
                credit: 0,
                description: `Settlement to ${supplier ? supplier.name : 'Supplier'} - ${payment.reference || payment.payment_number}`
            },
            {
                accountId: bankAcc.gl_account_id,
                debit: 0,
                credit: payment.amount,
                description: `Disbursement from ${bankAcc.bank_name} via ${payment.payment_method}`
            }
        ];

        const tx = db.transaction(() => {
            const jeResult = this.postJournalEntry({
                entryDate: payment.payment_date,
                postingDate: payment.payment_date,
                reference: payment.payment_number,
                description: `Supplier Payment ${payment.payment_number} to ${supplier ? supplier.name : 'Supplier'}`,
                sourceModule: 'PAYMENT_MADE',
                sourceId: payment.id,
                items,
                createdBy: username,
                username
            });

            db.prepare('UPDATE payments SET journal_entry_id = ? WHERE id = ?').run(jeResult.journalEntryId, payment.id);

            db.prepare(`
                INSERT INTO bank_transactions (
                    bank_account_id, transaction_date, type, amount, description, reference, journal_entry_id
                ) VALUES (?, ?, 'WITHDRAWAL', ?, ?, ?, ?)
            `).run(
                payment.bank_account_id,
                payment.payment_date,
                payment.amount,
                `Supplier Disbursement - ${supplier ? supplier.name : ''}`,
                payment.payment_number,
                jeResult.journalEntryId
            );

            if (payment.invoice_id) {
                const bill = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(payment.invoice_id);
                if (bill) {
                    const newPaid = Math.round((bill.paid_amount + payment.amount) * 100) / 100;
                    const newStatus = newPaid >= bill.total_amount ? 'PAID' : 'PARTIALLY_PAID';
                    db.prepare('UPDATE purchase_invoices SET paid_amount = ?, status = ? WHERE id = ?')
                        .run(newPaid, newStatus, bill.id);
                }
            }

            return jeResult;
        });

        return tx();
    }

    /**
     * Auto-Posting: Business Expense
     * Dr Expense Category GL Account
     * Dr Input Tax (if applicable)
     * Cr Bank Account
     */
    static postExpense(expenseId, username = 'Admin') {
        const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
        if (!expense) throw new Error('Expense record not found.');
        if (expense.status === 'POSTED') throw new Error('Expense already posted.');

        const category = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(expense.category_id);
        const bankAcc = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(expense.payment_account_id);
        const inputTaxAccount = this.getAccountByCode('14000');

        const items = [];
        const netExpenseAmount = Math.round((expense.total_amount - expense.tax_amount) * 100) / 100;

        items.push({
            accountId: category.gl_account_id,
            debit: netExpenseAmount,
            credit: 0,
            description: `${expense.description} (${category.name})`
        });

        if (expense.tax_amount > 0) {
            items.push({
                accountId: inputTaxAccount.id,
                debit: expense.tax_amount,
                credit: 0,
                description: `Input Tax on Expense ${expense.expense_number}`
            });
        }

        items.push({
            accountId: bankAcc.gl_account_id,
            debit: 0,
            credit: expense.total_amount,
            description: `Payment for ${expense.description} to ${expense.vendor_name || 'Vendor'}`
        });

        const tx = db.transaction(() => {
            const jeResult = this.postJournalEntry({
                entryDate: expense.expense_date,
                postingDate: expense.expense_date,
                reference: expense.expense_number,
                description: `Expense: ${expense.description} - ${category.name}`,
                sourceModule: 'EXPENSE',
                sourceId: expense.id,
                items,
                createdBy: username,
                username
            });

            db.prepare(`
                UPDATE expenses
                SET status = 'POSTED', journal_entry_id = ?, approved_by = ?
                WHERE id = ?
            `).run(jeResult.journalEntryId, username, expense.id);

            db.prepare(`
                INSERT INTO bank_transactions (
                    bank_account_id, transaction_date, type, amount, description, reference, journal_entry_id
                ) VALUES (?, ?, 'WITHDRAWAL', ?, ?, ?, ?)
            `).run(
                expense.payment_account_id,
                expense.expense_date,
                expense.total_amount,
                `Expense - ${expense.description}`,
                expense.expense_number,
                jeResult.journalEntryId
            );

            return jeResult;
        });

        return tx();
    }

    /**
     * Auto-Posting: Monthly Payroll Run
     * Dr Salaries & Wages Expense (60300) - Gross Salary
     * Cr Payroll Tax Payable (22100) - Tax Withheld
     * Cr Salaries Payable (20100) / Bank Account - Net Pay
     */
    static postPayrollRun(runId, bankAccountId = null, username = 'Admin') {
        const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(runId);
        if (!run) throw new Error('Payroll run not found.');
        if (run.status === 'POSTED' || run.status === 'PAID') throw new Error('Payroll is already posted.');

        const salaryExpenseAccount = this.getAccountByCode('60300'); // Salaries & Wages Expense
        const payrollTaxPayable = this.getAccountByCode('22100'); // Payroll Tax Payable
        const salariesPayableAccount = this.getAccountByCode('20100'); // Salaries Payable
        
        let payoutAccountId = salariesPayableAccount.id;
        if (bankAccountId) {
            const bankAcc = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(bankAccountId);
            if (bankAcc) payoutAccountId = bankAcc.gl_account_id;
        }

        const grossPay = Math.round((run.total_basic + run.total_allowances) * 100) / 100;
        const totalTaxAndDeductions = Math.round((run.total_tax + run.total_deductions) * 100) / 100;
        const netPay = Math.round(run.net_payroll * 100) / 100;

        const items = [
            {
                accountId: salaryExpenseAccount.id,
                debit: grossPay,
                credit: 0,
                description: `Gross Salaries & Allowances - ${run.period_name}`
            },
            {
                accountId: payrollTaxPayable.id,
                debit: 0,
                credit: totalTaxAndDeductions,
                description: `Payroll Taxes & Withholdings - ${run.period_name}`
            },
            {
                accountId: payoutAccountId,
                debit: 0,
                credit: netPay,
                description: `Net Payroll Disbursement - ${run.period_name}`
            }
        ];

        const tx = db.transaction(() => {
            const jeResult = this.postJournalEntry({
                entryDate: run.payment_date,
                postingDate: run.payment_date,
                reference: run.run_number,
                description: `Payroll Processing for ${run.period_name}`,
                sourceModule: 'PAYROLL',
                sourceId: run.id,
                items,
                createdBy: username,
                username
            });

            db.prepare(`
                UPDATE payroll_runs
                SET status = 'POSTED', journal_entry_id = ?
                WHERE id = ?
            `).run(jeResult.journalEntryId, run.id);

            db.prepare(`
                UPDATE payslips
                SET status = 'PAID'
                WHERE payroll_run_id = ?
            `).run(run.id);

            if (bankAccountId) {
                db.prepare(`
                    INSERT INTO bank_transactions (
                        bank_account_id, transaction_date, type, amount, description, reference, journal_entry_id
                    ) VALUES (?, ?, 'WITHDRAWAL', ?, ?, ?, ?)
                `).run(
                    bankAccountId,
                    run.payment_date,
                    netPay,
                    `Payroll Disbursement - ${run.period_name}`,
                    run.run_number,
                    jeResult.journalEntryId
                );
            }

            return jeResult;
        });

        return tx();
    }
}

module.exports = AccountingEngine;
