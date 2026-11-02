/**
 * Banking & Cash Management Module View
 * Handles Bank Accounts, Live Balances, Transactions, Internal Transfers & Bank Reconciliation
 */

const BankingView = {
    currentTab: 'accounts',
    accounts: [],

    async render(container, subTab = 'accounts') {
        this.currentTab = subTab;

        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Banking & Cash Management</h1>
                    <div class="sap-page-subtitle">Treasury, Liquid Cash Accounts, Inter-Bank Transfers & Statement Reconciliation</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="BankingView.openNewAccountModal()">
                        + Add Bank Account
                    </button>
                    <button class="sap-btn sap-btn-secondary" onclick="BankingView.openTransferModal()">
                        ⇄ Transfer Funds
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="BankingView.openReconciliationModal()">
                        ✓ Bank Reconciliation
                    </button>
                </div>
            </div>

            <div class="sap-tabs-bar">
                <div class="sap-tab-item ${this.currentTab === 'accounts' ? 'active' : ''}" onclick="BankingView.switchTab('accounts')">
                    Bank & Cash Accounts
                </div>
                <div class="sap-tab-item ${this.currentTab === 'transactions' ? 'active' : ''}" onclick="BankingView.switchTab('transactions')">
                    All Bank Transactions
                </div>
                <div class="sap-tab-item ${this.currentTab === 'reconciliations' ? 'active' : ''}" onclick="BankingView.switchTab('reconciliations')">
                    Reconciliation History
                </div>
            </div>

            <div class="sap-workspace-body" id="banking-tab-content">
                <!-- Content -->
            </div>
        `;

        await this.loadDependencies();
        await this.loadCurrentTab();
    },

    async loadDependencies() {
        try {
            const data = await window.API.get('/api/banking/accounts');
            this.accounts = data.accounts || [];
        } catch (e) {
            console.error('Failed to load banking accounts:', e);
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
        const content = document.getElementById('banking-tab-content');
        if (!content) return;

        if (this.currentTab === 'accounts') {
            await this.renderAccounts(content);
        } else if (this.currentTab === 'transactions') {
            await this.renderTransactions(content);
        } else if (this.currentTab === 'reconciliations') {
            await this.renderReconciliations(content);
        }
    },

    // 1. Bank Accounts View (Cards & Table)
    async renderAccounts(container) {
        const totalCash = this.accounts.reduce((acc, a) => acc + a.current_balance, 0);

        container.innerHTML = `
            <!-- Top Cash Summary Card -->
            <div style="background: linear-gradient(135deg, #1c2d42 0%, #152435 100%); color: #fff; padding: 20px 24px; border-radius: var(--radius-md); margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #8ec3ff; font-weight: 600;">Total Liquid Cash & Treasury Reserves</div>
                    <div style="font-size: 32px; font-weight: 800; font-family: var(--font-family); margin-top: 4px;">
                        $${Number(totalCash).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="sap-btn sap-btn-primary" onclick="BankingView.openTransferModal()">
                        ⇄ Internal Transfer
                    </button>
                    <button class="sap-btn sap-btn-secondary" style="background: rgba(255,255,255,0.15); color: #fff; border: none;" onclick="BankingView.openReconciliationModal()">
                        ✓ Reconcile Statement
                    </button>
                </div>
            </div>

            <!-- Individual Account Cards Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px;">
                ${this.accounts.map(acc => `
                    <div class="sap-card" style="margin-bottom: 0;">
                        <div class="sap-card-header">
                            <div>
                                <span class="font-mono" style="font-size: 11px; color: #64748b;">${acc.account_code}</span>
                                <div style="font-weight: 700; font-size: 14px; color: #1e293b;">${acc.bank_name}</div>
                            </div>
                            <span class="sap-badge sap-badge-posted">${acc.account_type}</span>
                        </div>
                        <div class="sap-card-body">
                            <div style="font-size: 11.5px; color: #64748b; margin-bottom: 4px;">Account Number: ${acc.account_number}</div>
                            <div style="font-size: 11.5px; color: #64748b; margin-bottom: 12px;">GL Code: ${acc.gl_account_code} - ${acc.gl_account_name}</div>
                            <div style="font-size: 22px; font-weight: 700; color: #0070f2; font-family: monospace;">
                                $${Number(acc.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div id="bank-accounts-table-container"></div>
        `;

        new EnterpriseTable({
            containerId: 'bank-accounts-table-container',
            title: 'Bank Accounts Ledger',
            exportName: 'Bank_Accounts',
            columns: [
                { key: 'account_code', label: 'Code', fontMono: true },
                { key: 'bank_name', label: 'Financial Institution' },
                { key: 'account_number', label: 'Account Identifier' },
                { key: 'account_type', label: 'Type' },
                { key: 'currency', label: 'Currency' },
                { 
                    key: 'opening_balance', 
                    label: 'Opening Balance', 
                    align: 'right', 
                    fontMono: true,
                    render: (r) => `$${Number(r.opening_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                },
                { 
                    key: 'current_balance', 
                    label: 'Current Book Balance', 
                    align: 'right', 
                    fontMono: true,
                    render: (r) => `<strong>$${Number(r.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
                }
            ],
            data: this.accounts
        });
    },

    // 2. All Bank Transactions Tab
    async renderTransactions(container) {
        container.innerHTML = `<div id="bank-tx-table-container">Loading Transactions...</div>`;
        try {
            const data = await window.API.get('/api/banking/transactions');
            new EnterpriseTable({
                containerId: 'bank-tx-table-container',
                title: 'Cash & Bank Transactions Ledger',
                searchPlaceholder: 'Search description, reference...',
                exportName: 'Bank_Transactions',
                columns: [
                    { key: 'transaction_date', label: 'Date' },
                    { key: 'bank_name', label: 'Bank Account' },
                    { 
                        key: 'type', 
                        label: 'Type',
                        render: (r) => {
                            const isPositive = ['DEPOSIT', 'TRANSFER_IN'].includes(r.type);
                            return `<span style="font-weight: 600; color: ${isPositive ? '#10b981' : '#e53935'};">${r.type}</span>`;
                        }
                    },
                    { key: 'description', label: 'Description' },
                    { key: 'reference', label: 'Reference' },
                    { 
                        key: 'amount', 
                        label: 'Amount ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => {
                            const isPositive = ['DEPOSIT', 'TRANSFER_IN'].includes(r.type);
                            return `<strong style="color: ${isPositive ? '#10b981' : '#e53935'};">${isPositive ? '+' : '-'}$${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`;
                        }
                    },
                    { 
                        key: 'is_reconciled', 
                        label: 'Reconciled', 
                        align: 'center',
                        render: (r) => r.is_reconciled ? `<span class="sap-badge sap-badge-posted">✓ Cleared</span>` : `<span class="sap-badge sap-badge-draft">Uncleared</span>`
                    },
                    { key: 'journal_entry_number', label: 'GL Journal Voucher', fontMono: true }
                ],
                data: data.transactions || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 3. Reconciliations History
    async renderReconciliations(container) {
        container.innerHTML = `<div id="rec-table-container">Loading Reconciliations...</div>`;
        try {
            const data = await window.API.get('/api/banking/reconciliations');
            new EnterpriseTable({
                containerId: 'rec-table-container',
                title: 'Bank Reconciliation Statements',
                exportName: 'Bank_Reconciliations',
                columns: [
                    { key: 'statement_date', label: 'Statement Date' },
                    { key: 'bank_name', label: 'Bank Account' },
                    { 
                        key: 'statement_balance', 
                        label: 'Statement Balance ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.statement_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'book_balance', 
                        label: 'GL Book Balance ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.book_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'difference', 
                        label: 'Variance / Difference', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong style="color: ${Math.abs(r.difference) < 0.01 ? '#10b981' : '#e53935'};">$${Number(r.difference).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
                    },
                    { 
                        key: 'status', 
                        label: 'Status', 
                        align: 'center', 
                        render: (r) => `<span class="sap-badge sap-badge-posted">${r.status}</span>` 
                    },
                    { key: 'completed_at', label: 'Completed At' }
                ],
                data: data.reconciliations || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // Inter-Account Bank Transfer Modal
    openTransferModal() {
        let modalEl = document.getElementById('bank-transfer-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'bank-transfer-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const today = new Date().toISOString().split('T')[0];

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">⇄ Inter-Account Bank Transfer</div>
                    <button class="sap-modal-close" onclick="document.getElementById('bank-transfer-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-group">
                        <label class="sap-form-label">Transfer Date *</label>
                        <input type="date" id="trf-date" class="sap-input" value="${today}">
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">From Bank Account (Source) *</label>
                            <select id="trf-from" class="sap-select">
                                ${this.accounts.map(a => `<option value="${a.id}">${a.bank_name} ($${Number(a.current_balance).toLocaleString()})</option>`).join('')}
                            </select>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">To Bank Account (Destination) *</label>
                            <select id="trf-to" class="sap-select">
                                ${this.accounts.slice().reverse().map(a => `<option value="${a.id}">${a.bank_name} ($${Number(a.current_balance).toLocaleString()})</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Transfer Amount ($) *</label>
                            <input type="number" step="0.01" min="1" id="trf-amount" class="sap-input" placeholder="0.00">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Transfer Reference</label>
                            <input type="text" id="trf-ref" class="sap-input" placeholder="e.g. TRF-OPERATING-PAYROLL">
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Notes / Purpose</label>
                        <input type="text" id="trf-notes" class="sap-input" placeholder="e.g. Payroll funding transfer">
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('bank-transfer-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="BankingView.submitTransfer()">Post Transfer to Ledger</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitTransfer() {
        const from_account_id = document.getElementById('trf-from').value;
        const to_account_id = document.getElementById('trf-to').value;
        const transfer_date = document.getElementById('trf-date').value;
        const amount = document.getElementById('trf-amount').value;
        const reference = document.getElementById('trf-ref').value;
        const notes = document.getElementById('trf-notes').value;

        if (!from_account_id || !to_account_id || !amount || Number(amount) <= 0) {
            window.App.showToast('Please specify source, destination and a positive amount.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/banking/transfers', {
                from_account_id,
                to_account_id,
                transfer_date,
                amount: Number(amount),
                reference,
                notes
            });

            window.App.showToast(res.message, 'success');
            document.getElementById('bank-transfer-modal').classList.remove('active');
            await this.loadDependencies();
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // Bank Reconciliation Modal
    async openReconciliationModal() {
        let modalEl = document.getElementById('bank-rec-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'bank-rec-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const today = new Date().toISOString().split('T')[0];

        // Fetch uncleared transactions
        const txData = await window.API.get('/api/banking/transactions?is_reconciled=0');
        const uncleared = txData.transactions || [];

        modalEl.innerHTML = `
            <div class="sap-modal modal-lg">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">✓ Perform Bank Statement Reconciliation</div>
                    <button class="sap-modal-close" onclick="document.getElementById('bank-rec-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Bank Account to Reconcile *</label>
                            <select id="rec-bank-id" class="sap-select">
                                ${this.accounts.map(a => `<option value="${a.id}">${a.bank_name} (Book Bal: $${Number(a.current_balance).toLocaleString()})</option>`).join('')}
                            </select>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Statement Cut-Off Date *</label>
                            <input type="date" id="rec-stmt-date" class="sap-input" value="${today}">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Bank Statement Ending Balance ($) *</label>
                            <input type="number" step="0.01" id="rec-stmt-bal" class="sap-input" placeholder="0.00" oninput="BankingView.updateRecVariance()">
                        </div>
                    </div>

                    <div style="background: #f8fafc; padding: 10px 14px; border-radius: 6px; margin: 12px 0; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; font-size: 12.5px;">Select Cleared Transactions from Bank Statement:</span>
                        <div id="rec-diff-badge" class="sap-balance-indicator sap-balance-unbalanced">
                            Variance: $0.00
                        </div>
                    </div>

                    <div class="sap-table-wrapper" style="max-height: 250px; overflow-y: auto;">
                        <table class="sap-table">
                            <thead>
                                <tr>
                                    <th style="width: 5%;">Clear</th>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th>Ref</th>
                                    <th class="text-right">Amount ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${uncleared.map(t => `
                                    <tr>
                                        <td>
                                            <input type="checkbox" class="rec-clear-check" value="${t.id}" data-amount="${t.type.includes('DEPOSIT') || t.type.includes('IN') ? t.amount : -t.amount}" onchange="BankingView.updateRecVariance()">
                                        </td>
                                        <td>${t.transaction_date}</td>
                                        <td>${t.type}</td>
                                        <td>${t.description}</td>
                                        <td>${t.reference || '-'}</td>
                                        <td class="text-right font-mono">$${Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('bank-rec-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="BankingView.submitReconciliation()">Finalize & Lock Reconciliation</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
        this.updateRecVariance();
    },

    updateRecVariance() {
        const bankSelect = document.getElementById('rec-bank-id');
        const stmtBalInput = document.getElementById('rec-stmt-bal');
        const badge = document.getElementById('rec-diff-badge');

        if (!bankSelect || !stmtBalInput || !badge) return;

        const acc = this.accounts.find(a => a.id == bankSelect.value);
        const bookBal = acc ? acc.current_balance : 0;
        const stmtBal = Number(stmtBalInput.value) || bookBal;

        const diff = Math.abs(stmtBal - bookBal);
        if (diff < 0.01) {
            badge.className = 'sap-balance-indicator sap-balance-balanced';
            badge.textContent = '✓ Zero Variance (In Balance)';
        } else {
            badge.className = 'sap-balance-indicator sap-balance-unbalanced';
            badge.textContent = `Variance Difference: $${diff.toFixed(2)}`;
        }
    },

    async submitReconciliation() {
        const bank_account_id = document.getElementById('rec-bank-id').value;
        const statement_date = document.getElementById('rec-stmt-date').value;
        const stmtBal = document.getElementById('rec-stmt-bal').value;

        if (!statement_date) {
            window.App.showToast('Please select statement date.', 'error');
            return;
        }

        const cleared_transaction_ids = Array.from(document.querySelectorAll('.rec-clear-check:checked')).map(el => Number(el.value));
        const acc = this.accounts.find(a => a.id == bank_account_id);
        const statement_balance = stmtBal ? Number(stmtBal) : (acc ? acc.current_balance : 0);

        try {
            const res = await window.API.post('/api/banking/reconciliations', {
                bank_account_id,
                statement_date,
                statement_balance,
                cleared_transaction_ids,
                notes: 'Monthly enterprise bank statement audit check'
            });

            window.App.showToast(res.message, 'success');
            document.getElementById('bank-rec-modal').classList.remove('active');
            await this.loadDependencies();
            this.switchTab('reconciliations');
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // New Bank Account Modal
    openNewAccountModal() {
        let modalEl = document.getElementById('new-bank-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'new-bank-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">Add Bank Account / Cash Vault</div>
                    <button class="sap-modal-close" onclick="document.getElementById('new-bank-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-group">
                        <label class="sap-form-label">Bank Name *</label>
                        <input type="text" id="bank-name-in" class="sap-input" placeholder="e.g. Bank of America, N.A.">
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Account Number *</label>
                            <input type="text" id="bank-num-in" class="sap-input" placeholder="•••• 5821">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Account Type</label>
                            <select id="bank-type-in" class="sap-select">
                                <option value="CHECKING">CHECKING</option>
                                <option value="SAVINGS">SAVINGS</option>
                                <option value="CASH">CASH VAULT</option>
                            </select>
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Initial Opening Balance ($)</label>
                            <input type="number" step="0.01" id="bank-open-in" class="sap-input" value="0.00">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Currency</label>
                            <input type="text" id="bank-cur-in" class="sap-input" value="USD" readonly>
                        </div>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('new-bank-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="BankingView.submitNewAccount()">Save Account</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitNewAccount() {
        const bank_name = document.getElementById('bank-name-in').value;
        const account_number = document.getElementById('bank-num-in').value;
        const account_type = document.getElementById('bank-type-in').value;
        const opening_balance = Number(document.getElementById('bank-open-in').value) || 0;

        if (!bank_name || !account_number) {
            window.App.showToast('Bank name and account number are required.', 'error');
            return;
        }

        // Auto link with GL 10200 or first Cash & Bank account
        const chaseAcc = this.accounts[0];
        const gl_account_id = chaseAcc ? chaseAcc.gl_account_id : 2;

        try {
            const res = await window.API.post('/api/banking/accounts', {
                bank_name,
                account_number,
                account_type,
                gl_account_id,
                opening_balance
            });

            window.App.showToast(res.message, 'success');
            document.getElementById('new-bank-modal').classList.remove('active');
            await this.loadDependencies();
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    }
};

window.BankingView = BankingView;
