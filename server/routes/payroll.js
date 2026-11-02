const express = require('express');
const router = express.Router();
const db = require('../db/database');
const AccountingEngine = require('../services/accountingEngine');
const AuditService = require('../services/auditService');

// Departments
router.get('/departments', (req, res) => {
    try {
        const departments = db.prepare(`
            SELECT d.*, COUNT(e.id) as employee_count, COALESCE(SUM(e.basic_salary + e.allowances), 0.0) as monthly_payroll_cost
            FROM departments d
            LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'ACTIVE'
            GROUP BY d.id
            ORDER BY d.name ASC
        `).all();
        res.json({ success: true, departments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Employees List
router.get('/employees', (req, res) => {
    try {
        const employees = db.prepare(`
            SELECT e.*, d.name as department_name, (e.basic_salary + e.allowances) as gross_salary
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            ORDER BY e.first_name ASC
        `).all();
        res.json({ success: true, employees });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create Employee
router.post('/employees', (req, res) => {
    try {
        const { first_name, last_name, email, phone, department_id, position, hire_date, basic_salary, allowances = 0, bank_name, bank_account } = req.body;
        if (!first_name || !last_name || !position || !basic_salary) {
            return res.status(400).json({ success: false, error: 'Name, Position, and Basic Salary are required.' });
        }

        const count = db.prepare('SELECT COUNT(*) as count FROM employees').get().count;
        const employee_code = `EMP-${String(count + 1).padStart(3, '0')}`;

        const stmt = db.prepare(`
            INSERT INTO employees (employee_code, first_name, last_name, email, phone, department_id, position, hire_date, basic_salary, allowances, bank_name, bank_account)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            employee_code, first_name, last_name, email, phone,
            department_id || null, position, hire_date || new Date().toISOString().split('T')[0],
            basic_salary, allowances, bank_name, bank_account
        );

        res.json({ success: true, id: result.lastInsertRowid, employee_code, message: 'Employee added successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Payroll Runs
router.get('/runs', (req, res) => {
    try {
        const runs = db.prepare(`
            SELECT pr.*, je.entry_number as journal_entry_number,
                   COUNT(ps.id) as employee_count
            FROM payroll_runs pr
            LEFT JOIN journal_entries je ON je.id = pr.journal_entry_id
            LEFT JOIN payslips ps ON ps.payroll_run_id = pr.id
            GROUP BY pr.id
            ORDER BY pr.payment_date DESC, pr.id DESC
        `).all();
        res.json({ success: true, runs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get Single Payroll Run with all payslips
router.get('/runs/:id', (req, res) => {
    try {
        const run = db.prepare(`
            SELECT pr.*, je.entry_number as journal_entry_number
            FROM payroll_runs pr
            LEFT JOIN journal_entries je ON je.id = pr.journal_entry_id
            WHERE pr.id = ?
        `).get(req.params.id);

        if (!run) return res.status(404).json({ success: false, error: 'Payroll run not found.' });

        const payslips = db.prepare(`
            SELECT ps.*, e.employee_code, e.first_name, e.last_name, e.position, d.name as department_name, e.bank_name, e.bank_account
            FROM payslips ps
            JOIN employees e ON e.id = ps.employee_id
            LEFT JOIN departments d ON d.id = e.department_id
            WHERE ps.payroll_run_id = ?
            ORDER BY e.first_name ASC
        `).all(run.id);

        res.json({ success: true, run: { ...run, payslips } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Process New Payroll Run (Calculates for all active employees and auto-generates payslips)
router.post('/runs', (req, res) => {
    try {
        const { period_name, start_date, end_date, payment_date, bank_account_id, auto_post = true } = req.body;
        if (!period_name || !start_date || !end_date || !payment_date) {
            return res.status(400).json({ success: false, error: 'Period Name, Start Date, End Date, and Payment Date are required.' });
        }

        const activeEmployees = db.prepare('SELECT * FROM employees WHERE status = "ACTIVE"').all();
        if (activeEmployees.length === 0) {
            return res.status(400).json({ success: false, error: 'No active employees to process.' });
        }

        const run_number = AccountingEngine.getNextNumber('PAYROLL');
        let totalBasic = 0;
        let totalAllowances = 0;
        let totalDeductions = 0;
        let totalTax = 0;
        let totalNet = 0;

        const payslipData = activeEmployees.map(emp => {
            const basic = Number(emp.basic_salary);
            const allow = Number(emp.allowances) || 0;
            const gross = basic + allow;
            // Configurable payroll withholding rates (18% income tax, 5% benefit/insurance deductions)
            const tax = Math.round(gross * 0.18 * 100) / 100;
            const ded = Math.round(gross * 0.05 * 100) / 100;
            const net = Math.round((gross - tax - ded) * 100) / 100;

            totalBasic += basic;
            totalAllowances += allow;
            totalTax += tax;
            totalDeductions += ded;
            totalNet += net;

            return { employeeId: emp.id, basic, allow, ded, tax, net };
        });

        const username = req.user ? req.user.username : 'Admin';

        const tx = db.transaction(() => {
            const stmt = db.prepare(`
                INSERT INTO payroll_runs (
                    run_number, period_name, start_date, end_date, payment_date,
                    total_basic, total_allowances, total_deductions, total_tax,
                    net_payroll, status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)
            `);
            const result = stmt.run(
                run_number, period_name, start_date, end_date, payment_date,
                totalBasic, totalAllowances, totalDeductions, totalTax,
                totalNet, username
            );
            const runId = result.lastInsertRowid;

            const insertSlip = db.prepare(`
                INSERT INTO payslips (payroll_run_id, employee_id, basic_salary, allowances, deductions, tax_withheld, net_pay, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'GENERATED')
            `);

            for (const p of payslipData) {
                insertSlip.run(runId, p.employeeId, p.basic, p.allow, p.ded, p.tax, p.net);
            }

            let jeResult = null;
            if (auto_post) {
                jeResult = AccountingEngine.postPayrollRun(runId, bank_account_id || null, username);
            }

            return { runId, run_number, totalNet, jeResult };
        });

        const resData = tx();
        res.json({ success: true, ...resData, message: `Payroll run ${run_number} for ${period_name} processed and ledger updated.` });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
