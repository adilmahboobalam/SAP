/**
 * Financial Accounting & General Ledger View
 * Covers Chart of Accounts, Double-Entry Journal Entries, Ledger Account Statements, and Trial Balance
 */

const GeneralLedgerView = {
    currentTab: 'coa',
    accounts: [],

    async render(container, subTab = 'coa') {
        this.currentTab = subTab;

        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Financial Accounting & General Ledger</h1>
                    <div class="sap-page-subtitle">Chart of Accounts, Journal Entries, Ledger Auditability & Trial Balance</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="GeneralLedgerView.openNewAccountModal()">
                        + New GL Account
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="JournalModal.open({ onSuccess: () => GeneralLedgerView.loadCurrentTab() })">
                        + Post Journal Entry
                    </button>
                </div>
            </div>

            <!-- Sub Navigation Tabs -->
            <div class="sap-tabs-bar">
                <div class="sap-tab-item ${this.currentTab === 'coa' ? 'active' : ''}" onclick="GeneralLedgerView.switchTab('coa')">
                    Chart of Accounts
                </div>
                <div class="sap-tab-item ${this.currentTab === 'journals' ? 'active' : ''}" onclick="GeneralLedgerView.switchTab('journals')">
                    Journal Entries (General Journal)
                </div>
                <div class="sap-tab-item ${this.currentTab === 'account-ledger' ? 'active' : ''}" onclick="GeneralLedgerView.switchTab('account-ledger')">
                    Account Ledger Drilldown
                </div>
                <div class="sap-tab-item ${this.currentTab === 'trial-balance' ? 'active' : ''}" onclick="GeneralLedgerView.switchTab('trial-balance')">
                    Trial Balance
                </div>
            </div>

            <div class="sap-workspace-body" id="gl-tab-content">
                <!-- Tab body rendered dynamically -->
            </div>
        `;

        await this.loadCurrentTab();
    },

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.sap-tab-item').forEach(el => {
            el.classList.toggle('active', el.textContent.toLowerCase().includes(tab.replace('-', ' ')));
        });
        this.loadCurrentTab();
    },

    async loadCurrentTab() {
        const content = document.getElementById('gl-tab-content');
        if (!content) return;

        if (this.currentTab === 'coa') {
            await this.renderCOA(content);
        } else if (this.currentTab === 'journals') {
            await this.renderJournals(content);
        } else if (this.currentTab === 'account-ledger') {
            await this.renderAccountLedger(content);
        } else if (this.currentTab === 'trial-balance') {
            await this.renderTrialBalance(content);
        }
    },

    // 1. Chart of Accounts Tab
    async renderCOA(container) {
        container.innerHTML = `<div id="coa-table-container">Loading Chart of Accounts...</div>`;
        try {
            const data = await window.API.get('/api/gl/accounts');
            this.accounts = data.accounts || [];

            new EnterpriseTable({
                containerId: 'coa-table-container',
                title: 'Chart of Accounts (COA Hierarchy)',
                searchPlaceholder: 'Search by code or account name...',
                exportName: 'Chart_of_Accounts',
                columns: [
                    { key: 'code', label: 'Account Code', fontMono: true },
                    { key: 'name', label: 'Account Name' },
                    { 
                        key: 'type', 
                        label: 'Classification',
                        render: (r) => {
                            const colors = {
                                'ASSET': '#0070f2',
                                'LIABILITY': '#d97706',
                                'EQUITY': '#7c3aed',
                                'REVENUE': '#059669',
                                'EXPENSE': '#dc2626'
                            };
                            return `<span style="font-weight: 700; color: ${colors[r.type] || '#333'};">${r.type}</span>`;
                        }
                    },
                    { key: 'sub_category', label: 'Financial Sub-Category' },
                    { key: 'currency', label: 'Currency' },
                    { 
                        key: 'balance', 
                        label: 'Net Balance', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    {
                        key: 'actions',
                        label: 'Actions',
                        sortable: false,
                        render: (r) => `
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="GeneralLedgerView.viewAccountHistory(${r.id})">
                                Drilldown
                            </button>
                        `
                    }
                ],
                data: this.accounts
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 2. Journal Entries Tab
    async renderJournals(container) {
        container.innerHTML = `<div id="journals-table-container">Loading Journal Entries...</div>`;
        try {
            const data = await window.API.get('/api/gl/journals?limit=100');
            const entries = data.entries || [];

            new EnterpriseTable({
                containerId: 'journals-table-container',
                title: 'General Journal Entries (Double-Entry Ledger)',
                searchPlaceholder: 'Search entry #, reference, description...',
                exportName: 'Journal_Entries',
                columns: [
                    { key: 'entry_number', label: 'Voucher / Entry #', fontMono: true },
                    { key: 'posting_date', label: 'Posting Date' },
                    { key: 'reference', label: 'Reference' },
                    { key: 'description', label: 'Description / Memo' },
                    { 
                        key: 'source_module', 
                        label: 'Module',
                        render: (r) => `<span style="font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;">${r.source_module}</span>`
                    },
                    { 
                        key: 'total_debit', 
                        label: 'Total Amount', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    {
                        key: 'status',
                        label: 'Status',
                        align: 'center',
                        render: (r) => `
                            <span class="sap-badge ${r.is_reversed ? 'sap-badge-reversed' : 'sap-badge-posted'}">
                                ${r.is_reversed ? 'REVERSED' : 'POSTED'}
                            </span>
                        `
                    },
                    {
                        key: 'actions',
                        label: 'Actions',
                        sortable: false,
                        render: (r) => `
                            <div style="display: flex; gap: 4px; justify-content: flex-end;">
                                <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="GeneralLedgerView.viewJournalDetail(${r.id})">
                                    Lines
                                </button>
                                ${!r.is_reversed && r.status === 'POSTED' ? `
                                    <button class="sap-btn sap-btn-danger sap-btn-sm" onclick="GeneralLedgerView.reverseJournal(${r.id}, '${r.entry_number}')" title="Compensating Reversal">
                                        Reverse
                                    </button>
                                ` : ''}
                            </div>
                        `
                    }
                ],
                data: entries
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 3. Account Ledger Drilldown Tab
    async renderAccountLedger(container) {
        if (!this.accounts.length) {
            const data = await window.API.get('/api/gl/accounts');
            this.accounts = data.accounts || [];
        }

        container.innerHTML = `
            <div class="sap-card" style="margin-bottom: 16px;">
                <div class="sap-card-body" style="padding: 14px 18px; display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap;">
                    <div style="flex: 2; min-width: 250px;">
                        <label class="sap-form-label">Select Account for Detailed Ledger History</label>
                        <select id="ledger-account-select" class="sap-select">
                            ${this.accounts.map(a => `<option value="${a.id}">${a.code} - ${a.name} (${a.type})</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label class="sap-form-label">Start Date</label>
                        <input type="date" id="ledger-start-date" class="sap-input" value="2026-01-01">
                    </div>
                    <div style="flex: 1; min-width: 150px;">
                        <label class="sap-form-label">End Date</label>
                        <input type="date" id="ledger-end-date" class="sap-input" value="2026-12-31">
                    </div>
                    <button class="sap-btn sap-btn-primary" onclick="GeneralLedgerView.fetchAccountLedger()">
                        Generate Ledger History
                    </button>
                </div>
            </div>

            <div id="account-ledger-result"></div>
        `;

        await this.fetchAccountLedger();
    },

    async fetchAccountLedger() {
        const select = document.getElementById('ledger-account-select');
        const startDate = document.getElementById('ledger-start-date').value;
        const endDate = document.getElementById('ledger-end-date').value;
        const resultContainer = document.getElementById('account-ledger-result');

        if (!select || !resultContainer) return;

        resultContainer.innerHTML = 'Loading account ledger entries...';

        try {
            const data = await window.API.get(`/api/reports/general-ledger?accountId=${select.value}&startDate=${startDate}&endDate=${endDate}`);
            const report = data.report && data.report[0];

            if (!report || !report.transactions.length) {
                resultContainer.innerHTML = `
                    <div class="sap-card" style="padding: 40px; text-align: center; color: var(--sap-text-muted);">
                        No ledger transactions found for this account in the specified period.
                    </div>
                `;
                return;
            }

            resultContainer.innerHTML = `
                <div class="sap-card">
                    <div class="sap-card-header">
                        <div>
                            <span class="sap-card-title">${report.code} - ${report.name}</span>
                            <span style="font-size: 11px; color: #64748b;">Classification: ${report.type}</span>
                        </div>
                        <div class="font-mono" style="font-size: 14px; font-weight: 700; color: #0070f2;">
                            Ending Running Balance: $${Number(report.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div class="sap-table-wrapper">
                        <table class="sap-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Journal #</th>
                                    <th>Reference</th>
                                    <th>Source Module</th>
                                    <th>Transaction Description</th>
                                    <th class="text-right">Debit ($)</th>
                                    <th class="text-right">Credit ($)</th>
                                    <th class="text-right">Running Balance ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${report.transactions.map(tx => `
                                    <tr>
                                        <td>${tx.date}</td>
                                        <td class="font-mono"><strong>${tx.entryNumber}</strong></td>
                                        <td>${tx.reference || '-'}</td>
                                        <td><span style="font-size: 10px; background: #e2e8f0; padding: 2px 4px; border-radius: 3px;">${tx.sourceModule}</span></td>
                                        <td>${tx.description || '-'}</td>
                                        <td class="text-right font-mono">${tx.debit > 0 ? `$${Number(tx.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                        <td class="text-right font-mono">${tx.credit > 0 ? `$${Number(tx.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                        <td class="text-right font-mono" style="font-weight: 700; color: #0f172a;">$${Number(tx.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (err) {
            resultContainer.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 4. Trial Balance Tab
    async renderTrialBalance(container) {
        container.innerHTML = `
            <div class="sap-card" style="margin-bottom: 16px;">
                <div class="sap-card-body" style="padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: 600;">As of Date:</span>
                        <input type="date" id="tb-as-of-date" class="sap-input" style="width: 150px;" value="${new Date().toISOString().split('T')[0]}" onchange="GeneralLedgerView.renderTrialBalance(document.getElementById('gl-tab-content'))">
                    </div>
                    <div>
                        <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="window.print()">🖨️ Print Statement</button>
                    </div>
                </div>
            </div>
            <div id="trial-balance-sheet"></div>
        `;

        const sheet = document.getElementById('trial-balance-sheet');
        try {
            const asOfDate = document.getElementById('tb-as-of-date').value;
            const res = await window.API.get(`/api/gl/trial-balance?asOfDate=${asOfDate}`);
            const tb = res.trialBalance;

            sheet.innerHTML = `
                <div class="sap-report-container">
                    <div class="sap-report-header">
                        <div class="sap-report-company">Apex Enterprise Solutions Corp.</div>
                        <div class="sap-report-title">General Ledger Trial Balance</div>
                        <div class="sap-report-period">As of ${tb.asOfDate} • Verified Double-Entry Ledger</div>
                    </div>

                    <div style="display: flex; justify-content: center; margin-bottom: 16px;">
                        <span class="sap-badge ${tb.isBalanced ? 'sap-badge-posted' : 'sap-badge-overdue'}" style="font-size: 13px; padding: 6px 14px;">
                            ${tb.isBalanced ? '✓ TRIAL BALANCE IS BALANCED: DEBITS EQUAL CREDITS' : '⚠️ WARNING: TRIAL BALANCE IS OUT OF BALANCE'}
                        </span>
                    </div>

                    <table class="sap-table" style="margin-top: 10px;">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Account Name</th>
                                <th>Classification</th>
                                <th class="text-right">Debit ($)</th>
                                <th class="text-right">Credit ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tb.accounts.map(a => `
                                <tr>
                                    <td class="font-mono"><strong>${a.code}</strong></td>
                                    <td>${a.name}</td>
                                    <td style="color: #64748b;">${a.subCategory}</td>
                                    <td class="text-right font-mono">${a.debit > 0 ? `$${Number(a.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                    <td class="text-right font-mono">${a.credit > 0 ? `$${Number(a.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f1f5f9; font-weight: 800; font-size: 13.5px; border-top: 2px solid #0f172a; border-bottom: 3px double #0f172a;">
                                <td colspan="3" class="text-right">TRIAL BALANCE TOTALS</td>
                                <td class="text-right font-mono" style="color: #0070f2;">$${Number(tb.totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td class="text-right font-mono" style="color: #0070f2;">$${Number(tb.totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        } catch (err) {
            sheet.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    viewAccountHistory(accountId) {
        this.switchTab('account-ledger');
        setTimeout(() => {
            const select = document.getElementById('ledger-account-select');
            if (select) {
                select.value = accountId;
                this.fetchAccountLedger();
            }
        }, 100);
    },

    // Journal Entry Detail Modal
    async viewJournalDetail(entryId) {
        try {
            const data = await window.API.get(`/api/gl/journals/${entryId}`);
            const je = data.entry;

            let modalEl = document.getElementById('journal-detail-modal');
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = 'journal-detail-modal';
                modalEl.className = 'sap-modal-backdrop';
                document.body.appendChild(modalEl);
            }

            modalEl.innerHTML = `
                <div class="sap-modal modal-lg">
                    <div class="sap-modal-header">
                        <div class="sap-modal-title">📖 Journal Entry Voucher: ${je.entry_number}</div>
                        <button class="sap-modal-close" onclick="document.getElementById('journal-detail-modal').classList.remove('active')">×</button>
                    </div>
                    <div class="sap-modal-body">
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 6px;">
                            <div><strong>Posting Date:</strong> ${je.posting_date}</div>
                            <div><strong>Reference:</strong> ${je.reference || '-'}</div>
                            <div><strong>Source Module:</strong> ${je.source_module}</div>
                            <div style="grid-column: span 2;"><strong>Description:</strong> ${je.description}</div>
                            <div><strong>Status:</strong> <span class="sap-badge ${je.is_reversed ? 'sap-badge-reversed' : 'sap-badge-posted'}">${je.is_reversed ? 'REVERSED' : 'POSTED'}</span></div>
                        </div>

                        <table class="sap-table">
                            <thead>
                                <tr>
                                    <th>GL Code</th>
                                    <th>Account Name</th>
                                    <th>Line Memo</th>
                                    <th class="text-right">Debit ($)</th>
                                    <th class="text-right">Credit ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${je.items.map(i => `
                                    <tr>
                                        <td class="font-mono">${i.account_code}</td>
                                        <td><strong>${i.account_name}</strong></td>
                                        <td>${i.description || '-'}</td>
                                        <td class="text-right font-mono">${i.debit > 0 ? `$${Number(i.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                        <td class="text-right font-mono">${i.credit > 0 ? `$${Number(i.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr style="background: #f1f5f9; font-weight: 700;">
                                    <td colspan="3" class="text-right">Total:</td>
                                    <td class="text-right font-mono">$${Number(je.total_debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    <td class="text-right font-mono">$${Number(je.total_credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <div class="sap-modal-footer">
                        <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('journal-detail-modal').classList.remove('active')">Close</button>
                    </div>
                </div>
            `;
            modalEl.classList.add('active');
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // Reverse Journal Entry
    async reverseJournal(entryId, entryNumber) {
        const reason = prompt(`Confirm Reversal for ${entryNumber}:\nEnter audit reason for this reversing entry (e.g. Accrual reversal, Posting error):`);
        if (!reason) return;

        try {
            const res = await window.API.post(`/api/gl/journals/${entryId}/reverse`, { reason });
            window.App.showToast(res.message, 'success');
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // Add New GL Account Modal
    openNewAccountModal() {
        let modalEl = document.getElementById('new-account-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'new-account-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">Create General Ledger Account</div>
                    <button class="sap-modal-close" onclick="document.getElementById('new-account-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Account Code * (e.g. 10400)</label>
                            <input type="text" id="acc-code" class="sap-input" placeholder="5-digit code">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Classification *</label>
                            <select id="acc-type" class="sap-select">
                                <option value="ASSET">ASSET</option>
                                <option value="LIABILITY">LIABILITY</option>
                                <option value="EQUITY">EQUITY</option>
                                <option value="REVENUE">REVENUE</option>
                                <option value="EXPENSE">EXPENSE</option>
                            </select>
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Account Name *</label>
                        <input type="text" id="acc-name" class="sap-input" placeholder="e.g. Security Deposit Escrow">
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Sub-Category *</label>
                        <input type="text" id="acc-subcategory" class="sap-input" placeholder="e.g. Current Assets / Operating Expense">
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Description</label>
                        <textarea id="acc-desc" class="sap-textarea" placeholder="Purpose and accounting usage"></textarea>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('new-account-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="GeneralLedgerView.submitNewAccount()">Save Account</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitNewAccount() {
        const code = document.getElementById('acc-code').value;
        const name = document.getElementById('acc-name').value;
        const type = document.getElementById('acc-type').value;
        const sub_category = document.getElementById('acc-subcategory').value;
        const description = document.getElementById('acc-desc').value;

        if (!code || !name || !type || !sub_category) {
            window.App.showToast('Please fill all required fields.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/gl/accounts', { code, name, type, sub_category, description });
            window.App.showToast(res.message, 'success');
            document.getElementById('new-account-modal').classList.remove('active');
            await JournalModal.init(); // Refresh modal accounts
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    }
};

window.GeneralLedgerView = GeneralLedgerView;
