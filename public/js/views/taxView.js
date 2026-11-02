/**
 * Tax Management Module View
 * Handles Configurable Tax Rates, Input/Output VAT tracking, Tax Periods & Statutory Filing
 */

const TaxView = {
    taxRates: [],
    taxPeriods: [],

    async render(container) {
        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Tax Management & Regulatory Reporting</h1>
                    <div class="sap-page-subtitle">Sales Tax (Output Tax), Purchase Tax (Input Tax), Net Liability & Period Filings</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="TaxView.openPeriodModal()">
                        + Open Tax Period
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="TaxView.openRateModal()">
                        + Configure Tax Rate
                    </button>
                </div>
            </div>

            <div class="sap-workspace-body">
                <div id="tax-summary-banner" style="margin-bottom: 20px;"></div>
                <div id="tax-rates-container">Loading Tax Rates...</div>
                <div id="tax-periods-container" style="margin-top: 24px;">Loading Tax Periods...</div>
            </div>
        `;

        await this.loadData();
    },

    async loadData() {
        try {
            const [rateData, periodData, sumData] = await Promise.all([
                window.API.get('/api/tax/rates'),
                window.API.get('/api/tax/periods'),
                window.API.get('/api/tax/summary')
            ]);

            this.taxRates = rateData.taxRates || [];
            this.taxPeriods = periodData.periods || [];
            const summary = sumData.summary;

            // Summary banner
            const banner = document.getElementById('tax-summary-banner');
            if (banner && summary) {
                banner.innerHTML = `
                    <div style="background: #ffffff; border: 1px solid var(--sap-border-color); border-radius: 6px; padding: 18px 24px;">
                        <h4 style="font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 12px;">Fiscal Year Tax Balance (Input vs Output Tax)</h4>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; font-family: monospace;">
                            <div style="border-right: 1px solid #e2e8f0; padding-right: 14px;">
                                <div style="font-size: 11.5px; color: #64748b; font-family: var(--font-family);">Output Tax (Collected on Sales):</div>
                                <div style="font-size: 22px; font-weight: 800; color: #0070f2; margin-top: 4px;">
                                    $${Number(summary.outputTax.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div style="border-right: 1px solid #e2e8f0; padding-right: 14px;">
                                <div style="font-size: 11.5px; color: #64748b; font-family: var(--font-family);">Input Tax (Paid on Purchases & Expenses):</div>
                                <div style="font-size: 22px; font-weight: 800; color: #10b981; margin-top: 4px;">
                                    $${Number(summary.inputTax.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 11.5px; color: #64748b; font-family: var(--font-family);">Net Statutory Tax Payable / (Refund):</div>
                                <div style="font-size: 22px; font-weight: 800; color: ${summary.netTaxLiability >= 0 ? '#e53935' : '#10b981'}; margin-top: 4px;">
                                    $${Number(summary.netTaxLiability).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Tax Rates Table
            new EnterpriseTable({
                containerId: 'tax-rates-container',
                title: 'Configurable Enterprise Tax Rates',
                exportName: 'Tax_Rates',
                columns: [
                    { key: 'code', label: 'Tax Code', fontMono: true },
                    { key: 'name', label: 'Rate Description' },
                    { key: (r) => `${r.rate}%`, label: 'Tax Percentage', align: 'right', fontMono: true },
                    { key: 'type', label: 'Applicability' },
                    { key: 'sales_tax_account_name', label: 'Output Tax GL Account' },
                    { key: 'purchase_tax_account_name', label: 'Input Tax GL Account' },
                    { key: 'is_active', label: 'Status', align: 'center', render: (r) => r.is_active ? `<span class="sap-badge sap-badge-posted">Active</span>` : `<span class="sap-badge sap-badge-draft">Inactive</span>` }
                ],
                data: this.taxRates
            });

            // Tax Periods Table
            new EnterpriseTable({
                containerId: 'tax-periods-container',
                title: 'Tax Reporting Periods & Filings',
                exportName: 'Tax_Periods',
                columns: [
                    { key: 'name', label: 'Period Name' },
                    { key: 'start_date', label: 'Start Date' },
                    { key: 'end_date', label: 'End Date' },
                    { 
                        key: 'total_output_tax', 
                        label: 'Output Tax ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_output_tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'total_input_tax', 
                        label: 'Input Tax ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_input_tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'net_tax_payable', 
                        label: 'Net Tax ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong>$${Number(r.net_tax_payable).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
                    },
                    { 
                        key: 'status', 
                        label: 'Filing Status', 
                        align: 'center', 
                        render: (r) => r.status === 'FILED' ? `<span class="sap-badge sap-badge-posted">✓ FILED</span>` : `<span class="sap-badge sap-badge-open">OPEN</span>` 
                    },
                    {
                        key: 'actions',
                        label: 'Action',
                        sortable: false,
                        render: (r) => r.status === 'OPEN' ? `
                            <button class="sap-btn sap-btn-primary sap-btn-sm" onclick="TaxView.fileTaxPeriod(${r.id})">
                                File & Finalize
                            </button>
                        ` : `<span style="font-size: 11px; color: #64748b;">${r.filed_at || 'Archived'}</span>`
                    }
                ],
                data: this.taxPeriods
            });
        } catch (err) {
            window.App.showToast('Error loading tax data: ' + err.message, 'error');
        }
    },

    openRateModal() {
        let modalEl = document.getElementById('new-tax-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'new-tax-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">Configure Tax Rate</div>
                    <button class="sap-modal-close" onclick="document.getElementById('new-tax-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Tax Code * (e.g. VAT-15)</label>
                            <input type="text" id="tr-code" class="sap-input">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Rate Percentage (%) *</label>
                            <input type="number" step="0.01" min="0" id="tr-rate" class="sap-input" placeholder="e.g. 15.0">
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Tax Name / Description *</label>
                        <input type="text" id="tr-name" class="sap-input" placeholder="e.g. Value Added Tax 15%">
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Applicable To *</label>
                        <select id="tr-type" class="sap-select">
                            <option value="BOTH">Both Sales & Purchases</option>
                            <option value="SALES">Sales Only (Output Tax)</option>
                            <option value="PURCHASE">Purchases Only (Input Tax)</option>
                        </select>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('new-tax-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="TaxView.submitRate()">Save Tax Rate</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitRate() {
        const code = document.getElementById('tr-code').value;
        const rate = document.getElementById('tr-rate').value;
        const name = document.getElementById('tr-name').value;
        const type = document.getElementById('tr-type').value;

        if (!code || !rate || !name) {
            window.App.showToast('Please fill all required fields.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/tax/rates', { code, rate: Number(rate), name, type });
            window.App.showToast(res.message, 'success');
            document.getElementById('new-tax-modal').classList.remove('active');
            this.loadData();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    openPeriodModal() {
        let modalEl = document.getElementById('new-tax-period-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'new-tax-period-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">Open New Tax Filing Period</div>
                    <button class="sap-modal-close" onclick="document.getElementById('new-tax-period-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-group">
                        <label class="sap-form-label">Period Name *</label>
                        <input type="text" id="tp-name" class="sap-input" placeholder="e.g. Q2 2026 Tax Period">
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Start Date *</label>
                            <input type="date" id="tp-start" class="sap-input" value="2026-04-01">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">End Date *</label>
                            <input type="date" id="tp-end" class="sap-input" value="2026-06-30">
                        </div>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('new-tax-period-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="TaxView.submitPeriod()">Open Period</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitPeriod() {
        const name = document.getElementById('tp-name').value;
        const start_date = document.getElementById('tp-start').value;
        const end_date = document.getElementById('tp-end').value;

        if (!name || !start_date || !end_date) {
            window.App.showToast('Please fill all period dates.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/tax/periods', { name, start_date, end_date });
            window.App.showToast(res.message, 'success');
            document.getElementById('new-tax-period-modal').classList.remove('active');
            this.loadData();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    async fileTaxPeriod(periodId) {
        if (!confirm('Are you sure you want to finalize and lock this tax filing period?')) return;
        try {
            const res = await window.API.post(`/api/tax/periods/${periodId}/file`, {});
            window.App.showToast(res.message, 'success');
            this.loadData();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    }
};

window.TaxView = TaxView;
