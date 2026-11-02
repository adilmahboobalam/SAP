/**
 * Purchases & Accounts Payable Module View
 * Handles Suppliers, Purchase Orders, Vendor Bills, Disbursements, Debit Notes & Statements
 */

const PurchasesView = {
    currentTab: 'bills',
    suppliers: [],
    taxRates: [],
    products: [],
    expenseAccounts: [],

    async render(container, subTab = 'bills') {
        this.currentTab = subTab;

        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Purchases & Accounts Payable</h1>
                    <div class="sap-page-subtitle">Supplier Management, Procurement Bills, Disbursements & Payables Aging</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="PurchasesView.openSupplierModal()">
                        + New Supplier
                    </button>
                    <button class="sap-btn sap-btn-secondary" onclick="PurchasesView.openPaymentModal()">
                        + Disburse Payment
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="PurchasesView.openBillModal()">
                        + Enter Vendor Bill
                    </button>
                </div>
            </div>

            <div class="sap-tabs-bar">
                <div class="sap-tab-item ${this.currentTab === 'bills' ? 'active' : ''}" onclick="PurchasesView.switchTab('bills')">
                    Purchase Invoices (Bills)
                </div>
                <div class="sap-tab-item ${this.currentTab === 'suppliers' ? 'active' : ''}" onclick="PurchasesView.switchTab('suppliers')">
                    Suppliers & Vendors
                </div>
                <div class="sap-tab-item ${this.currentTab === 'orders' ? 'active' : ''}" onclick="PurchasesView.switchTab('orders')">
                    Purchase Orders
                </div>
                <div class="sap-tab-item ${this.currentTab === 'payments' ? 'active' : ''}" onclick="PurchasesView.switchTab('payments')">
                    Vendor Payments (Disbursements)
                </div>
                <div class="sap-tab-item ${this.currentTab === 'debit-notes' ? 'active' : ''}" onclick="PurchasesView.switchTab('debit-notes')">
                    Debit Notes
                </div>
            </div>

            <div class="sap-workspace-body" id="purchases-tab-content">
                <!-- Tab body rendered dynamically -->
            </div>
        `;

        await this.loadDependencies();
        await this.loadCurrentTab();
    },

    async loadDependencies() {
        try {
            const [suppData, taxData, prodData, coaData] = await Promise.all([
                window.API.get('/api/purchases/suppliers'),
                window.API.get('/api/tax/rates'),
                window.API.get('/api/inventory/products'),
                window.API.get('/api/gl/accounts?type=EXPENSE')
            ]);
            this.suppliers = suppData.suppliers || [];
            this.taxRates = taxData.taxRates || [];
            this.products = prodData.products || [];
            this.expenseAccounts = coaData.accounts || [];
        } catch (e) {
            console.error('Failed to preload purchases dependencies:', e);
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
        const content = document.getElementById('purchases-tab-content');
        if (!content) return;

        if (this.currentTab === 'bills') {
            await this.renderBills(content);
        } else if (this.currentTab === 'suppliers') {
            await this.renderSuppliers(content);
        } else if (this.currentTab === 'orders') {
            await this.renderOrders(content);
        } else if (this.currentTab === 'payments') {
            await this.renderPayments(content);
        } else if (this.currentTab === 'debit-notes') {
            await this.renderDebitNotes(content);
        }
    },

    // 1. Vendor Bills Tab
    async renderBills(container) {
        container.innerHTML = `<div id="bills-table-container">Loading Vendor Bills...</div>`;
        try {
            const data = await window.API.get('/api/purchases/invoices');
            const bills = data.invoices || [];

            new EnterpriseTable({
                containerId: 'bills-table-container',
                title: 'Purchase Invoices / Vendor Bills',
                searchPlaceholder: 'Search bill #, supplier...',
                exportName: 'Purchase_Bills',
                columns: [
                    { key: 'bill_number', label: 'Bill #', fontMono: true },
                    { key: 'bill_date', label: 'Date' },
                    { key: 'due_date', label: 'Due Date' },
                    { key: 'supplier_name', label: 'Vendor / Supplier' },
                    { 
                        key: 'total_amount', 
                        label: 'Bill Total ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'balance_due', 
                        label: 'Balance Due ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong style="color: ${r.balance_due > 0 ? '#e53935' : '#10b981'};">$${Number(r.balance_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
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
                                ${r.status === 'DRAFT' ? `
                                    <button class="sap-btn sap-btn-primary sap-btn-sm" onclick="PurchasesView.postDraftBill(${r.id})">
                                        Post
                                    </button>
                                ` : ''}
                                ${r.balance_due > 0 && r.status !== 'DRAFT' ? `
                                    <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="PurchasesView.openPaymentModal(${r.supplier_id}, ${r.id}, ${r.balance_due})">
                                        Pay
                                    </button>
                                ` : ''}
                            </div>
                        `
                    }
                ],
                data: bills
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 2. Suppliers Tab
    async renderSuppliers(container) {
        container.innerHTML = `<div id="suppliers-table-container">Loading Suppliers...</div>`;
        try {
            const data = await window.API.get('/api/purchases/suppliers');
            this.suppliers = data.suppliers || [];

            new EnterpriseTable({
                containerId: 'suppliers-table-container',
                title: 'Supplier & Vendor Directory',
                searchPlaceholder: 'Search supplier code, name, city...',
                exportName: 'Suppliers_Directory',
                columns: [
                    { key: 'code', label: 'Supplier Code', fontMono: true },
                    { key: 'name', label: 'Company / Vendor' },
                    { key: 'email', label: 'Email' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'city', label: 'Location' },
                    { key: 'payment_terms', label: 'Terms', render: (r) => `Net ${r.payment_terms} Days` },
                    { 
                        key: 'outstanding_balance', 
                        label: 'Payables Balance', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong style="color: ${r.outstanding_balance > 0 ? '#e53935' : '#64748b'};">$${Number(r.outstanding_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
                    },
                    {
                        key: 'actions',
                        label: 'Statement',
                        sortable: false,
                        render: (r) => `
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="PurchasesView.viewSupplierStatement(${r.id})">
                                Statement
                            </button>
                        `
                    }
                ],
                data: this.suppliers
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 3. Purchase Orders
    async renderOrders(container) {
        container.innerHTML = `<div id="po-table-container">Loading Purchase Orders...</div>`;
        try {
            const data = await window.API.get('/api/purchases/orders');
            new EnterpriseTable({
                containerId: 'po-table-container',
                title: 'Procurement Purchase Orders',
                exportName: 'Purchase_Orders',
                columns: [
                    { key: 'order_number', label: 'PO #', fontMono: true },
                    { key: 'order_date', label: 'Date' },
                    { key: 'expected_date', label: 'Expected Date' },
                    { key: 'supplier_name', label: 'Supplier' },
                    { 
                        key: 'total_amount', 
                        label: 'Amount ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { key: 'status', label: 'Status', align: 'center', render: (r) => `<span class="sap-badge sap-badge-posted">${r.status}</span>` }
                ],
                data: data.orders || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 4. Vendor Disbursements Tab
    async renderPayments(container) {
        container.innerHTML = `<div id="disbursements-table-container">Loading Disbursements...</div>`;
        try {
            const data = await window.API.get('/api/purchases/payments');
            new EnterpriseTable({
                containerId: 'disbursements-table-container',
                title: 'Vendor Payments Register (Disbursements)',
                exportName: 'Vendor_Disbursements',
                columns: [
                    { key: 'payment_number', label: 'Disbursement #', fontMono: true },
                    { key: 'payment_date', label: 'Date' },
                    { key: 'supplier_name', label: 'Supplier' },
                    { key: 'payment_method', label: 'Method' },
                    { key: 'bank_name', label: 'Drawn From Bank' },
                    { key: 'reference', label: 'Check/Wire #' },
                    { 
                        key: 'amount', 
                        label: 'Amount Paid', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong style="color: #e53935;">-$${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
                    },
                    { key: 'journal_entry_number', label: 'GL Journal Voucher', fontMono: true }
                ],
                data: data.payments || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 5. Debit Notes Tab
    async renderDebitNotes(container) {
        container.innerHTML = `<div id="debitnotes-table-container">Loading Debit Notes...</div>`;
        try {
            const data = await window.API.get('/api/purchases/debit-notes');
            new EnterpriseTable({
                containerId: 'debitnotes-table-container',
                title: 'Vendor Debit Notes (Returns & Deductions)',
                exportName: 'Debit_Notes',
                columns: [
                    { key: 'note_number', label: 'Debit Note #', fontMono: true },
                    { key: 'note_date', label: 'Date' },
                    { key: 'bill_number', label: 'Original Bill #' },
                    { key: 'supplier_name', label: 'Supplier' },
                    { key: 'reason', label: 'Reason' },
                    { 
                        key: 'amount', 
                        label: 'Deduction Amount', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { key: 'status', label: 'Status', align: 'center', render: (r) => `<span class="sap-badge sap-badge-reversed">${r.status}</span>` }
                ],
                data: data.debitNotes || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // Enter Vendor Bill Modal
    openBillModal() {
        let modalEl = document.getElementById('vendor-bill-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'vendor-bill-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const today = new Date().toISOString().split('T')[0];
        const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        modalEl.innerHTML = `
            <div class="sap-modal modal-xl">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">📋 Enter & Post Purchase Invoice (Vendor Bill)</div>
                    <button class="sap-modal-close" onclick="document.getElementById('vendor-bill-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Vendor / Supplier *</label>
                            <select id="bill-supplier-id" class="sap-select">
                                <option value="">-- Select Supplier --</option>
                                ${this.suppliers.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Bill Date *</label>
                            <input type="date" id="bill-date" class="sap-input" value="${today}">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Due Date *</label>
                            <input type="date" id="bill-due-date" class="sap-input" value="${nextMonth}">
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 14px;">
                        <span style="font-size: 13px; font-weight: 700;">Bill Line Items (Expense / Inventory Stock)</span>
                        <button type="button" class="sap-btn sap-btn-secondary sap-btn-sm" onclick="PurchasesView.addBillRow()">+ Add Item</button>
                    </div>

                    <div class="sap-line-grid">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 28%;">Expense Account / Item</th>
                                    <th style="width: 26%;">Description *</th>
                                    <th style="width: 10%; text-align: right;">Qty</th>
                                    <th style="width: 12%; text-align: right;">Cost ($)</th>
                                    <th style="width: 12%;">Input Tax</th>
                                    <th style="width: 12%; text-align: right;">Total ($)</th>
                                    <th style="width: 3%;"></th>
                                </tr>
                            </thead>
                            <tbody id="bill-line-items-body"></tbody>
                        </table>
                        <div class="sap-line-grid-footer">
                            <div>Lines: <span id="bill-lines-count">1</span></div>
                            <div style="text-align: right; font-family: monospace; font-size: 13px;">
                                <div>Subtotal: <strong id="bill-subtotal-disp">$0.00</strong></div>
                                <div>Input Tax Receivable: <strong id="bill-tax-disp">$0.00</strong></div>
                                <div style="font-size: 15px; color: #e53935;">Grand Total: <strong id="bill-total-disp">$0.00</strong></div>
                            </div>
                        </div>
                    </div>

                    <div class="sap-form-group">
                        <label class="sap-form-label">Notes & Reference</label>
                        <input type="text" id="bill-notes" class="sap-input" placeholder="e.g. Server rack procurement PO-991">
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('vendor-bill-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="PurchasesView.submitBill()">✓ Post Bill to Accounts Payable</button>
                </div>
            </div>
        `;

        this.billRows = [{ accountId: '', description: '', qty: 1, unitPrice: 0, taxRateId: '' }];
        modalEl.classList.add('active');
        this.renderBillRows();
    },

    addBillRow() {
        this.billRows.push({ accountId: '', description: '', qty: 1, unitPrice: 0, taxRateId: '' });
        this.renderBillRows();
    },

    removeBillRow(idx) {
        if (this.billRows.length <= 1) return;
        this.billRows.splice(idx, 1);
        this.renderBillRows();
    },

    renderBillRows() {
        const tbody = document.getElementById('bill-line-items-body');
        if (!tbody) return;

        tbody.innerHTML = this.billRows.map((row, idx) => `
            <tr>
                <td>
                    <select class="sap-select" onchange="PurchasesView.updateBillRow(${idx}, 'accountId', this.value)">
                        <option value="">-- Select Expense GL --</option>
                        ${this.expenseAccounts.map(a => `
                            <option value="${a.id}" ${row.accountId == a.id ? 'selected' : ''}>
                                ${a.code} - ${a.name}
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="sap-input" placeholder="Description" value="${row.description || ''}"
                           oninput="PurchasesView.updateBillRow(${idx}, 'description', this.value)">
                </td>
                <td>
                    <input type="number" min="1" step="1" class="sap-input text-right" value="${row.qty}"
                           oninput="PurchasesView.updateBillRow(${idx}, 'qty', this.value)">
                </td>
                <td>
                    <input type="number" min="0" step="0.01" class="sap-input text-right" value="${row.unitPrice}"
                           oninput="PurchasesView.updateBillRow(${idx}, 'unitPrice', this.value)">
                </td>
                <td>
                    <select class="sap-select" onchange="PurchasesView.updateBillRow(${idx}, 'taxRateId', this.value)">
                        <option value="">No Tax (0%)</option>
                        ${this.taxRates.map(t => `
                            <option value="${t.id}" ${row.taxRateId == t.id ? 'selected' : ''}>
                                ${t.name} (${t.rate}%)
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td class="text-right font-mono" id="bill-row-total-${idx}">$0.00</td>
                <td class="text-center">
                    <button type="button" style="background:none; border:none; color:red; cursor:pointer;" onclick="PurchasesView.removeBillRow(${idx})">✕</button>
                </td>
            </tr>
        `).join('');

        this.calculateBillTotals();
    },

    updateBillRow(idx, field, value) {
        this.billRows[idx][field] = value;
        this.calculateBillTotals();
    },

    calculateBillTotals() {
        let subtotal = 0;
        let totalTax = 0;

        this.billRows.forEach((row, idx) => {
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

            const rowTotalEl = document.getElementById(`bill-row-total-${idx}`);
            if (rowTotalEl) rowTotalEl.textContent = `$${lineTotal.toFixed(2)}`;
        });

        const total = subtotal + totalTax;

        document.getElementById('bill-subtotal-disp').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('bill-tax-disp').textContent = `$${totalTax.toFixed(2)}`;
        document.getElementById('bill-total-disp').textContent = `$${total.toFixed(2)}`;
        document.getElementById('bill-lines-count').textContent = this.billRows.length;

        return { subtotal, totalTax, total };
    },

    async submitBill() {
        const supplier_id = document.getElementById('bill-supplier-id').value;
        const bill_date = document.getElementById('bill-date').value;
        const due_date = document.getElementById('bill-due-date').value;
        const notes = document.getElementById('bill-notes').value;

        if (!supplier_id) {
            window.App.showToast('Please select a supplier.', 'error');
            return;
        }

        const items = this.billRows.map(r => ({
            expense_account_id: r.accountId || null,
            description: r.description || 'Purchased Item',
            quantity: Number(r.qty) || 1,
            unit_price: Number(r.unitPrice) || 0,
            tax_rate_id: r.taxRateId || null
        }));

        try {
            const res = await window.API.post('/api/purchases/invoices', {
                supplier_id,
                bill_date,
                due_date,
                notes,
                items,
                auto_post: true
            });

            window.App.showToast(res.message || 'Vendor bill posted successfully!', 'success');
            document.getElementById('vendor-bill-modal').classList.remove('active');
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // Record Vendor Payment Modal
    async openPaymentModal(supplierId = null, billId = null, amountDue = null) {
        let modalEl = document.getElementById('purchases-payment-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'purchases-payment-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const bankData = await window.API.get('/api/banking/accounts');
        const banks = bankData.accounts || [];
        const today = new Date().toISOString().split('T')[0];

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">💳 Disburse Supplier Payment</div>
                    <button class="sap-modal-close" onclick="document.getElementById('purchases-payment-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-group">
                        <label class="sap-form-label">Vendor / Supplier *</label>
                        <select id="disb-supplier-id" class="sap-select">
                            <option value="">-- Select Supplier --</option>
                            ${this.suppliers.map(s => `
                                <option value="${s.id}" ${supplierId == s.id ? 'selected' : ''}>
                                    ${s.code} - ${s.name} (Payable: $${Number(s.outstanding_balance).toLocaleString()})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Disbursement Date *</label>
                            <input type="date" id="disb-date" class="sap-input" value="${today}">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Drawn from Bank *</label>
                            <select id="disb-bank-id" class="sap-select">
                                ${banks.map(b => `<option value="${b.id}">${b.bank_name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Amount ($) *</label>
                            <input type="number" step="0.01" min="0.01" id="disb-amount" class="sap-input" value="${amountDue || ''}">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Method</label>
                            <select id="disb-method" class="sap-select">
                                <option value="BANK_TRANSFER">Bank Wire / ACH</option>
                                <option value="CHEQUE">Corporate Cheque</option>
                                <option value="CREDIT_CARD">Corporate Card</option>
                            </select>
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Check / Transaction Ref #</label>
                        <input type="text" id="disb-ref" class="sap-input" placeholder="e.g. ACH-9901">
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('purchases-payment-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="PurchasesView.submitPayment(${billId || 'null'})">Post Disbursement</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitPayment(billId) {
        const supplier_id = document.getElementById('disb-supplier-id').value;
        const payment_date = document.getElementById('disb-date').value;
        const bank_account_id = document.getElementById('disb-bank-id').value;
        const amount = document.getElementById('disb-amount').value;
        const payment_method = document.getElementById('disb-method').value;
        const reference = document.getElementById('disb-ref').value;

        if (!supplier_id || !payment_date || !bank_account_id || !amount) {
            window.App.showToast('Please fill all required fields.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/purchases/payments', {
                supplier_id,
                invoice_id: billId,
                payment_date,
                bank_account_id,
                payment_method,
                amount: Number(amount),
                reference
            });

            window.App.showToast(res.message || 'Payment successfully posted!', 'success');
            document.getElementById('purchases-payment-modal').classList.remove('active');
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // New Supplier Modal
    openSupplierModal() {
        let modalEl = document.getElementById('new-supplier-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'new-supplier-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">Register New Vendor / Supplier</div>
                    <button class="sap-modal-close" onclick="document.getElementById('new-supplier-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-group">
                        <label class="sap-form-label">Supplier Legal Name *</label>
                        <input type="text" id="supp-name" class="sap-input" placeholder="e.g. Cisco Systems">
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Email</label>
                            <input type="email" id="supp-email" class="sap-input" placeholder="ap@vendor.com">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Phone</label>
                            <input type="text" id="supp-phone" class="sap-input" placeholder="+1 (555) 000-0000">
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Tax ID</label>
                            <input type="text" id="supp-tax" class="sap-input" placeholder="US-9999999">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Payment Terms (Days)</label>
                            <input type="number" id="supp-terms" class="sap-input" value="30">
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Address & City</label>
                        <input type="text" id="supp-address" class="sap-input" placeholder="Street & City">
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('new-supplier-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="PurchasesView.submitSupplier()">Save Supplier</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitSupplier() {
        const name = document.getElementById('supp-name').value;
        const email = document.getElementById('supp-email').value;
        const phone = document.getElementById('supp-phone').value;
        const tax_number = document.getElementById('supp-tax').value;
        const payment_terms = document.getElementById('supp-terms').value;
        const address = document.getElementById('supp-address').value;

        if (!name) {
            window.App.showToast('Supplier name is required.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/purchases/suppliers', { name, email, phone, tax_number, payment_terms, address });
            window.App.showToast(res.message || 'Supplier registered.', 'success');
            document.getElementById('new-supplier-modal').classList.remove('active');
            await this.loadDependencies();
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    async viewSupplierStatement(supplierId) {
        try {
            const data = await window.API.get(`/api/purchases/suppliers/${supplierId}/statement`);
            const s = data.supplier;
            const bills = data.bills || [];
            const payments = data.payments || [];

            let modalEl = document.getElementById('supplier-statement-modal');
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = 'supplier-statement-modal';
                modalEl.className = 'sap-modal-backdrop';
                document.body.appendChild(modalEl);
            }

            modalEl.innerHTML = `
                <div class="sap-modal modal-lg">
                    <div class="sap-modal-header">
                        <div class="sap-modal-title">Vendor Statement: ${s.name} (${s.code})</div>
                        <div style="display: flex; gap: 8px;">
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="window.print()">🖨️ Print</button>
                            <button class="sap-modal-close" onclick="document.getElementById('supplier-statement-modal').classList.remove('active')">×</button>
                        </div>
                    </div>
                    <div class="sap-modal-body">
                        <h4 style="margin-bottom: 8px;">Purchase Bills Owed</h4>
                        <table class="sap-table" style="margin-bottom: 20px;">
                            <thead>
                                <tr><th>Bill #</th><th>Date</th><th>Due</th><th class="text-right">Total ($)</th><th class="text-right">Balance Due ($)</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                ${bills.map(b => `
                                    <tr>
                                        <td class="font-mono">${b.bill_number}</td>
                                        <td>${b.bill_date}</td>
                                        <td>${b.due_date}</td>
                                        <td class="text-right font-mono">$${Number(b.total_amount).toLocaleString()}</td>
                                        <td class="text-right font-mono">$${Number(b.total_amount - b.paid_amount).toLocaleString()}</td>
                                        <td><span class="sap-badge sap-badge-posted">${b.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <h4 style="margin-bottom: 8px;">Disbursement History</h4>
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
                                        <td class="text-right font-mono" style="color: #e53935;">-$${Number(p.amount).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="sap-modal-footer">
                        <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('supplier-statement-modal').classList.remove('active')">Close</button>
                    </div>
                </div>
            `;
            modalEl.classList.add('active');
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    }
};

window.PurchasesView = PurchasesView;
