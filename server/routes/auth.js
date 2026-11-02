const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const AuditService = require('../services/auditService');

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password required' });
        }

        const user = await db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
        if (!user || !user.is_active) {
            return res.status(401).json({ success: false, error: 'Invalid credentials or inactive account' });
        }

        const isValid = bcrypt.compareSync(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Update last login
        await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await AuditService.log({
            userId: user.id,
            username: user.username,
            action: 'LOGIN',
            entity: 'User',
            entityId: user.id,
            details: 'Successful enterprise login'
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                department: user.department
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get current profile
router.get('/me', async (req, res) => {
    try {
        const user = await db.prepare('SELECT id, username, email, full_name, role, department, last_login FROM users WHERE id = ?').get(req.user.id);
        const company = await db.prepare('SELECT * FROM companies LIMIT 1').get();
        const activeFY = await db.prepare('SELECT * FROM fiscal_years WHERE is_active = 1 LIMIT 1').get();

        res.json({
            success: true,
            user: user || req.user,
            company,
            activeFiscalYear: activeFY
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Role Switcher (Enables live testing of all roles)
router.post('/switch-role', async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['Super Admin', 'Admin', 'Finance Manager', 'Accountant', 'Auditor', 'Viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid enterprise role' });
        }

        // Find user with this role
        let targetUser = await db.prepare('SELECT * FROM users WHERE role = ? AND is_active = 1 LIMIT 1').get(role);
        if (!targetUser) {
            const adminUser = await db.prepare("SELECT * FROM users WHERE (role = 'Super Admin' OR role = 'Admin') AND is_active = 1 LIMIT 1").get();
            if (adminUser) {
                targetUser = {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                    full_name: `${adminUser.full_name} (${role})`,
                    role: role,
                    department: adminUser.department
                };
            } else {
                return res.status(404).json({ success: false, error: `No active user found with role ${role}` });
            }
        }

        const token = jwt.sign(
            { id: targetUser.id, username: targetUser.username, role: targetUser.role, full_name: targetUser.full_name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: targetUser.id,
                username: targetUser.username,
                email: targetUser.email,
                fullName: targetUser.full_name,
                role: targetUser.role,
                department: targetUser.department
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
