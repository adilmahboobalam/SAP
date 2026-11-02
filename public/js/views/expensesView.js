/**
 * Expense Management Module View
 * Handles recording business expenses, approval workflows, receipt uploads, department allocation & ledger auto-post
 */

const ExpensesView = {
    categories: [],
    bankAccounts: [],
    taxRates: [],

    async render(container) {
        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Expense Management & Approvals</h1>
                    <div class="sap-page-subtitle">Corporate Spend Tracking, Receipt Auditing & Department Cost Allocation</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-primary" onclick="ExpensesView.openExpenseModal()">
                        + Record Expense
                    </button>
                </div>
            </div>

            <div class="sap-workspace-body">
                <div id="expenses-table-container">Loading Expenses...</div>
            </div>
        `;

        await this.loadDependencies();
        await this.renderTable();
    },

    async loadDependencies() {
        try {
            const [catData, bankData, taxData] = await Promise.all([
                window.API.get('/api/expenses/categories'),
                window.API.get('/api/banking/accounts'),
                window.API.get('/api/tax/rates')
            ]);
            this.categories = catData.categories || [];
            this.bankAccounts = bankData.accounts || [];
            this.taxRates = taxData.taxRates || [];
        } catch (e) {
            console.error('Failed to load expense dependencies:', e);
        }
    },

    async renderTable() {
        try {
            const data = await window.API.get('/api/expenses');
            new EnterpriseTable({
                containerId: 'expenses-table-container',
                title: 'Corporate Expenses Register',
                searchPlaceholder: 'Search expense #, vendor, description...',
                exportName: 'Expenses_Register',
                columns: [
                    { key: 'expense_number', label: 'Expense #', fontMono: true },
                    { key: 'expense_date', label: 'Date' },
                    { key: 'category_name', label: 'Category' },
                    { key: 'department', label: 'Department' },
                    { key: 'vendor_name', label: 'Vendor / Merchant' },
                    { key: 'description', label: 'Description' },
                    { 
                        key: 'total_amount', 
                        label: 'Total Amount ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    {
                        key: 'receipt_path',
                        label: 'Receipt',
                        align: 'center',
                        render: (r) => r.receipt_path ? `<a href="${r.receipt_path}" target="_blank" style="color: #0070f2; font-weight: 600;">📎 View</a>` : `<span style="color:#94a3b8;">None</span>`
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        align: 'center',
                        render: (r) => {
                            const badgeMap = {
                                'DRAFT': 'sap-badge-draft',
                                'SUBMITTED': 'sap-badge-submitted',
                                'APPROVED': 'sap-badge-submitted',
                                'POSTED': 'sap-badge-posted',
                                'REJECTED': 'sap-badge-overdue'
                            };
                            return `<span class="sap-badge ${badgeMap[r.status] || 'sap-badge-draft'}">${r.status}</span>`;
                        }
                    },
                    {
                        key: 'actions',
                        label: 'Actions',
                        sortable: false,
                        render: (r) => `
                            <div style="display: flex; gap: 4px; justify-content: flex-end;">
                                ${r.status === 'SUBMITTED' ? `
                                    <button class="sap-btn sap-btn-primary sap-btn-sm" onclick="ExpensesView.approveExpense(${r.id})">
                                        Approve & Post
                                    </button>
                                ` : ''}
                                ${r.journal_entry_id ? `
                                    <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="GeneralLedgerView.viewJournalDetail(${r.journal_entry_id})">
                                        Voucher
                                    </button>
                                ` : ''}
                            </div>
                        `
                    }
                ],
                data: data.expenses || []
            });
        } catch (err) {
            document.getElementById('expenses-table-container').innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    openExpenseModal() {
        let modalEl = document.getElementById('expense-entry-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'expense-entry-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const today = new Date().toISOString().split('T')[0];

        modalEl.innerHTML = `
            <div class="sap-modal modal-lg">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">🧾 Record Business Expense</div>
                    <button class="sap-modal-close" onclick="document.getElementById('expense-entry-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Expense Category *</label>
                            <select id="exp-cat-id" class="sap-select">
                                <option value="">-- Select Category --</option>
                                ${this.categories.map(c => `<option value="${c.id}">${c.name} (${c.gl_account_code})</option>`).join('')}
                            </select>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Department *</label>
                            <select id="exp-dept" class="sap-select">
                                <option value="Administration">Administration</option>
                                <option value="Sales">Enterprise Sales</option>
                                <option value="R&D">Software Engineering / R&D</option>
                                <option value="Operations">Operations</option>
                                <option value="Finance">Finance & Accounting</option>
                                <option value="Marketing">Marketing</option>
                            </select>
                        </div>
                    </div>

                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Vendor / Merchant *</label>
                            <input type="text" id="exp-vendor" class="sap-input" placeholder="e.g. Delta Air Lines / Microsoft 365">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Date *</label>
                            <input type="date" id="exp-date" class="sap-input" value="${today}">
                        </div>
                    </div>

                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Net Amount ($) *</label>
                            <input type="number" step="0.01" min="0.01" id="exp-net-amount" class="sap-input" placeholder="0.00" oninput="ExpensesView.calcTotal()">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Input Tax Rate</label>
                            <select id="exp-tax-id" class="sap-select" onchange="ExpensesView.calcTotal()">
                                <option value="">No Tax (0%)</option>
                                ${this.taxRates.map(t => `<option value="${t.id}">${t.name} (${t.rate}%)</option>`).join('')}
                            </select>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Paid From Bank Account *</label>
                            <select id="exp-bank-id" class="sap-select">
                                ${this.bankAccounts.map(b => `<option value="${b.id}">${b.bank_name}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="sap-form-group">
                        <label class="sap-form-label">Expense Description / Business Purpose *</label>
                        <input type="text" id="exp-description" class="sap-input" placeholder="e.g. Quarterly SaaS subscription licensing">
                    </div>

                    <div class="sap-form-group">
                        <label class="sap-form-label">Upload Receipt / Invoice Attachment</label>
                        <input type="file" id="exp-receipt-file" class="sap-input" accept="image/*,application/pdf">
                    </div>

                    <div style="background: #f8fafc; padding: 10px 14px; border-radius: 6px; display: flex; justify-content: flex-end; font-size: 14px;">
                        <span>Total Payable: <strong id="exp-total-disp" style="color: #0070f2; font-family: monospace;">$0.00</strong></span>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('expense-entry-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="ExpensesView.submitExpense()">Save & Post Expense</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
        this.calcTotal();
    },

    calcTotal() {
        const net = Number(document.getElementById('exp-net-amount')?.value) || 0;
        const taxSelect = document.getElementById('exp-tax-id');
        let tax = 0;
        if (taxSelect && taxSelect.value) {
            const tr = this.taxRates.find(t => t.id == taxSelect.value);
            if (tr) tax = Math.round((net * (tr.rate / 100)) * 100) / 100;
        }
        const total = net + tax;
        const disp = document.getElementById('exp-total-disp');
        if (disp) disp.textContent = `$${total.toFixed(2)}`;
    },

    async submitExpense() {
        const category_id = document.getElementById('exp-cat-id').value;
        const department = document.getElementById('exp-dept').value;
        const vendor_name = document.getElementById('exp-vendor').value;
        const expense_date = document.getElementById('exp-date').value;
        const amount = document.getElementById('exp-net-amount').value;
        const tax_rate_id = document.getElementById('exp-tax-id').value;
        const payment_account_id = document.getElementById('exp-bank-id').value;
        const description = document.getElementById('exp-description').value;
        const fileInput = document.getElementById('exp-receipt-file');

        if (!category_id || !expense_date || !amount || !payment_account_id || !description) {
            window.App.showToast('Please fill all required fields.', 'error');
            return;
        }

        let receipt_path = null;
        if (fileInput && fileInput.files && fileInput.files[0]) {
            try {
                const uploadRes = await window.API.uploadReceipt(fileInput.files[0]);
                receipt_path = uploadRes.path;
            } catch (err) {
                console.warn('Receipt upload failed, continuing without file:', err);
            }
        }

        try {
            const res = await window.API.post('/api/expenses', {
                category_id,
                department,
                vendor_name,
                expense_date,
                amount: Number(amount),
                tax_rate_id: tax_rate_id || null,
                payment_account_id,
                description,
                receipt_path,
                auto_post: true
            });

            window.App.showToast(res.message, 'success');
            document.getElementById('expense-entry-modal').classList.remove('active');
            this.renderTable();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    async approveExpense(expenseId) {
        try {
            const res = await window.API.post(`/api/expenses/${expenseId}/approve`, {});
            window.App.showToast(res.message, 'success');
            this.renderTable();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    }
};

window.ExpensesView = ExpensesView;
