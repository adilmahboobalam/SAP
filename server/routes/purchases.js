const express = require('express');
const router = express.Router();
const db = require('../db/database');
const AccountingEngine = require('../services/accountingEngine');
const AuditService = require('../services/auditService');

// 1. Suppliers
router.get('/suppliers', (req, res) => {
    try {
        const suppliers = db.prepare(`
            SELECT 
                s.*,
                COALESCE(SUM(CASE WHEN bill.status IN ('POSTED', 'PARTIALLY_PAID', 'OVERDUE') THEN (bill.total_amount - bill.paid_amount) ELSE 0 END), 0.0) as outstanding_balance,
                COUNT(DISTINCT bill.id) as bill_count
            FROM suppliers s
            LEFT JOIN purchase_invoices bill ON bill.supplier_id = s.id
            GROUP BY s.id
            ORDER BY s.name ASC
        `).all();

        res.json({ success: true, suppliers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/suppliers', (req, res) => {
    try {
        const { name, email, phone, tax_number, address, city, payment_terms = 30 } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Supplier name is required' });

        const count = db.prepare('SELECT COUNT(*) as count FROM suppliers').get().count;
        const code = `SUPP-${String(count + 1).padStart(3, '0')}`;

        const stmt = db.prepare(`
            INSERT INTO suppliers (code, name, email, phone, tax_number, address, city, payment_terms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(code, name, email, phone, tax_number, address, city, payment_terms);

        AuditService.log({
            username: req.user ? req.user.username : 'Admin',
            action: 'CREATE_SUPPLIER',
            entity: 'Supplier',
            entityId: result.lastInsertRowid,
            details: { code, name }
        });

        res.json({ success: true, id: result.lastInsertRowid, code, message: 'Supplier registered successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/suppliers/:id/statement', (req, res) => {
    try {
        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
        if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });

        const bills = db.prepare(`
            SELECT * FROM purchase_invoices WHERE supplier_id = ? ORDER BY bill_date DESC
        `).all(supplier.id);

        const payments = db.prepare(`
            SELECT * FROM payments WHERE entity_type = 'SUPPLIER' AND entity_id = ? ORDER BY payment_date DESC
        `).all(supplier.id);

        res.json({ success: true, supplier, bills, payments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Purchase Orders
router.get('/orders', (req, res) => {
    try {
        const orders = db.prepare(`
            SELECT po.*, s.name as supplier_name, s.code as supplier_code
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            ORDER BY po.id DESC
        `).all();
        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/orders', (req, res) => {
    try {
        const { supplier_id, order_date, expected_date, subtotal, tax_amount, total_amount, notes } = req.body;
        const order_number = AccountingEngine.getNextNumber('PO');

        const stmt = db.prepare(`
            INSERT INTO purchase_orders (order_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, notes)
            VALUES (?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?)
        `);
        const result = stmt.run(order_number, supplier_id, order_date, expected_date, subtotal, tax_amount, total_amount, notes);

        res.json({ success: true, id: result.lastInsertRowid, order_number });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Purchase Invoices (Vendor Bills)
router.get('/invoices', (req, res) => {
    try {
        const bills = db.prepare(`
            SELECT bill.*, s.name as supplier_name, s.code as supplier_code,
                   (bill.total_amount - bill.paid_amount) as balance_due,
                   je.entry_number as journal_entry_number
            FROM purchase_invoices bill
            JOIN suppliers s ON s.id = bill.supplier_id
            LEFT JOIN journal_entries je ON je.id = bill.journal_entry_id
            ORDER BY bill.bill_date DESC, bill.id DESC
        `).all();

        res.json({ success: true, invoices: bills });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/invoices/:id', (req, res) => {
    try {
        const bill = db.prepare(`
            SELECT bill.*, s.name as supplier_name, s.code as supplier_code, s.email as supplier_email,
                   (bill.total_amount - bill.paid_amount) as balance_due,
                   je.entry_number as journal_entry_number
            FROM purchase_invoices bill
            JOIN suppliers s ON s.id = bill.supplier_id
            LEFT JOIN journal_entries je ON je.id = bill.journal_entry_id
            WHERE bill.id = ?
        `).get(req.params.id);

        if (!bill) return res.status(404).json({ success: false, error: 'Bill not found' });

        const items = db.prepare(`
            SELECT item.*, p.name as product_name, p.sku as product_sku, coa.name as expense_account_name,
                   tr.name as tax_rate_name, tr.rate as tax_rate
            FROM purchase_invoice_items item
            LEFT JOIN products p ON p.id = item.product_id
            LEFT JOIN chart_of_accounts coa ON coa.id = item.expense_account_id
            LEFT JOIN tax_rates tr ON tr.id = item.tax_rate_id
            WHERE item.invoice_id = ?
        `).all(bill.id);

        const payments = db.prepare(`
            SELECT p.*, ba.bank_name
            FROM payments p
            JOIN bank_accounts ba ON ba.id = p.bank_account_id
            WHERE p.invoice_id = ?
            ORDER BY p.payment_date DESC
        `).all(bill.id);

        res.json({ success: true, bill: { ...bill, items, payments } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create Vendor Bill
router.post('/invoices', (req, res) => {
    try {
        const { supplier_id, order_id, bill_date, due_date, items, notes, auto_post = true } = req.body;
        if (!supplier_id || !bill_date || !due_date || !items || !items.length) {
            return res.status(400).json({ success: false, error: 'Supplier, Dates, and Line Items are required.' });
        }

        const bill_number = AccountingEngine.getNextNumber('BILL');
        let subtotal = 0;
        let totalTax = 0;

        const calculatedItems = items.map(item => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unit_price) || 0;
            const lineSubtotal = Math.round(qty * price * 100) / 100;

            let taxRate = 0;
            if (item.tax_rate_id) {
                const tr = db.prepare('SELECT rate FROM tax_rates WHERE id = ?').get(item.tax_rate_id);
                if (tr) taxRate = tr.rate;
            }
            const itemTax = Math.round((lineSubtotal * (taxRate / 100)) * 100) / 100;
            const lineTotal = lineSubtotal + itemTax;

            subtotal += lineSubtotal;
            totalTax += itemTax;

            return {
                ...item,
                quantity: qty,
                unit_price: price,
                tax_amount: itemTax,
                line_total: lineTotal
            };
        });

        const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;
        const username = req.user ? req.user.username : 'Admin';

        const tx = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO purchase_invoices (bill_number, supplier_id, order_id, bill_date, due_date, status, subtotal, tax_amount, total_amount, paid_amount, notes, created_by)
                VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, 0.0, ?, ?)
            `).run(bill_number, supplier_id, order_id || null, bill_date, due_date, subtotal, totalTax, totalAmount, notes, username);

            const billId = result.lastInsertRowid;

            const insertItem = db.prepare(`
                INSERT INTO purchase_invoice_items (invoice_id, product_id, expense_account_id, description, quantity, unit_price, tax_rate_id, tax_amount, line_total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of calculatedItems) {
                insertItem.run(
                    billId,
                    item.product_id || null,
                    item.expense_account_id || null,
                    item.description || 'Vendor Expense/Stock item',
                    item.quantity,
                    item.unit_price,
                    item.tax_rate_id || null,
                    item.tax_amount,
                    item.line_total
                );
            }

            let jeResult = null;
            if (auto_post) {
                jeResult = AccountingEngine.postPurchaseInvoice(billId, username);
            }

            return { billId, bill_number, totalAmount, jeResult };
        });

        const resData = tx();
        res.json({ success: true, ...resData, message: `Vendor Bill ${bill_number} created and posted successfully.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Post an existing Draft Bill
router.post('/invoices/:id/post', (req, res) => {
    try {
        const username = req.user ? req.user.username : 'Admin';
        const jeResult = AccountingEngine.postPurchaseInvoice(req.params.id, username);
        res.json({ success: true, ...jeResult, message: 'Vendor Bill posted to General Ledger.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 4. Supplier Payments (Disbursements)
router.get('/payments', (req, res) => {
    try {
        const payments = db.prepare(`
            SELECT p.*, s.name as supplier_name, s.code as supplier_code,
                   bill.bill_number, ba.bank_name, je.entry_number as journal_entry_number
            FROM payments p
            JOIN suppliers s ON s.id = p.entity_id
            JOIN bank_accounts ba ON ba.id = p.bank_account_id
            LEFT JOIN purchase_invoices bill ON bill.id = p.invoice_id
            LEFT JOIN journal_entries je ON je.id = p.journal_entry_id
            WHERE p.payment_type = 'DISBURSEMENT' AND p.entity_type = 'SUPPLIER'
            ORDER BY p.payment_date DESC, p.id DESC
        `).all();

        res.json({ success: true, payments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/payments', (req, res) => {
    try {
        const { supplier_id, invoice_id, payment_date, bank_account_id, payment_method = 'BANK_TRANSFER', amount, reference, notes } = req.body;
        if (!supplier_id || !payment_date || !bank_account_id || !amount) {
            return res.status(400).json({ success: false, error: 'Supplier, Date, Bank Account, and Amount are required.' });
        }

        const payment_number = AccountingEngine.getNextNumber('PAY');
        const username = req.user ? req.user.username : 'Admin';

        const tx = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO payments (payment_number, payment_type, entity_type, entity_id, invoice_id, payment_date, bank_account_id, payment_method, amount, reference, notes, created_by)
                VALUES (?, 'DISBURSEMENT', 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(payment_number, supplier_id, invoice_id || null, payment_date, bank_account_id, payment_method, amount, reference, notes, username);

            const paymentId = result.lastInsertRowid;
            const jeResult = AccountingEngine.postSupplierPayment(paymentId, username);

            return { paymentId, payment_number, amount, jeResult };
        });

        const resData = tx();
        res.json({ success: true, ...resData, message: `Supplier payment ${payment_number} successfully recorded.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 5. Debit Notes
router.get('/debit-notes', (req, res) => {
    try {
        const notes = db.prepare(`
            SELECT dn.*, s.name as supplier_name, bill.bill_number
            FROM debit_notes dn
            JOIN suppliers s ON s.id = dn.supplier_id
            JOIN purchase_invoices bill ON bill.id = dn.bill_id
            ORDER BY dn.id DESC
        `).all();
        res.json({ success: true, debitNotes: notes });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/debit-notes', (req, res) => {
    try {
        const { bill_id, supplier_id, note_date, amount, reason } = req.body;
        if (!bill_id || !supplier_id || !amount || !reason) {
            return res.status(400).json({ success: false, error: 'Bill, Supplier, Amount, and Reason are required.' });
        }

        const note_number = AccountingEngine.getNextNumber('DN');
        const username = req.user ? req.user.username : 'Admin';

        const apAccount = AccountingEngine.getAccountByCode('20000');
        const cogsAccount = AccountingEngine.getAccountByCode('50000');

        const tx = db.transaction(() => {
            // Post journal entry: Dr Accounts Payable, Cr Cost of Goods / Expense
            const jeResult = AccountingEngine.postJournalEntry({
                entryDate: note_date,
                postingDate: note_date,
                reference: note_number,
                description: `Debit Note ${note_number}: ${reason}`,
                sourceModule: 'MANUAL',
                items: [
                    { accountId: apAccount.id, debit: Number(amount), credit: 0, description: `AP Reduction - Debit Note ${note_number}` },
                    { accountId: cogsAccount.id, debit: 0, credit: Number(amount), description: `Purchase adjustment - ${reason}` }
                ],
                createdBy: username,
                username
            });

            const result = db.prepare(`
                INSERT INTO debit_notes (note_number, bill_id, supplier_id, note_date, amount, reason, status, journal_entry_id)
                VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?)
            `).run(note_number, bill_id, supplier_id, note_date, amount, reason, jeResult.journalEntryId);

            db.prepare(`
                UPDATE purchase_invoices
                SET paid_amount = paid_amount + ?
                WHERE id = ?
            `).run(amount, bill_id);

            return { debitNoteId: result.lastInsertRowid, note_number, jeResult };
        });

        const resData = tx();
        res.json({ success: true, ...resData, message: `Debit Note ${note_number} posted and vendor balance adjusted.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
