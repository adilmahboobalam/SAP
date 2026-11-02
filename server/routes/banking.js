const express = require('express');
const router = express.Router();
const db = require('../db/database');
const AccountingEngine = require('../services/accountingEngine');
const AuditService = require('../services/auditService');

// 1. Bank Accounts with real-time GL balance
router.get('/accounts', async (req, res) => {
    try {
        const accounts = await db.prepare(`
            SELECT 
                ba.*,
                coa.code as gl_account_code, coa.name as gl_account_name,
                (ba.opening_balance + COALESCE(SUM(CASE 
                    WHEN bt.type IN ('DEPOSIT', 'TRANSFER_IN') THEN bt.amount
                    WHEN bt.type IN ('WITHDRAWAL', 'TRANSFER_OUT') THEN -bt.amount
                    ELSE 0 END
                ), 0.0)) as current_balance,
                COUNT(bt.id) as transaction_count
            FROM bank_accounts ba
            JOIN chart_of_accounts coa ON coa.id = ba.gl_account_id
            LEFT JOIN bank_transactions bt ON bt.bank_account_id = ba.id
            GROUP BY ba.id, coa.code, coa.name
            ORDER BY ba.id ASC
        `).all();

        res.json({
            success: true,
            accounts: accounts.map(a => ({
                ...a,
                opening_balance: Number(a.opening_balance) || 0,
                current_balance: Math.round((Number(a.current_balance) || 0) * 100) / 100,
                transaction_count: Number(a.transaction_count) || 0
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/accounts', async (req, res) => {
    try {
        const { bank_name, account_number, account_type = 'CHECKING', gl_account_id, currency = 'USD', opening_balance = 0.0 } = req.body;
        if (!bank_name || !account_number || !gl_account_id) {
            return res.status(400).json({ success: false, error: 'Bank Name, Account Number, and GL Account are required.' });
        }

        const countRow = await db.prepare('SELECT COUNT(*) as count FROM bank_accounts').get();
        const count = countRow ? Number(countRow.count) : 0;
        const account_code = `BA-${String(count + 1).padStart(3, '0')}`;

        const stmt = db.prepare(`
            INSERT INTO bank_accounts (account_code, bank_name, account_number, account_type, gl_account_id, currency, opening_balance)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = await stmt.run(account_code, bank_name, account_number, account_type, gl_account_id, currency, opening_balance);

        await AuditService.log({
            username: req.user ? req.user.username : 'Admin',
            action: 'CREATE_BANK_ACCOUNT',
            entity: 'BankAccount',
            entityId: result.lastInsertRowid,
            details: { account_code, bank_name }
        });

        res.json({ success: true, id: result.lastInsertRowid, account_code, message: 'Bank account added successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Bank Transactions
router.get('/transactions', async (req, res) => {
    try {
        const { bank_account_id, is_reconciled } = req.query;
        let query = `
            SELECT bt.*, ba.bank_name, ba.account_number, je.entry_number as journal_entry_number
            FROM bank_transactions bt
            JOIN bank_accounts ba ON ba.id = bt.bank_account_id
            LEFT JOIN journal_entries je ON je.id = bt.journal_entry_id
            WHERE 1=1
        `;
        const params = [];

        if (bank_account_id) {
            query += ' AND bt.bank_account_id = ?';
            params.push(bank_account_id);
        }
        if (is_reconciled !== undefined) {
            query += ' AND bt.is_reconciled = ?';
            params.push(Number(is_reconciled));
        }

        query += ' ORDER BY bt.transaction_date DESC, bt.id DESC LIMIT 100';

        const transactions = await db.prepare(query).all(...params);
        res.json({ success: true, transactions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Bank Transfers (Inter-account transfer with double-entry auto posting)
router.post('/transfers', async (req, res) => {
    try {
        const { from_account_id, to_account_id, transfer_date, amount, reference, notes } = req.body;
        if (!from_account_id || !to_account_id || !amount || Number(amount) <= 0) {
            return res.status(400).json({ success: false, error: 'Source, Destination and a positive amount are required.' });
        }
        if (from_account_id === to_account_id) {
            return res.status(400).json({ success: false, error: 'Source and Destination accounts must be different.' });
        }

        const fromAcc = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(from_account_id);
        const toAcc = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(to_account_id);

        if (!fromAcc || !toAcc) {
            return res.status(404).json({ success: false, error: 'One or both bank accounts not found.' });
        }

        const username = req.user ? req.user.username : 'Admin';
        const date = transfer_date || new Date().toISOString().split('T')[0];
        const transferAmount = Math.round(Number(amount) * 100) / 100;

        const tx = db.transaction(async () => {
            const jeResult = await AccountingEngine.postJournalEntry({
                entryDate: date,
                postingDate: date,
                reference: reference || 'BANK-TRANSFER',
                description: `Bank Transfer: ${fromAcc.bank_name} -> ${toAcc.bank_name}`,
                sourceModule: 'MANUAL',
                items: [
                    { accountId: toAcc.gl_account_id, debit: transferAmount, credit: 0, description: `Transfer In from ${fromAcc.bank_name}` },
                    { accountId: fromAcc.gl_account_id, debit: 0, credit: transferAmount, description: `Transfer Out to ${toAcc.bank_name}` }
                ],
                createdBy: username,
                username
            });

            await db.prepare(`
                INSERT INTO bank_transactions (bank_account_id, transaction_date, type, amount, description, reference, journal_entry_id)
                VALUES (?, ?, 'TRANSFER_OUT', ?, ?, ?, ?)
            `).run(from_account_id, date, transferAmount, `Transfer to ${toAcc.bank_name}: ${notes || ''}`, reference, jeResult.journalEntryId);

            await db.prepare(`
                INSERT INTO bank_transactions (bank_account_id, transaction_date, type, amount, description, reference, journal_entry_id)
                VALUES (?, ?, 'TRANSFER_IN', ?, ?, ?, ?)
            `).run(to_account_id, date, transferAmount, `Transfer from ${fromAcc.bank_name}: ${notes || ''}`, reference, jeResult.journalEntryId);

            return { jeResult, transferAmount };
        });

        const resData = await tx();
        res.json({ success: true, ...resData, message: `Successfully transferred $${transferAmount.toFixed(2)} with journal entry ${resData.jeResult.entryNumber}.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 4. Bank Reconciliation
router.get('/reconciliations', async (req, res) => {
    try {
        const { bank_account_id } = req.query;
        let query = `
            SELECT br.*, ba.bank_name, ba.account_number
            FROM bank_reconciliations br
            JOIN bank_accounts ba ON ba.id = br.bank_account_id
            WHERE 1=1
        `;
        const params = [];
        if (bank_account_id) {
            query += ' AND br.bank_account_id = ?';
            params.push(bank_account_id);
        }
        query += ' ORDER BY br.statement_date DESC';

        const reconciliations = await db.prepare(query).all(...params);
        res.json({ success: true, reconciliations });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/reconciliations', async (req, res) => {
    try {
        const { bank_account_id, statement_date, statement_balance, cleared_transaction_ids = [], notes } = req.body;
        if (!bank_account_id || !statement_date || statement_balance === undefined) {
            return res.status(400).json({ success: false, error: 'Bank account, statement date, and statement balance are required.' });
        }

        const ba = await db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(bank_account_id);
        const txSum = await db.prepare(`
            SELECT COALESCE(SUM(CASE 
                WHEN type IN ('DEPOSIT', 'TRANSFER_IN') THEN amount
                WHEN type IN ('WITHDRAWAL', 'TRANSFER_OUT') THEN -amount
                ELSE 0 END
            ), 0.0) as sum_tx
            FROM bank_transactions
            WHERE bank_account_id = ? AND transaction_date <= ?
        `).get(bank_account_id, statement_date);

        const openBal = ba ? Number(ba.opening_balance) : 0;
        const sumTx = txSum ? Number(txSum.sum_tx) : 0;
        const bookBalance = Math.round((openBal + sumTx) * 100) / 100;
        const stmtBal = Math.round(Number(statement_balance) * 100) / 100;
        const difference = Math.round((stmtBal - bookBalance) * 100) / 100;

        const tx = db.transaction(async () => {
            const stmt = db.prepare(`
                INSERT INTO bank_reconciliations (bank_account_id, statement_date, statement_balance, book_balance, difference, status, completed_at, notes)
                VALUES (?, ?, ?, ?, ?, 'COMPLETED', CURRENT_TIMESTAMP, ?)
            `);
            const result = await stmt.run(bank_account_id, statement_date, stmtBal, bookBalance, difference, notes);
            const recId = result.lastInsertRowid;

            if (cleared_transaction_ids.length > 0) {
                const markStmt = db.prepare(`
                    UPDATE bank_transactions 
                    SET is_reconciled = 1, reconciled_at = CURRENT_TIMESTAMP, reconciliation_id = ?
                    WHERE id = ?
                `);
                for (const tid of cleared_transaction_ids) {
                    await markStmt.run(recId, tid);
                }
            }

            return { recId, bookBalance, stmtBal, difference };
        });

        const resData = await tx();
        res.json({ success: true, ...resData, message: 'Bank reconciliation completed successfully.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
