const express = require('express');
const router = express.Router();
const db = require('../db/database');
const AccountingEngine = require('../services/accountingEngine');
const AuditService = require('../services/auditService');

// 1. Customers
router.get('/customers', async (req, res) => {
    try {
        const customers = await db.prepare(`
            SELECT 
                c.*,
                COALESCE(SUM(CASE WHEN inv.status IN ('POSTED', 'PARTIALLY_PAID', 'OVERDUE') THEN (inv.total_amount - inv.paid_amount) ELSE 0 END), 0.0) as outstanding_balance,
                COUNT(DISTINCT inv.id) as invoice_count
            FROM customers c
            LEFT JOIN sales_invoices inv ON inv.customer_id = c.id
            GROUP BY c.id
            ORDER BY c.name ASC
        `).all();

        res.json({
            success: true,
            customers: customers.map(c => ({
                ...c,
                outstanding_balance: Number(c.outstanding_balance) || 0,
                invoice_count: Number(c.invoice_count) || 0
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/customers', async (req, res) => {
    try {
        const { name, email, phone, tax_number, address, city, credit_limit = 0, payment_terms = 30 } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Customer name is required' });

        const countRow = await db.prepare('SELECT COUNT(*) as count FROM customers').get();
        const count = countRow ? Number(countRow.count) : 0;
        const code = `CUST-${String(count + 1).padStart(3, '0')}`;

        const stmt = db.prepare(`
            INSERT INTO customers (code, name, email, phone, tax_number, address, city, credit_limit, payment_terms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = await stmt.run(code, name, email, phone, tax_number, address, city, credit_limit, payment_terms);

        await AuditService.log({
            username: req.user ? req.user.username : 'Admin',
            action: 'CREATE_CUSTOMER',
            entity: 'Customer',
            entityId: result.lastInsertRowid,
            details: { code, name }
        });

        res.json({ success: true, id: result.lastInsertRowid, code, message: 'Customer created successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/customers/:id/statement', async (req, res) => {
    try {
        const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

        const invoices = await db.prepare(`
            SELECT * FROM sales_invoices WHERE customer_id = ? ORDER BY invoice_date DESC
        `).all(customer.id);

        const payments = await db.prepare(`
            SELECT * FROM payments WHERE entity_type = 'CUSTOMER' AND entity_id = ? ORDER BY payment_date DESC
        `).all(customer.id);

        res.json({ success: true, customer, invoices, payments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Sales Quotations
router.get('/quotations', async (req, res) => {
    try {
        const quotations = await db.prepare(`
            SELECT q.*, c.name as customer_name
            FROM sales_quotations q
            JOIN customers c ON c.id = q.customer_id
            ORDER BY q.id DESC
        `).all();
        res.json({ success: true, quotations });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/quotations', async (req, res) => {
    try {
        const { customer_id, quotation_date, valid_until, subtotal, tax_amount, total_amount, notes } = req.body;
        const quotation_number = await AccountingEngine.getNextNumber('QUO');

        const stmt = db.prepare(`
            INSERT INTO sales_quotations (quotation_number, customer_id, quotation_date, valid_until, status, subtotal, tax_amount, total_amount, notes)
            VALUES (?, ?, ?, ?, 'SENT', ?, ?, ?, ?)
        `);
        const result = await stmt.run(quotation_number, customer_id, quotation_date, valid_until, subtotal, tax_amount, total_amount, notes);

        res.json({ success: true, id: result.lastInsertRowid, quotation_number });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Sales Orders
router.get('/orders', async (req, res) => {
    try {
        const orders = await db.prepare(`
            SELECT o.*, c.name as customer_name
            FROM sales_orders o
            JOIN customers c ON c.id = o.customer_id
            ORDER BY o.id DESC
        `).all();
        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/orders', async (req, res) => {
    try {
        const { customer_id, quotation_id, order_date, delivery_date, subtotal, tax_amount, total_amount, notes } = req.body;
        const order_number = await AccountingEngine.getNextNumber('SO');

        const stmt = db.prepare(`
            INSERT INTO sales_orders (order_number, quotation_id, customer_id, order_date, delivery_date, status, subtotal, tax_amount, total_amount, notes)
            VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?)
        `);
        const result = await stmt.run(order_number, quotation_id || null, customer_id, order_date, delivery_date, subtotal, tax_amount, total_amount, notes);

        res.json({ success: true, id: result.lastInsertRowid, order_number });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Sales Invoices
router.get('/invoices', async (req, res) => {
    try {
        const invoices = await db.prepare(`
            SELECT inv.*, c.name as customer_name, c.code as customer_code,
                   (inv.total_amount - inv.paid_amount) as balance_due,
                   je.entry_number as journal_entry_number
            FROM sales_invoices inv
            JOIN customers c ON c.id = inv.customer_id
            LEFT JOIN journal_entries je ON je.id = inv.journal_entry_id
            ORDER BY inv.invoice_date DESC, inv.id DESC
        `).all();

        res.json({ success: true, invoices });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/invoices/:id', async (req, res) => {
    try {
        const invoice = await db.prepare(`
            SELECT inv.*, c.name as customer_name, c.code as customer_code, c.email as customer_email,
                   c.address as customer_address, c.tax_number as customer_tax_number,
                   (inv.total_amount - inv.paid_amount) as balance_due,
                   je.entry_number as journal_entry_number
            FROM sales_invoices inv
            JOIN customers c ON c.id = inv.customer_id
            LEFT JOIN journal_entries je ON je.id = inv.journal_entry_id
            WHERE inv.id = ?
        `).get(req.params.id);

        if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

        const items = await db.prepare(`
            SELECT item.*, p.name as product_name, p.sku as product_sku, tr.name as tax_rate_name, tr.rate as tax_rate
            FROM sales_invoice_items item
            LEFT JOIN products p ON p.id = item.product_id
            LEFT JOIN tax_rates tr ON tr.id = item.tax_rate_id
            WHERE item.invoice_id = ?
        `).all(invoice.id);

        const payments = await db.prepare(`
            SELECT p.*, ba.bank_name
            FROM payments p
            JOIN bank_accounts ba ON ba.id = p.bank_account_id
            WHERE p.invoice_id = ?
            ORDER BY p.payment_date DESC
        `).all(invoice.id);

        res.json({ success: true, invoice: { ...invoice, items, payments } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create Sales Invoice
router.post('/invoices', async (req, res) => {
    try {
        const { customer_id, order_id, invoice_date, due_date, items, notes, auto_post = true } = req.body;
        if (!customer_id || !invoice_date || !due_date || !items || !items.length) {
            return res.status(400).json({ success: false, error: 'Customer, Dates, and Line Items are required.' });
        }

        const invoice_number = await AccountingEngine.getNextNumber('INV');
        let subtotal = 0;
        let totalTax = 0;

        const calculatedItems = [];
        for (const item of items) {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unit_price) || 0;
            const lineSubtotal = Math.round(qty * price * 100) / 100;

            let taxRate = 0;
            if (item.tax_rate_id) {
                const tr = await db.prepare('SELECT rate FROM tax_rates WHERE id = ?').get(item.tax_rate_id);
                if (tr) taxRate = Number(tr.rate) || 0;
            }
            const itemTax = Math.round((lineSubtotal * (taxRate / 100)) * 100) / 100;
            const lineTotal = lineSubtotal + itemTax;

            subtotal += lineSubtotal;
            totalTax += itemTax;

            calculatedItems.push({
                ...item,
                quantity: qty,
                unit_price: price,
                tax_amount: itemTax,
                line_total: lineTotal
            });
        }

        const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;
        const username = req.user ? req.user.username : 'Admin';

        const tx = db.transaction(async () => {
            const result = await db.prepare(`
                INSERT INTO sales_invoices (invoice_number, order_id, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, notes, created_by)
                VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, 0.0, ?, ?)
            `).run(invoice_number, order_id || null, customer_id, invoice_date, due_date, subtotal, totalTax, totalAmount, notes, username);

            const invoiceId = result.lastInsertRowid;

            const insertItem = db.prepare(`
                INSERT INTO sales_invoice_items (invoice_id, product_id, account_id, description, quantity, unit_price, tax_rate_id, tax_amount, line_total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of calculatedItems) {
                await insertItem.run(
                    invoiceId,
                    item.product_id || null,
                    item.account_id || null,
                    item.description || 'Service/Item',
                    item.quantity,
                    item.unit_price,
                    item.tax_rate_id || null,
                    item.tax_amount,
                    item.line_total
                );
            }

            let jeResult = null;
            if (auto_post) {
                jeResult = await AccountingEngine.postSalesInvoice(invoiceId, username);
            }

            return { invoiceId, invoice_number, totalAmount, jeResult };
        });

        const resData = await tx();
        res.json({ success: true, ...resData, message: `Invoice ${invoice_number} created and posted successfully.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Post an existing Draft Invoice
router.post('/invoices/:id/post', async (req, res) => {
    try {
        const username = req.user ? req.user.username : 'Admin';
        const jeResult = await AccountingEngine.postSalesInvoice(req.params.id, username);
        res.json({ success: true, ...jeResult, message: 'Invoice successfully posted to General Ledger.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 5. Payments Received (Customer Settlement)
router.get('/payments', async (req, res) => {
    try {
        const payments = await db.prepare(`
            SELECT p.*, c.name as customer_name, c.code as customer_code,
                   inv.invoice_number, ba.bank_name, je.entry_number as journal_entry_number
            FROM payments p
            JOIN customers c ON c.id = p.entity_id
            JOIN bank_accounts ba ON ba.id = p.bank_account_id
            LEFT JOIN sales_invoices inv ON inv.id = p.invoice_id
            LEFT JOIN journal_entries je ON je.id = p.journal_entry_id
            WHERE p.payment_type = 'RECEIPT' AND p.entity_type = 'CUSTOMER'
            ORDER BY p.payment_date DESC, p.id DESC
        `).all();

        res.json({ success: true, payments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/payments', async (req, res) => {
    try {
        const { customer_id, invoice_id, payment_date, bank_account_id, payment_method = 'BANK_TRANSFER', amount, reference, notes } = req.body;
        if (!customer_id || !payment_date || !bank_account_id || !amount) {
            return res.status(400).json({ success: false, error: 'Customer, Date, Bank Account, and Amount are required.' });
        }

        const payment_number = await AccountingEngine.getNextNumber('PAY');
        const username = req.user ? req.user.username : 'Admin';

        const tx = db.transaction(async () => {
            const result = await db.prepare(`
                INSERT INTO payments (payment_number, payment_type, entity_type, entity_id, invoice_id, payment_date, bank_account_id, payment_method, amount, reference, notes, created_by)
                VALUES (?, 'RECEIPT', 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(payment_number, customer_id, invoice_id || null, payment_date, bank_account_id, payment_method, amount, reference, notes, username);

            const paymentId = result.lastInsertRowid;
            const jeResult = await AccountingEngine.postCustomerPayment(paymentId, username);

            return { paymentId, payment_number, amount, jeResult };
        });

        const resData = await tx();
        res.json({ success: true, ...resData, message: `Customer payment ${payment_number} posted and ledger updated.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 6. Credit Notes
router.get('/credit-notes', async (req, res) => {
    try {
        const notes = await db.prepare(`
            SELECT cn.*, c.name as customer_name, inv.invoice_number
            FROM credit_notes cn
            JOIN customers c ON c.id = cn.customer_id
            JOIN sales_invoices inv ON inv.id = cn.invoice_id
            ORDER BY cn.id DESC
        `).all();
        res.json({ success: true, creditNotes: notes });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/credit-notes', async (req, res) => {
    try {
        const { invoice_id, customer_id, note_date, amount, reason } = req.body;
        if (!invoice_id || !customer_id || !amount || !reason) {
            return res.status(400).json({ success: false, error: 'Invoice, Customer, Amount, and Reason are required.' });
        }

        const note_number = await AccountingEngine.getNextNumber('CN');
        const username = req.user ? req.user.username : 'Admin';

        const arAccount = await AccountingEngine.getAccountByCode('11000');
        const revAccount = await AccountingEngine.getAccountByCode('40000');

        const tx = db.transaction(async () => {
            const jeResult = await AccountingEngine.postJournalEntry({
                entryDate: note_date,
                postingDate: note_date,
                reference: note_number,
                description: `Credit Note ${note_number}: ${reason}`,
                sourceModule: 'MANUAL',
                items: [
                    { accountId: revAccount.id, debit: Number(amount), credit: 0, description: `Sales credit - ${reason}` },
                    { accountId: arAccount.id, debit: 0, credit: Number(amount), description: `AR Reduction - Credit Note ${note_number}` }
                ],
                createdBy: username,
                username
            });

            const result = await db.prepare(`
                INSERT INTO credit_notes (note_number, invoice_id, customer_id, note_date, amount, reason, status, journal_entry_id)
                VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?)
            `).run(note_number, invoice_id, customer_id, note_date, amount, reason, jeResult.journalEntryId);

            await db.prepare(`
                UPDATE sales_invoices
                SET paid_amount = paid_amount + ?
                WHERE id = ?
            `).run(amount, invoice_id);

            return { creditNoteId: result.lastInsertRowid, note_number, jeResult };
        });

        const resData = await tx();
        res.json({ success: true, ...resData, message: `Credit Note ${note_number} posted and ledger adjusted.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
