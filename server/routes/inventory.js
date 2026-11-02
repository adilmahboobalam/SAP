const express = require('express');
const router = express.Router();
const db = require('../db/database');
const AccountingEngine = require('../services/accountingEngine');
const AuditService = require('../services/auditService');

// Product Categories
router.get('/categories', (req, res) => {
    try {
        const categories = db.prepare(`
            SELECT pc.*, COUNT(p.id) as product_count
            FROM product_categories pc
            LEFT JOIN products p ON p.category_id = pc.id
            GROUP BY pc.id
            ORDER BY pc.name ASC
        `).all();
        res.json({ success: true, categories });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Products List
router.get('/products', (req, res) => {
    try {
        const products = db.prepare(`
            SELECT p.*, pc.name as category_name,
                   (p.current_stock * p.cost_price) as inventory_value,
                   CASE WHEN p.current_stock <= p.reorder_level THEN 1 ELSE 0 END as is_low_stock
            FROM products p
            LEFT JOIN product_categories pc ON pc.id = p.category_id
            ORDER BY p.name ASC
        `).all();
        res.json({ success: true, products });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create Product
router.post('/products', (req, res) => {
    try {
        const { sku, name, category_id, unit = 'Unit', cost_price = 0, selling_price = 0, current_stock = 0, reorder_level = 10 } = req.body;
        if (!sku || !name) return res.status(400).json({ success: false, error: 'SKU and Product Name are required.' });

        const revAcc = AccountingEngine.getAccountByCode('40000');
        const cogsAcc = AccountingEngine.getAccountByCode('50000');
        const invAcc = AccountingEngine.getAccountByCode('13000');

        const stmt = db.prepare(`
            INSERT INTO products (sku, name, category_id, unit, cost_price, selling_price, current_stock, reorder_level, inventory_account_id, revenue_account_id, cogs_account_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(sku, name, category_id || null, unit, cost_price, selling_price, current_stock, reorder_level, invAcc.id, revAcc.id, cogsAcc.id);

        res.json({ success: true, id: result.lastInsertRowid, message: 'Product added successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Stock Movements
router.get('/movements', (req, res) => {
    try {
        const { product_id } = req.query;
        let query = `
            SELECT sm.*, p.name as product_name, p.sku as product_sku, je.entry_number as journal_entry_number
            FROM stock_movements sm
            JOIN products p ON p.id = sm.product_id
            LEFT JOIN journal_entries je ON je.id = sm.journal_entry_id
            WHERE 1=1
        `;
        const params = [];
        if (product_id) {
            query += ' AND sm.product_id = ?';
            params.push(product_id);
        }
        query += ' ORDER BY sm.movement_date DESC, sm.id DESC LIMIT 100';

        const movements = db.prepare(query).all(...params);
        res.json({ success: true, movements });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Stock Adjustment (Physical Count Adjustment In / Out with double-entry journal)
router.post('/adjustments', (req, res) => {
    try {
        const { product_id, adjustment_type, quantity, notes } = req.body;
        if (!product_id || !adjustment_type || !quantity || Number(quantity) <= 0) {
            return res.status(400).json({ success: false, error: 'Product, Adjustment Type (ADJUSTMENT_IN or ADJUSTMENT_OUT), and Quantity are required.' });
        }

        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
        if (!prod) return res.status(404).json({ success: false, error: 'Product not found.' });

        const qty = Number(quantity);
        const totalVal = Math.round(qty * prod.cost_price * 100) / 100;
        const username = req.user ? req.user.username : 'Admin';
        const today = new Date().toISOString().split('T')[0];

        const invAcc = AccountingEngine.getAccountByCode('13000');
        const varianceAcc = AccountingEngine.getAccountByCode('50200'); // Inventory Shrinkage & Adjustments

        const tx = db.transaction(() => {
            let items = [];
            if (adjustment_type === 'ADJUSTMENT_IN') {
                // Dr Inventory Asset, Cr Inventory Gain
                items = [
                    { accountId: invAcc.id, debit: totalVal, credit: 0, description: `Stock Adjustment In: ${prod.name}` },
                    { accountId: varianceAcc.id, debit: 0, credit: totalVal, description: `Inventory Gain - ${notes || ''}` }
                ];
                db.prepare('UPDATE products SET current_stock = current_stock + ? WHERE id = ?').run(qty, product_id);
            } else {
                // Dr Inventory Shrinkage/Loss, Cr Inventory Asset
                items = [
                    { accountId: varianceAcc.id, debit: totalVal, credit: 0, description: `Inventory Shrinkage/Loss - ${notes || ''}` },
                    { accountId: invAcc.id, debit: 0, credit: totalVal, description: `Stock Adjustment Out: ${prod.name}` }
                ];
                db.prepare('UPDATE products SET current_stock = current_stock - ? WHERE id = ?').run(qty, product_id);
            }

            const jeResult = AccountingEngine.postJournalEntry({
                entryDate: today,
                postingDate: today,
                reference: 'STOCK-ADJ',
                description: `Stock Adjustment (${adjustment_type}) for ${prod.name}`,
                sourceModule: 'INVENTORY',
                items,
                createdBy: username,
                username
            });

            db.prepare(`
                INSERT INTO stock_movements (product_id, movement_date, movement_type, quantity, unit_cost, total_cost, reference, notes, journal_entry_id)
                VALUES (?, ?, ?, ?, ?, ?, 'STOCK-ADJ', ?, ?)
            `).run(product_id, today, adjustment_type, adjustment_type === 'ADJUSTMENT_IN' ? qty : -qty, prod.cost_price, totalVal, notes, jeResult.journalEntryId);

            return { jeResult, totalVal };
        });

        const resData = tx();
        res.json({ success: true, ...resData, message: 'Stock adjustment posted and inventory ledger balanced.' });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Inventory Valuation Summary
router.get('/valuation', (req, res) => {
    try {
        const items = db.prepare(`
            SELECT 
                p.id, p.sku, p.name, p.unit, p.cost_price, p.selling_price, p.current_stock,
                (p.current_stock * p.cost_price) as asset_value,
                pc.name as category_name
            FROM products p
            LEFT JOIN product_categories pc ON pc.id = p.category_id
            WHERE p.is_active = 1
            ORDER BY asset_value DESC
        `).all();

        const totalInventoryValue = items.reduce((acc, i) => acc + i.asset_value, 0);

        res.json({
            success: true,
            items,
            totalInventoryValue: Math.round(totalInventoryValue * 100) / 100
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
