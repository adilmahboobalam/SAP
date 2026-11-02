/**
 * Interactive Double-Entry Journal Modal Component
 * Enforces real-time Debit = Credit validation before posting
 */

const JournalModal = {
    accountsList: [],
    rows: [],

    async init() {
        try {
            const data = await window.API.get('/api/gl/accounts');
            this.accountsList = data.accounts || [];
        } catch (e) {
            console.error('Failed to load COA for Journal Modal:', e);
        }
    },

    open({ onSuccess = null } = {}) {
        this.onSuccess = onSuccess;
        this.rows = [
            { accountId: '', description: '', debit: '', credit: '' },
            { accountId: '', description: '', debit: '', credit: '' }
        ];

        let modalEl = document.getElementById('journal-entry-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'journal-entry-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const today = new Date().toISOString().split('T')[0];

        modalEl.innerHTML = `
            <div class="sap-modal modal-lg">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">📖 Post General Ledger Journal Entry</div>
                    <button class="sap-modal-close" onclick="JournalModal.close()">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Posting Date *</label>
                            <input type="date" id="je-posting-date" class="sap-input" value="${today}">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Reference / Voucher #</label>
                            <input type="text" id="je-reference" class="sap-input" placeholder="e.g. ADJ-001 / BANK-FEE">
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Journal Description / Memo *</label>
                        <input type="text" id="je-description" class="sap-input" placeholder="e.g. Month-end depreciation adjustment">
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 14px;">
                        <span style="font-size: 12.5px; font-weight: 700; color: #1e293b;">Accounting Line Items (Double-Entry)</span>
                        <button type="button" class="sap-btn sap-btn-secondary sap-btn-sm" onclick="JournalModal.addRow()">
                            + Add Line
                        </button>
                    </div>

                    <div class="sap-line-grid">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 32%;">General Ledger Account *</th>
                                    <th style="width: 30%;">Line Description</th>
                                    <th style="width: 17%; text-align: right;">Debit ($)</th>
                                    <th style="width: 17%; text-align: right;">Credit ($)</th>
                                    <th style="width: 4%; text-align: center;"></th>
                                </tr>
                            </thead>
                            <tbody id="je-grid-rows">
                                <!-- Rendered dynamically -->
                            </tbody>
                        </table>
                        <div class="sap-line-grid-footer">
                            <div id="je-balance-badge" class="sap-balance-indicator sap-balance-unbalanced">
                                ⚠️ UNBALANCED (Difference: $0.00)
                            </div>
                            <div style="display: flex; gap: 20px; font-family: monospace; font-size: 13px;">
                                <span>Total Debits: <strong id="je-total-debit">$0.00</strong></span>
                                <span>Total Credits: <strong id="je-total-credit">$0.00</strong></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="JournalModal.close()">Cancel</button>
                    <button class="sap-btn sap-btn-primary" id="btn-post-je" onclick="JournalModal.submit()">
                        ✓ Post Journal Entry
                    </button>
                </div>
            </div>
        `;

        modalEl.classList.add('active');
        this.renderRows();
    },

    close() {
        const modalEl = document.getElementById('journal-entry-modal');
        if (modalEl) modalEl.classList.remove('active');
    },

    addRow() {
        this.rows.push({ accountId: '', description: '', debit: '', credit: '' });
        this.renderRows();
    },

    removeRow(index) {
        if (this.rows.length <= 2) {
            window.App.showToast('Double-entry bookkeeping requires at least 2 line items.', 'error');
            return;
        }
        this.rows.splice(index, 1);
        this.renderRows();
    },

    renderRows() {
        const tbody = document.getElementById('je-grid-rows');
        if (!tbody) return;

        tbody.innerHTML = this.rows.map((row, idx) => `
            <tr>
                <td>
                    <select class="sap-select" onchange="JournalModal.updateField(${idx}, 'accountId', this.value)">
                        <option value="">-- Select GL Account --</option>
                        ${this.accountsList.map(a => `
                            <option value="${a.id}" ${row.accountId == a.id ? 'selected' : ''}>
                                ${a.code} - ${a.name} (${a.type})
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="sap-input" placeholder="Memo" value="${row.description || ''}"
                           oninput="JournalModal.updateField(${idx}, 'description', this.value)">
                </td>
                <td>
                    <input type="number" step="0.01" min="0" class="sap-input text-right" placeholder="0.00" value="${row.debit || ''}"
                           oninput="JournalModal.updateField(${idx}, 'debit', this.value)">
                </td>
                <td>
                    <input type="number" step="0.01" min="0" class="sap-input text-right" placeholder="0.00" value="${row.credit || ''}"
                           oninput="JournalModal.updateField(${idx}, 'credit', this.value)">
                </td>
                <td class="text-center">
                    <button type="button" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px;" 
                            onclick="JournalModal.removeRow(${idx})">✕</button>
                </td>
            </tr>
        `).join('');

        this.calculateTotals();
    },

    updateField(idx, field, value) {
        this.rows[idx][field] = value;
        // If typing in debit, clear credit on that line, and vice versa
        if (field === 'debit' && Number(value) > 0) {
            this.rows[idx].credit = '';
            const credInput = document.querySelectorAll('#je-grid-rows tr')[idx]?.querySelectorAll('input')[2];
            if (credInput) credInput.value = '';
        } else if (field === 'credit' && Number(value) > 0) {
            this.rows[idx].debit = '';
            const debInput = document.querySelectorAll('#je-grid-rows tr')[idx]?.querySelectorAll('input')[1];
            if (debInput) debInput.value = '';
        }
        this.calculateTotals();
    },

    calculateTotals() {
        let totalDebit = 0;
        let totalCredit = 0;

        for (const row of this.rows) {
            totalDebit += Number(row.debit) || 0;
            totalCredit += Number(row.credit) || 0;
        }

        totalDebit = Math.round(totalDebit * 100) / 100;
        totalCredit = Math.round(totalCredit * 100) / 100;
        const diff = Math.abs(totalDebit - totalCredit);
        const isBalanced = diff < 0.009 && totalDebit > 0;

        const debEl = document.getElementById('je-total-debit');
        const credEl = document.getElementById('je-total-credit');
        const badgeEl = document.getElementById('je-balance-badge');
        const postBtn = document.getElementById('btn-post-je');

        if (debEl) debEl.textContent = `$${totalDebit.toFixed(2)}`;
        if (credEl) credEl.textContent = `$${totalCredit.toFixed(2)}`;

        if (badgeEl) {
            if (isBalanced) {
                badgeEl.className = 'sap-balance-indicator sap-balance-balanced';
                badgeEl.textContent = `✓ BALANCED (Total: $${totalDebit.toFixed(2)})`;
            } else {
                badgeEl.className = 'sap-balance-indicator sap-balance-unbalanced';
                badgeEl.textContent = `⚠️ UNBALANCED (Difference: $${diff.toFixed(2)})`;
            }
        }

        if (postBtn) {
            postBtn.disabled = !isBalanced;
        }

        return { totalDebit, totalCredit, isBalanced };
    },

    async submit() {
        const { totalDebit, totalCredit, isBalanced } = this.calculateTotals();
        if (!isBalanced) {
            window.App.showToast('Cannot post unbalanced journal entry. Total debits must equal total credits.', 'error');
            return;
        }

        const postingDate = document.getElementById('je-posting-date').value;
        const reference = document.getElementById('je-reference').value;
        const description = document.getElementById('je-description').value;

        if (!description) {
            window.App.showToast('Please provide a journal description.', 'error');
            return;
        }

        // Validate all lines have an account
        const activeItems = this.rows.filter(r => (Number(r.debit) > 0 || Number(r.credit) > 0));
        for (const item of activeItems) {
            if (!item.accountId) {
                window.App.showToast('Please select a GL account for every row with an amount.', 'error');
                return;
            }
        }

        try {
            const res = await window.API.post('/api/gl/journals', {
                postingDate,
                reference,
                description,
                items: activeItems.map(r => ({
                    accountId: r.accountId,
                    debit: Number(r.debit) || 0,
                    credit: Number(r.credit) || 0,
                    description: r.description || description
                }))
            });

            window.App.showToast(res.message || 'Journal Entry posted successfully!', 'success');
            this.close();
            if (this.onSuccess) this.onSuccess(res);
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    }
};

window.JournalModal = JournalModal;
