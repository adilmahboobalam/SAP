/**
 * Sales & Accounts Receivable Module View
 * Handles Customers, Quotations, Sales Orders, Invoices, Payments, Credit Notes & Statements
 */

const SalesView = {
    currentTab: 'invoices',
    customers: [],
    taxRates: [],
    products: [],

    async render(container, subTab = 'invoices') {
        this.currentTab = subTab;

        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Sales & Accounts Receivable</h1>
                    <div class="sap-page-subtitle">Customer Management, Billing, Payments & Aging Receivables</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="SalesView.openCustomerModal()">
                        + New Customer
                    </button>
                    <button class="sap-btn sap-btn-secondary" onclick="SalesView.openPaymentModal()">
                        + Receive Payment
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="SalesView.openInvoiceModal()">
                        + Create Sales Invoice
                    </button>
                </div>
            </div>

            <div class="sap-tabs-bar">
                <div class="sap-tab-item ${this.currentTab === 'invoices' ? 'active' : ''}" onclick="SalesView.switchTab('invoices')">
                    Sales Invoices
                </div>
                <div class="sap-tab-item ${this.currentTab === 'customers' ? 'active' : ''}" onclick="SalesView.switchTab('customers')">
                    Customers
                </div>
                <div class="sap-tab-item ${this.currentTab === 'orders' ? 'active' : ''}" onclick="SalesView.switchTab('orders')">
                    Orders & Quotations
                </div>
                <div class="sap-tab-item ${this.currentTab === 'payments' ? 'active' : ''}" onclick="SalesView.switchTab('payments')">
                    Payments Received
                </div>
                <div class="sap-tab-item ${this.currentTab === 'credit-notes' ? 'active' : ''}" onclick="SalesView.switchTab('credit-notes')">
                    Credit Notes
                </div>
            </div>

            <div class="sap-workspace-body" id="sales-tab-content">
                <!-- Subtab content rendered dynamically -->
            </div>
        `;

        await this.loadDependencies();
        await this.loadCurrentTab();
    },

    async loadDependencies() {
        try {
            const [custData, taxData, prodData] = await Promise.all([
                window.API.get('/api/sales/customers'),
                window.API.get('/api/tax/rates'),
                window.API.get('/api/inventory/products')
            ]);
            this.customers = custData.customers || [];
            this.taxRates = taxData.taxRates || [];
            this.products = prodData.products || [];
        } catch (e) {
            console.error('Failed to preload sales dependencies:', e);
        }
    },

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.sap-tab-item').forEach(el => {
            el.classList.toggle('active', el.textContent.toLowerCase().includes(tab.replace('-', ' ')));
        });
        this.loadCurrentTab();
    },

    async loadCurrentTab() {
        const content = document.getElementById('sales-tab-content');
        if (!content) return;

        if (this.currentTab === 'invoices') {
            await this.renderInvoices(content);
        } else if (this.currentTab === 'customers') {
            await this.renderCustomers(content);
        } else if (this.currentTab === 'orders') {
            await this.renderOrders(content);
        } else if (this.currentTab === 'payments') {
            await this.renderPayments(content);
        } else if (this.currentTab === 'credit-notes') {
            await this.renderCreditNotes(content);
        }
    },

    // 1. Sales Invoices Tab
    async renderInvoices(container) {
        container.innerHTML = `<div id="invoices-table-container">Loading Invoices...</div>`;
        try {
            const data = await window.API.get('/api/sales/invoices');
            const invoices = data.invoices || [];

            new EnterpriseTable({
                containerId: 'invoices-table-container',
                title: 'Sales Invoices Register',
                searchPlaceholder: 'Search invoice #, customer name...',
                exportName: 'Sales_Invoices',
                columns: [
                    { key: 'invoice_number', label: 'Invoice #', fontMono: true },
                    { key: 'invoice_date', label: 'Date' },
                    { key: 'due_date', label: 'Due Date' },
                    { key: 'customer_name', label: 'Customer' },
                    { 
                        key: 'total_amount', 
                        label: 'Invoice Total', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'balance_due', 
                        label: 'Balance Due', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.balance_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        align: 'center',
                        render: (r) => {
                            const badgeClasses = {
                                'DRAFT': 'sap-badge-draft',
                                'POSTED': 'sap-badge-posted',
                                'PAID': 'sap-badge-paid',
                                'PARTIALLY_PAID': 'sap-badge-submitted',
                                'OVERDUE': 'sap-badge-overdue'
                            };
                            return `<span class="sap-badge ${badgeClasses[r.status] || 'sap-badge-draft'}">${r.status}</span>`;
                        }
                    },
                    {
                        key: 'actions',
                        label: 'Actions',
                        sortable: false,
                        render: (r) => `
                            <div style="display: flex; gap: 4px; justify-content: flex-end;">
                                <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="SalesView.viewInvoiceDetail(${r.id})">
                                    View
                                </button>
                                ${r.status === 'DRAFT' ? `
                                    <button class="sap-btn sap-btn-primary sap-btn-sm" onclick="SalesView.postDraftInvoice(${r.id})">
                                        Post
                                    </button>
                                ` : ''}
                                ${r.balance_due > 0 && r.status !== 'DRAFT' ? `
                                    <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="SalesView.openPaymentModal(${r.customer_id}, ${r.id}, ${r.balance_due})">
                                        Pay
                                    </button>
                                ` : ''}
                            </div>
                        `
                    }
                ],
                data: invoices
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 2. Customers Tab
    async renderCustomers(container) {
        container.innerHTML = `<div id="customers-table-container">Loading Customers...</div>`;
        try {
            const data = await window.API.get('/api/sales/customers');
            this.customers = data.customers || [];

            new EnterpriseTable({
                containerId: 'customers-table-container',
                title: 'Customer Directory & Credit Terms',
                searchPlaceholder: 'Search customer code, name, city...',
                exportName: 'Customer_Directory',
                columns: [
                    { key: 'code', label: 'Customer Code', fontMono: true },
                    { key: 'name', label: 'Company / Name' },
                    { key: 'email', label: 'Contact Email' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'city', label: 'Location' },
                    { 
                        key: 'credit_limit', 
                        label: 'Credit Limit', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.credit_limit).toLocaleString()}`
                    },
                    { 
                        key: 'outstanding_balance', 
                        label: 'Outstanding AR', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong style="color: ${r.outstanding_balance > 0 ? '#0070f2' : '#64748b'};">$${Number(r.outstanding_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
                    },
                    {
                        key: 'actions',
                        label: 'Statement',
                        sortable: false,
                        render: (r) => `
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="SalesView.viewCustomerStatement(${r.id})">
                                Statement
                            </button>
                        `
                    }
                ],
                data: this.customers
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 3. Orders & Quotations
    async renderOrders(container) {
        container.innerHTML = `
            <div id="orders-table-container">Loading Orders...</div>
            <div id="quotes-table-container" style="margin-top: 24px;">Loading Quotations...</div>
        `;
        try {
            const [ordersData, quotesData] = await Promise.all([
                window.API.get('/api/sales/orders'),
                window.API.get('/api/sales/quotations')
            ]);

            new EnterpriseTable({
                containerId: 'orders-table-container',
                title: 'Sales Orders Pipeline',
                exportName: 'Sales_Orders',
                columns: [
                    { key: 'order_number', label: 'Order #', fontMono: true },
                    { key: 'order_date', label: 'Order Date' },
                    { key: 'delivery_date', label: 'Delivery Date' },
                    { key: 'customer_name', label: 'Customer' },
                    { 
                        key: 'total_amount', 
                        label: 'Amount ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'status', 
                        label: 'Status', 
                        align: 'center',
                        render: (r) => `<span class="sap-badge sap-badge-posted">${r.status}</span>`
                    }
                ],
                data: ordersData.orders || []
            });

            new EnterpriseTable({
                containerId: 'quotes-table-container',
                title: 'Customer Quotations',
                exportName: 'Sales_Quotations',
                columns: [
                    { key: 'quotation_number', label: 'Quote #', fontMono: true },
                    { key: 'quotation_date', label: 'Date' },
                    { key: 'valid_until', label: 'Valid Until' },
                    { key: 'customer_name', label: 'Customer' },
                    { 
                        key: 'total_amount', 
                        label: 'Quote Value', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { key: 'status', label: 'Status', align: 'center', render: (r) => `<span class="sap-badge sap-badge-draft">${r.status}</span>` }
                ],
                data: quotesData.quotations || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 4. Payments Received Tab
    async renderPayments(container) {
        container.innerHTML = `<div id="payments-table-container">Loading Payments...</div>`;
        try {
            const data = await window.API.get('/api/sales/payments');
            new EnterpriseTable({
                containerId: 'payments-table-container',
                title: 'Customer Payments Register (Receipts)',
                exportName: 'Customer_Payments',
                columns: [
                    { key: 'payment_number', label: 'Payment #', fontMono: true },
                    { key: 'payment_date', label: 'Date' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'payment_method', label: 'Method' },
                    { key: 'bank_name', label: 'Deposited To' },
                    { key: 'reference', label: 'Transaction Ref' },
                    { 
                        key: 'amount', 
                        label: 'Amount Paid', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong style="color: #10b981;">$${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
                    },
                    { key: 'journal_entry_number', label: 'GL Journal Voucher', fontMono: true }
                ],
                data: data.payments || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 5. Credit Notes Tab
    async renderCreditNotes(container) {
        container.innerHTML = `<div id="creditnotes-table-container">Loading Credit Notes...</div>`;
        try {
            const data = await window.API.get('/api/sales/credit-notes');
            new EnterpriseTable({
                containerId: 'creditnotes-table-container',
                title: 'Sales Credit Notes (Reversals & Allowances)',
                exportName: 'Credit_Notes',
                columns: [
                    { key: 'note_number', label: 'Credit Note #', fontMono: true },
                    { key: 'note_date', label: 'Date' },
                    { key: 'invoice_number', label: 'Original Invoice' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'reason', label: 'Reason' },
                    { 
                        key: 'amount', 
                        label: 'Credit Amount', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { key: 'status', label: 'Status', align: 'center', render: (r) => `<span class="sap-badge sap-badge-reversed">${r.status}</span>` }
                ],
                data: data.creditNotes || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // Create Invoice Modal
    openInvoiceModal() {
        let modalEl = document.getElementById('sales-invoice-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'sales-invoice-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const today = new Date().toISOString().split('T')[0];
        const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        modalEl.innerHTML = `
            <div class="sap-modal modal-xl">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">📄 Create & Post Sales Invoice</div>
                    <button class="sap-modal-close" onclick="document.getElementById('sales-invoice-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Customer *</label>
                            <select id="inv-customer-id" class="sap-select">
                                <option value="">-- Select Customer --</option>
                                ${this.customers.map(c => `<option value="${c.id}">${c.code} - ${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Invoice Date *</label>
                            <input type="date" id="inv-date" class="sap-input" value="${today}">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Payment Due Date *</label>
                            <input type="date" id="inv-due-date" class="sap-input" value="${nextMonth}">
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 14px;">
                        <span style="font-size: 13px; font-weight: 700;">Invoice Line Items</span>
                        <button type="button" class="sap-btn sap-btn-secondary sap-btn-sm" onclick="SalesView.addInvoiceRow()">+ Add Item</button>
                    </div>

                    <div class="sap-line-grid">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 25%;">Product / Service</th>
                                    <th style="width: 25%;">Description *</th>
                                    <th style="width: 10%; text-align: right;">Qty</th>
                                    <th style="width: 13%; text-align: right;">Unit Price ($)</th>
                                    <th style="width: 14%;">Tax Rate</th>
                                    <th style="width: 10%; text-align: right;">Total ($)</th>
                                    <th style="width: 3%;"></th>
                                </tr>
                            </thead>
                            <tbody id="invoice-line-items-body">
                                <!-- Lines -->
                            </tbody>
                        </table>
                        <div class="sap-line-grid-footer">
                            <div>Total Lines: <span id="inv-lines-count">1</span></div>
                            <div style="text-align: right; font-family: monospace; font-size: 13px;">
                                <div>Subtotal: <strong id="inv-subtotal-disp">$0.00</strong></div>
                                <div>Sales Tax: <strong id="inv-tax-disp">$0.00</strong></div>
                                <div style="font-size: 15px; color: #0070f2;">Grand Total: <strong id="inv-total-disp">$0.00</strong></div>
                            </div>
                        </div>
                    </div>

                    <div class="sap-form-group">
                        <label class="sap-form-label">Notes & Payment Terms</label>
                        <input type="text" id="inv-notes" class="sap-input" placeholder="e.g. Wire transfer payable within 30 days to JPMorgan Chase.">
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('sales-invoice-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="SalesView.submitInvoice()">✓ Post Invoice to Ledger</button>
                </div>
            </div>
        `;

        this.invoiceRows = [{ productId: '', description: '', qty: 1, unitPrice: 0, taxRateId: '' }];
        modalEl.classList.add('active');
        this.renderInvoiceRows();
    },

    addInvoiceRow() {
        this.invoiceRows.push({ productId: '', description: '', qty: 1, unitPrice: 0, taxRateId: '' });
        this.renderInvoiceRows();
    },

    removeInvoiceRow(idx) {
        if (this.invoiceRows.length <= 1) return;
        this.invoiceRows.splice(idx, 1);
        this.renderInvoiceRows();
    },

    renderInvoiceRows() {
        const tbody = document.getElementById('invoice-line-items-body');
        if (!tbody) return;

        tbody.innerHTML = this.invoiceRows.map((row, idx) => `
            <tr>
                <td>
                    <select class="sap-select" onchange="SalesView.onProductSelect(${idx}, this.value)">
                        <option value="">-- Custom Item --</option>
                        ${this.products.map(p => `
                            <option value="${p.id}" ${row.productId == p.id ? 'selected' : ''}>
                                ${p.sku} - ${p.name} ($${p.selling_price})
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="sap-input" placeholder="Item description" value="${row.description || ''}"
                           oninput="SalesView.updateInvoiceRow(${idx}, 'description', this.value)">
                </td>
                <td>
                    <input type="number" min="1" step="1" class="sap-input text-right" value="${row.qty}"
                           oninput="SalesView.updateInvoiceRow(${idx}, 'qty', this.value)">
                </td>
                <td>
                    <input type="number" min="0" step="0.01" class="sap-input text-right" value="${row.unitPrice}"
                           oninput="SalesView.updateInvoiceRow(${idx}, 'unitPrice', this.value)">
                </td>
                <td>
                    <select class="sap-select" onchange="SalesView.updateInvoiceRow(${idx}, 'taxRateId', this.value)">
                        <option value="">No Tax (0%)</option>
                        ${this.taxRates.map(t => `
                            <option value="${t.id}" ${row.taxRateId == t.id ? 'selected' : ''}>
                                ${t.name} (${t.rate}%)
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td class="text-right font-mono" id="row-total-${idx}">
                    $0.00
                </td>
                <td class="text-center">
                    <button type="button" style="background:none; border:none; color:red; cursor:pointer;" onclick="SalesView.removeInvoiceRow(${idx})">✕</button>
                </td>
            </tr>
        `).join('');

        this.calculateInvoiceTotals();
    },

    onProductSelect(idx, prodId) {
        this.invoiceRows[idx].productId = prodId;
        const prod = this.products.find(p => p.id == prodId);
        if (prod) {
            this.invoiceRows[idx].description = prod.name;
            this.invoiceRows[idx].unitPrice = prod.selling_price;
            // Default to standard VAT if available
            const defaultTax = this.taxRates.find(t => t.code === 'VAT-10');
            if (defaultTax) this.invoiceRows[idx].taxRateId = defaultTax.id;
        }
        this.renderInvoiceRows();
    },

    updateInvoiceRow(idx, field, value) {
        this.invoiceRows[idx][field] = value;
        this.calculateInvoiceTotals();
    },

    calculateInvoiceTotals() {
        let subtotal = 0;
        let totalTax = 0;

        this.invoiceRows.forEach((row, idx) => {
            const qty = Number(row.qty) || 1;
            const price = Number(row.unitPrice) || 0;
            const lineSub = Math.round(qty * price * 100) / 100;

            let rate = 0;
            if (row.taxRateId) {
                const tr = this.taxRates.find(t => t.id == row.taxRateId);
                if (tr) rate = tr.rate;
            }
            const lineTax = Math.round((lineSub * (rate / 100)) * 100) / 100;
            const lineTotal = lineSub + lineTax;

            subtotal += lineSub;
            totalTax += lineTax;

            const rowTotalEl = document.getElementById(`row-total-${idx}`);
            if (rowTotalEl) rowTotalEl.textContent = `$${lineTotal.toFixed(2)}`;
        });

        const total = subtotal + totalTax;

        document.getElementById('inv-subtotal-disp').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('inv-tax-disp').textContent = `$${totalTax.toFixed(2)}`;
        document.getElementById('inv-total-disp').textContent = `$${total.toFixed(2)}`;
        document.getElementById('inv-lines-count').textContent = this.invoiceRows.length;

        return { subtotal, totalTax, total };
    },

    async submitInvoice() {
        const customer_id = document.getElementById('inv-customer-id').value;
        const invoice_date = document.getElementById('inv-date').value;
        const due_date = document.getElementById('inv-due-date').value;
        const notes = document.getElementById('inv-notes').value;

        if (!customer_id) {
            window.App.showToast('Please select a customer.', 'error');
            return;
        }

        const items = this.invoiceRows.map(r => ({
            product_id: r.productId || null,
            description: r.description || 'Sales Item',
            quantity: Number(r.qty) || 1,
            unit_price: Number(r.unitPrice) || 0,
            tax_rate_id: r.taxRateId || null
        }));

        try {
            const res = await window.API.post('/api/sales/invoices', {
                customer_id,
                invoice_date,
                due_date,
                notes,
                items,
                auto_post: true
            });

            window.App.showToast(res.message || 'Invoice posted successfully!', 'success');
            document.getElementById('sales-invoice-modal').classList.remove('active');
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // Record Payment Modal
    async openPaymentModal(customerId = null, invoiceId = null, amountDue = null) {
        let modalEl = document.getElementById('sales-payment-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'sales-payment-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const bankData = await window.API.get('/api/banking/accounts');
        const banks = bankData.accounts || [];
        const today = new Date().toISOString().split('T')[0];

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">💵 Receive Customer Payment</div>
                    <button class="sap-modal-close" onclick="document.getElementById('sales-payment-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-group">
                        <label class="sap-form-label">Customer *</label>
                        <select id="pay-customer-id" class="sap-select">
                            <option value="">-- Select Customer --</option>
                            ${this.customers.map(c => `
                                <option value="${c.id}" ${customerId == c.id ? 'selected' : ''}>
                                    ${c.code} - ${c.name} (Due: $${Number(c.outstanding_balance).toLocaleString()})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Payment Date *</label>
                            <input type="date" id="pay-date" class="sap-input" value="${today}">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Deposit Into Bank *</label>
                            <select id="pay-bank-id" class="sap-select">
                                ${banks.map(b => `<option value="${b.id}">${b.bank_name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Payment Amount ($) *</label>
                            <input type="number" step="0.01" min="0.01" id="pay-amount" class="sap-input" value="${amountDue || ''}">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Payment Method</label>
                            <select id="pay-method" class="sap-select">
                                <option value="BANK_TRANSFER">Bank Wire / ACH</option>
                                <option value="CHEQUE">Corporate Cheque</option>
                                <option value="CREDIT_CARD">Credit Card</option>
                                <option value="CASH">Cash</option>
                            </select>
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Bank Reference / Wire Code</label>
                        <input type="text" id="pay-ref" class="sap-input" placeholder="e.g. WIRE-89421">
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('sales-payment-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="SalesView.submitPayment(${invoiceId || 'null'})">Post Customer Receipt</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitPayment(invoiceId) {
        const customer_id = document.getElementById('pay-customer-id').value;
        const payment_date = document.getElementById('pay-date').value;
        const bank_account_id = document.getElementById('pay-bank-id').value;
        const amount = document.getElementById('pay-amount').value;
        const payment_method = document.getElementById('pay-method').value;
        const reference = document.getElementById('pay-ref').value;

        if (!customer_id || !payment_date || !bank_account_id || !amount) {
            window.App.showToast('Please fill all required fields.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/sales/payments', {
                customer_id,
                invoice_id: invoiceId,
                payment_date,
                bank_account_id,
                payment_method,
                amount: Number(amount),
                reference
            });

            window.App.showToast(res.message || 'Payment successfully posted!', 'success');
            document.getElementById('sales-payment-modal').classList.remove('active');
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // View Invoice Detail Modal
    async viewInvoiceDetail(invoiceId) {
        try {
            const data = await window.API.get(`/api/sales/invoices/${invoiceId}`);
            const inv = data.invoice;

            let modalEl = document.getElementById('invoice-view-modal');
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = 'invoice-view-modal';
                modalEl.className = 'sap-modal-backdrop';
                document.body.appendChild(modalEl);
            }

            modalEl.innerHTML = `
                <div class="sap-modal modal-lg">
                    <div class="sap-modal-header">
                        <div class="sap-modal-title">Sales Invoice: ${inv.invoice_number}</div>
                        <div style="display: flex; gap: 8px;">
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="window.print()">🖨️ Print</button>
                            <button class="sap-modal-close" onclick="document.getElementById('invoice-view-modal').classList.remove('active')">×</button>
                        </div>
                    </div>
                    <div class="sap-modal-body">
                        <div class="sap-report-container" style="border: none; box-shadow: none; padding: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                                <div>
                                    <h2 style="font-size: 20px; font-weight: 800; color: #1e293b;">INVOICE</h2>
                                    <div class="font-mono" style="font-size: 14px; font-weight: 700; color: #0070f2;">${inv.invoice_number}</div>
                                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Date: ${inv.invoice_date} | Due: ${inv.due_date}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 800; font-size: 15px;">Apex Enterprise Solutions Corp.</div>
                                    <div style="font-size: 11.5px; color: #64748b;">100 Enterprise Blvd, New York, NY</div>
                                    <div style="font-size: 11.5px; color: #64748b;">Tax ID: US-94-2849102</div>
                                </div>
                            </div>

                            <div style="background: #f8fafc; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Bill To:</div>
                                <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${inv.customer_name} (${inv.customer_code})</div>
                                <div style="font-size: 12px; color: #475569;">${inv.customer_address || ''}</div>
                                <div style="font-size: 12px; color: #475569;">Email: ${inv.customer_email || '-'}</div>
                            </div>

                            <table class="sap-table">
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th class="text-right">Qty</th>
                                        <th class="text-right">Unit Price</th>
                                        <th class="text-right">Tax</th>
                                        <th class="text-right">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${inv.items.map(i => `
                                        <tr>
                                            <td><strong>${i.description}</strong></td>
                                            <td class="text-right font-mono">${i.quantity}</td>
                                            <td class="text-right font-mono">$${Number(i.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td class="text-right font-mono">$${Number(i.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td class="text-right font-mono">$${Number(i.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="4" class="text-right">Subtotal:</td>
                                        <td class="text-right font-mono">$${Number(inv.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr>
                                        <td colspan="4" class="text-right">Sales Tax:</td>
                                        <td class="text-right font-mono">$${Number(inv.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr style="font-weight: 800; font-size: 14px;">
                                        <td colspan="4" class="text-right">Total Invoice Amount:</td>
                                        <td class="text-right font-mono" style="color: #0070f2;">$${Number(inv.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr style="color: #10b981;">
                                        <td colspan="4" class="text-right">Paid to Date:</td>
                                        <td class="text-right font-mono">-$${Number(inv.paid_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr style="font-weight: 800; color: ${inv.balance_due > 0 ? '#e53935' : '#10b981'};">
                                        <td colspan="4" class="text-right">Remaining Balance Due:</td>
                                        <td class="text-right font-mono">$${Number(inv.balance_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    <div class="sap-modal-footer">
                        <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('invoice-view-modal').classList.remove('active')">Close</button>
                    </div>
                </div>
            `;
            modalEl.classList.add('active');
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // New Customer Modal
    openCustomerModal() {
        let modalEl = document.getElementById('new-customer-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'new-customer-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">Register New Customer</div>
                    <button class="sap-modal-close" onclick="document.getElementById('new-customer-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-group">
                        <label class="sap-form-label">Customer Legal Name *</label>
                        <input type="text" id="cust-name" class="sap-input" placeholder="e.g. Lockheed Martin Corporation">
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Email</label>
                            <input type="email" id="cust-email" class="sap-input" placeholder="billing@client.com">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Phone</label>
                            <input type="text" id="cust-phone" class="sap-input" placeholder="+1 (555) 000-0000">
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Credit Limit ($)</label>
                            <input type="number" id="cust-limit" class="sap-input" value="50000">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Payment Terms (Days)</label>
                            <input type="number" id="cust-terms" class="sap-input" value="30">
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Billing Address & City</label>
                        <input type="text" id="cust-address" class="sap-input" placeholder="Address">
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('new-customer-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="SalesView.submitCustomer()">Save Customer</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitCustomer() {
        const name = document.getElementById('cust-name').value;
        const email = document.getElementById('cust-email').value;
        const phone = document.getElementById('cust-phone').value;
        const credit_limit = document.getElementById('cust-limit').value;
        const payment_terms = document.getElementById('cust-terms').value;
        const address = document.getElementById('cust-address').value;

        if (!name) {
            window.App.showToast('Customer name is required.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/sales/customers', { name, email, phone, credit_limit, payment_terms, address });
            window.App.showToast(res.message || 'Customer created.', 'success');
            document.getElementById('new-customer-modal').classList.remove('active');
            await this.loadDependencies();
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    async viewCustomerStatement(customerId) {
        try {
            const data = await window.API.get(`/api/sales/customers/${customerId}/statement`);
            const c = data.customer;
            const invoices = data.invoices || [];
            const payments = data.payments || [];

            let modalEl = document.getElementById('customer-statement-modal');
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = 'customer-statement-modal';
                modalEl.className = 'sap-modal-backdrop';
                document.body.appendChild(modalEl);
            }

            modalEl.innerHTML = `
                <div class="sap-modal modal-lg">
                    <div class="sap-modal-header">
                        <div class="sap-modal-title">Account Statement: ${c.name} (${c.code})</div>
                        <div style="display: flex; gap: 8px;">
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="window.print()">🖨️ Print</button>
                            <button class="sap-modal-close" onclick="document.getElementById('customer-statement-modal').classList.remove('active')">×</button>
                        </div>
                    </div>
                    <div class="sap-modal-body">
                        <h4 style="margin-bottom: 8px;">Billed Sales Invoices</h4>
                        <table class="sap-table" style="margin-bottom: 20px;">
                            <thead>
                                <tr><th>Invoice #</th><th>Date</th><th>Due</th><th class="text-right">Total ($)</th><th class="text-right">Balance Due ($)</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                ${invoices.map(i => `
                                    <tr>
                                        <td class="font-mono">${i.invoice_number}</td>
                                        <td>${i.invoice_date}</td>
                                        <td>${i.due_date}</td>
                                        <td class="text-right font-mono">$${Number(i.total_amount).toLocaleString()}</td>
                                        <td class="text-right font-mono">$${Number(i.total_amount - i.paid_amount).toLocaleString()}</td>
                                        <td><span class="sap-badge sap-badge-posted">${i.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <h4 style="margin-bottom: 8px;">Payment History</h4>
                        <table class="sap-table">
                            <thead>
                                <tr><th>Payment #</th><th>Date</th><th>Method</th><th>Reference</th><th class="text-right">Amount ($)</th></tr>
                            </thead>
                            <tbody>
                                ${payments.map(p => `
                                    <tr>
                                        <td class="font-mono">${p.payment_number}</td>
                                        <td>${p.payment_date}</td>
                                        <td>${p.payment_method}</td>
                                        <td>${p.reference || '-'}</td>
                                        <td class="text-right font-mono" style="color: #10b981;">$${Number(p.amount).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="sap-modal-footer">
                        <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('customer-statement-modal').classList.remove('active')">Close</button>
                    </div>
                </div>
            `;
            modalEl.classList.add('active');
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    }
};

window.SalesView = SalesView;
