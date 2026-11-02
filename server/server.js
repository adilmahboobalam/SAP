require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { authMiddleware } = require('./middleware/authMiddleware');


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public Auth routes
app.use('/api/auth', require('./routes/auth'));

// Protected Enterprise Routes
app.use('/api/dashboard', authMiddleware, require('./routes/dashboard'));
app.use('/api/gl', authMiddleware, require('./routes/generalLedger'));
app.use('/api/sales', authMiddleware, require('./routes/sales'));
app.use('/api/purchases', authMiddleware, require('./routes/purchases'));
app.use('/api/banking', authMiddleware, require('./routes/banking'));
app.use('/api/expenses', authMiddleware, require('./routes/expenses'));
app.use('/api/inventory', authMiddleware, require('./routes/inventory'));
app.use('/api/payroll', authMiddleware, require('./routes/payroll'));
app.use('/api/tax', authMiddleware, require('./routes/tax'));
app.use('/api/reports', authMiddleware, require('./routes/reports'));
app.use('/api/admin', authMiddleware, require('./routes/admin'));
app.use('/api/uploads', authMiddleware, require('./routes/uploads'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        system: 'ApexERP Financials Enterprise (SAP S/4HANA Inspired)',
        version: '2026.1.0-RELEASE',
        timestamp: new Date().toISOString()
    });
});

// Fallback to index.html for SPA client-side routing
app.use((req, res, next) => {
    // If request is an API route that wasn't caught, return 404 JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: `API endpoint ${req.method} ${req.path} not found.` });
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Unhandled Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal Server Error'
    });
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`   ApexERP Financials Enterprise - Server Running       `);
        console.log(`   URL: http://localhost:${PORT}                         `);
        console.log(`   Double-Entry Engine: ACTIVE (SQL ACID Ledger)        `);
        console.log(`=======================================================`);
    });
}

module.exports = app;
