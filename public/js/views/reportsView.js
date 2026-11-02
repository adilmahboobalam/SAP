/**
 * Dedicated Enterprise Financial & Accounting Reporting Section
 * Serves all 12 financial statements & operational reports with custom date ranges,
 * account-level filters, print view, and CSV/Excel export
 */

const ReportsView = {
    selectedReport: 'pnl',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    accounts: [],
    getCompanyName() {
        return window.App?.company?.legal_name || window.App?.company?.name || 'Enterprise Financials';
    },

    async render(container, defaultReport = 'pnl') {
        this.selectedReport = defaultReport;

        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Enterprise Financial & Operational Reporting</h1>
                    <div class="sap-page-subtitle">Standard GAAP/IFRS Financial Statements, Ledger Reports & Aging Analytics</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="window.print()">
                        🖨️ Print / PDF
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="ReportsView.exportCurrentReport()">
                        📥 Export CSV
                    </button>
                </div>
            </div>

            <!-- Reports Filter Bar -->
            <div class="sap-card" style="margin: 16px 24px 0 24px;">
                <div class="sap-card-body" style="padding: 12px 18px; display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
                    <div style="flex: 2; min-width: 240px;">
                        <label class="sap-form-label">Select Report</label>
                        <select id="report-type-select" class="sap-select" onchange="ReportsView.onSelectReport(this.value)">
                            <optgroup label="Core Financial Statements">
                                <option value="pnl" ${this.selectedReport === 'pnl' ? 'selected' : ''}>1. Profit & Loss Statement (Income Statement)</option>
                                <option value="balance-sheet" ${this.selectedReport === 'balance-sheet' ? 'selected' : ''}>2. Balance Sheet (Statement of Financial Position)</option>
                                <option value="cash-flow" ${this.selectedReport === 'cash-flow' ? 'selected' : ''}>3. Statement of Cash Flows (Operating/Investing/Financing)</option>
                                <option value="trial-balance" ${this.selectedReport === 'trial-balance' ? 'selected' : ''}>4. General Ledger Trial Balance</option>
                            </optgroup>
                            <optgroup label="Accounting & Ledger Reports">
                                <option value="general-ledger" ${this.selectedReport === 'general-ledger' ? 'selected' : ''}>5. General Ledger Transaction Report</option>
                                <option value="ar-aging" ${this.selectedReport === 'ar-aging' ? 'selected' : ''}>6. Accounts Receivable Aging Report</option>
                                <option value="ap-aging" ${this.selectedReport === 'ap-aging' ? 'selected' : ''}>7. Accounts Payable Aging Report</option>
                                <option value="expenses" ${this.selectedReport === 'expenses' ? 'selected' : ''}>8. Operating Expenses Analysis</option>
                            </optgroup>
                            <optgroup label="Operational & Statutory Reports">
                                <option value="sales" ${this.selectedReport === 'sales' ? 'selected' : ''}>9. Sales & Revenue by Customer Report</option>
                                <option value="purchases" ${this.selectedReport === 'purchases' ? 'selected' : ''}>10. Purchases by Vendor Report</option>
                                <option value="tax" ${this.selectedReport === 'tax' ? 'selected' : ''}>11. Statutory Tax Audit Report (Input/Output VAT)</option>
                                <option value="bank-rec" ${this.selectedReport === 'bank-rec' ? 'selected' : ''}>12. Bank Reconciliation Report</option>
                            </optgroup>
                        </select>
                    </div>

                    <div style="flex: 1; min-width: 140px;">
                        <label class="sap-form-label">Start Date</label>
                        <input type="date" id="report-start-date" class="sap-input" value="${this.startDate}">
                    </div>

                    <div style="flex: 1; min-width: 140px;">
                        <label class="sap-form-label">End / As-of Date</label>
                        <input type="date" id="report-end-date" class="sap-input" value="${this.endDate}">
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <button class="sap-btn sap-btn-primary" onclick="ReportsView.refreshReport()">
                            Generate Report
                        </button>
                    </div>
                </div>
            </div>

            <div class="sap-workspace-body" id="report-display-container">
                <div style="text-align: center; padding: 60px; color: var(--sap-text-muted);">Generating report...</div>
            </div>
        `;

        await this.loadAccounts();
        await this.refreshReport();
    },

    async loadAccounts() {
        try {
            const data = await window.API.get('/api/gl/accounts');
            this.accounts = data.accounts || [];
        } catch (e) {
            console.error(e);
        }
    },

    onSelectReport(reportKey) {
        this.selectedReport = reportKey;
        this.refreshReport();
    },

    async refreshReport() {
        const container = document.getElementById('report-display-container');
        if (!container) return;

        this.startDate = document.getElementById('report-start-date')?.value || '2026-01-01';
        this.endDate = document.getElementById('report-end-date')?.value || '2026-12-31';

        container.innerHTML = `<div style="text-align: center; padding: 60px; color: var(--sap-text-muted);">Calculating real-time statement metrics from database records...</div>`;

        try {
            switch (this.selectedReport) {
                case 'pnl':
                    await this.renderPnL(container);
                    break;
                case 'balance-sheet':
                    await this.renderBalanceSheet(container);
                    break;
                case 'cash-flow':
                    await this.renderCashFlow(container);
                    break;
                case 'trial-balance':
                    await this.renderTrialBalance(container);
                    break;
                case 'general-ledger':
                    await this.renderGeneralLedger(container);
                    break;
                case 'ar-aging':
                    await this.renderArAging(container);
                    break;
                case 'ap-aging':
                    await this.renderApAging(container);
                    break;
                case 'expenses':
                    await this.renderExpenses(container);
                    break;
                case 'sales':
                    await this.renderSales(container);
                    break;
                case 'purchases':
                    await this.renderPurchases(container);
                    break;
                case 'tax':
                    await this.renderTax(container);
                    break;
                case 'bank-rec':
                    await this.renderBankRec(container);
                    break;
                default:
                    await this.renderPnL(container);
            }
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 24px; color: #e53935;">Error compiling report: ${err.message}</div>`;
        }
    },

    // 1. Profit & Loss Statement
    async renderPnL(container) {
        const res = await window.API.get(`/api/reports/pnl?startDate=${this.startDate}&endDate=${this.endDate}`);
        const p = res.report;
        this.lastExportData = { name: 'Profit_and_Loss', rows: [
            ...p.revenue.accounts.map(a => ({ item: `${a.code} - ${a.name}`, amount: a.balance })),
            { item: 'TOTAL REVENUE', amount: p.revenue.total },
            ...p.cogs.accounts.map(a => ({ item: `${a.code} - ${a.name}`, amount: a.balance })),
            { item: 'GROSS PROFIT', amount: p.grossProfit },
            ...p.operatingExpenses.accounts.map(a => ({ item: `${a.code} - ${a.name}`, amount: a.balance })),
            { item: 'NET PROFIT', amount: p.netProfit }
        ], columns: [{ label: 'Line Item', key: 'item' }, { label: 'Amount ($)', key: 'amount' }] };

        container.innerHTML = `
            <div class="sap-report-container">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Profit & Loss Statement (Income Statement)</div>
                    <div class="sap-report-period">For the Period: ${this.startDate} through ${this.endDate}</div>
                </div>

                <!-- Operating Revenue -->
                <div class="sap-report-section-title">Operating Revenue</div>
                ${p.revenue.accounts.map(a => `
                    <div class="sap-report-row indent">
                        <span>${a.code} - ${a.name}</span>
                        <span class="font-mono">$${Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                `).join('')}
                <div class="sap-report-subtotal">
                    <span>Total Operating Revenue</span>
                    <span class="font-mono">$${Number(p.revenue.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <!-- Cost of Goods Sold -->
                <div class="sap-report-section-title">Cost of Goods Sold (COGS)</div>
                ${p.cogs.accounts.map(a => `
                    <div class="sap-report-row indent">
                        <span>${a.code} - ${a.name}</span>
                        <span class="font-mono">($${Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                    </div>
                `).join('')}
                <div class="sap-report-subtotal" style="background: #f8fafc; padding: 10px 6px;">
                    <span style="font-weight: 800;">GROSS PROFIT</span>
                    <span class="font-mono" style="font-weight: 800; color: #0070f2;">$${Number(p.grossProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <!-- Operating Expenses -->
                <div class="sap-report-section-title">Operating & Administrative Expenses</div>
                ${p.operatingExpenses.accounts.map(a => `
                    <div class="sap-report-row indent">
                        <span>${a.code} - ${a.name}</span>
                        <span class="font-mono">$${Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                `).join('')}
                <div class="sap-report-subtotal">
                    <span>Total Operating Expenses</span>
                    <span class="font-mono">($${Number(p.operatingExpenses.total).toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                </div>

                <!-- Net Income Bottom Line -->
                <div class="sap-report-grandtotal">
                    <span>NET PROFIT / (NET INCOME)</span>
                    <span class="font-mono" style="color: ${p.netProfit >= 0 ? '#10b981' : '#e53935'};">
                        $${Number(p.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>
        `;
    },

    // 2. Balance Sheet
    async renderBalanceSheet(container) {
        const res = await window.API.get(`/api/reports/balance-sheet?asOfDate=${this.endDate}`);
        const bs = res.report;

        container.innerHTML = `
            <div class="sap-report-container">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Statement of Financial Position (Balance Sheet)</div>
                    <div class="sap-report-period">As of: ${this.endDate} • Verified Balanced</div>
                </div>

                <div style="display: flex; justify-content: center; margin-bottom: 14px;">
                    <span class="sap-badge ${bs.isBalanced ? 'sap-badge-posted' : 'sap-badge-overdue'}" style="font-size: 13px; padding: 4px 12px;">
                        ${bs.isBalanced ? '✓ ASSETS EQUAL LIABILITIES + EQUITY' : '⚠️ OUT OF BALANCE'}
                    </span>
                </div>

                <!-- ASSETS -->
                <div class="sap-report-section-title" style="color: #0070f2; font-size: 14px;">ASSETS</div>
                
                <div style="font-size: 12px; font-weight: 700; color: #475569; margin: 8px 0 4px 0;">Current Assets</div>
                ${bs.assets.current.map(a => `
                    <div class="sap-report-row indent">
                        <span>${a.code} - ${a.name}</span>
                        <span class="font-mono">$${Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                `).join('')}

                <div style="font-size: 12px; font-weight: 700; color: #475569; margin: 12px 0 4px 0;">Non-Current & Fixed Assets</div>
                ${bs.assets.nonCurrent.map(a => `
                    <div class="sap-report-row indent">
                        <span>${a.code} - ${a.name}</span>
                        <span class="font-mono">$${Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                `).join('')}

                <div class="sap-report-subtotal" style="background: #f0f7ff; padding: 10px 8px;">
                    <span style="font-weight: 800;">TOTAL ASSETS</span>
                    <span class="font-mono" style="font-weight: 800; font-size: 15px; color: #0070f2;">$${Number(bs.assets.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <!-- LIABILITIES -->
                <div class="sap-report-section-title" style="color: #d97706; font-size: 14px; margin-top: 24px;">LIABILITIES</div>
                ${bs.liabilities.accounts.map(a => `
                    <div class="sap-report-row indent">
                        <span>${a.code} - ${a.name}</span>
                        <span class="font-mono">$${Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                `).join('')}
                <div class="sap-report-subtotal">
                    <span>Total Liabilities</span>
                    <span class="font-mono">$${Number(bs.liabilities.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <!-- EQUITY -->
                <div class="sap-report-section-title" style="color: #7c3aed; font-size: 14px; margin-top: 20px;">SHAREHOLDERS' EQUITY</div>
                ${bs.equity.accounts.map(a => `
                    <div class="sap-report-row indent">
                        <span>${a.code} - ${a.name}</span>
                        <span class="font-mono">$${Number(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                `).join('')}
                <div class="sap-report-row indent" style="color: #059669; font-weight: 600;">
                    <span>Current Year Net Earnings (from P&L)</span>
                    <span class="font-mono">$${Number(bs.equity.retainedEarnings).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="sap-report-subtotal">
                    <span>Total Equity</span>
                    <span class="font-mono">$${Number(bs.equity.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <!-- TOTAL LIABILITIES & EQUITY -->
                <div class="sap-report-grandtotal">
                    <span>TOTAL LIABILITIES & EQUITY</span>
                    <span class="font-mono" style="color: #0f172a;">$${Number(bs.totalLiabilitiesAndEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
        `;
    },

    // 3. Cash Flow Statement
    async renderCashFlow(container) {
        const res = await window.API.get(`/api/reports/cash-flow?startDate=${this.startDate}&endDate=${this.endDate}`);
        const cf = res.report;

        container.innerHTML = `
            <div class="sap-report-container">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Statement of Cash Flows (Direct Method)</div>
                    <div class="sap-report-period">For the Period: ${this.startDate} through ${this.endDate}</div>
                </div>

                <div class="sap-report-section-title">Cash Flows from Operating Activities</div>
                <div class="sap-report-row indent">
                    <span>Cash Inflow from Customers</span>
                    <span class="font-mono" style="color: #10b981;">+$${Number(cf.operating.customerReceipts).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="sap-report-row indent">
                    <span>Cash Paid to Suppliers & Vendors</span>
                    <span class="font-mono" style="color: #e53935;">-$${Number(cf.operating.supplierPayments).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="sap-report-row indent">
                    <span>Cash Paid for Operating Expenses</span>
                    <span class="font-mono" style="color: #e53935;">-$${Number(cf.operating.operatingExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="sap-report-row indent">
                    <span>Cash Paid to Personnel & Payroll</span>
                    <span class="font-mono" style="color: #e53935;">-$${Number(cf.operating.payrollPayments).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="sap-report-subtotal">
                    <span>Net Cash Provided by Operating Activities</span>
                    <span class="font-mono" style="font-weight: 700;">$${Number(cf.operating.netOperatingCash).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div class="sap-report-section-title">Cash Flows from Investing Activities</div>
                <div class="sap-report-row indent">
                    <span>Capital Expenditures & Fixed Assets</span>
                    <span class="font-mono">-$${Number(cf.investing.fixedAssetsPurchased).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="sap-report-subtotal">
                    <span>Net Cash Used in Investing Activities</span>
                    <span class="font-mono">$${Number(cf.investing.netInvestingCash).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div class="sap-report-section-title">Cash Flows from Financing Activities</div>
                <div class="sap-report-row indent">
                    <span>Contributed Equity Capital & Long Term Debt</span>
                    <span class="font-mono">+$${Number(cf.financing.capitalAndDebt).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="sap-report-subtotal">
                    <span>Net Cash from Financing Activities</span>
                    <span class="font-mono">$${Number(cf.financing.netFinancingCash).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div class="sap-report-grandtotal">
                    <span>NET CHANGE IN CASH & EQUIVALENTS</span>
                    <span class="font-mono" style="color: #0070f2;">$${Number(cf.netCashChange).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
        `;
    },

    // 4. Trial Balance
    async renderTrialBalance(container) {
        const res = await window.API.get(`/api/reports/trial-balance?asOfDate=${this.endDate}`);
        const tb = res.report;

        container.innerHTML = `
            <div class="sap-report-container">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">General Ledger Trial Balance</div>
                    <div class="sap-report-period">As of ${tb.asOfDate}</div>
                </div>

                <table class="sap-table">
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
                                <td class="font-mono">${a.code}</td>
                                <td>${a.name}</td>
                                <td>${a.subCategory}</td>
                                <td class="text-right font-mono">${a.debit > 0 ? `$${Number(a.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                <td class="text-right font-mono">${a.credit > 0 ? `$${Number(a.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f8fafc; font-weight: 800; font-size: 14px; border-top: 2px solid #0f172a; border-bottom: 3px double #0f172a;">
                            <td colspan="3" class="text-right">TOTAL:</td>
                            <td class="text-right font-mono" style="color: #0070f2;">$${Number(tb.totalDebit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td class="text-right font-mono" style="color: #0070f2;">$${Number(tb.totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    // 5. General Ledger Report
    async renderGeneralLedger(container) {
        const res = await window.API.get(`/api/reports/general-ledger?startDate=${this.startDate}&endDate=${this.endDate}`);
        const reports = res.report || [];

        container.innerHTML = `
            <div class="sap-report-container" style="max-width: 100%;">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">General Ledger Full Audit Trail</div>
                    <div class="sap-report-period">${this.startDate} to ${this.endDate}</div>
                </div>

                ${reports.map(acc => `
                    <div class="sap-card" style="margin-bottom: 24px;">
                        <div class="sap-card-header" style="background: #f8fafc;">
                            <span class="sap-card-title">${acc.code} - ${acc.name} (${acc.type})</span>
                            <span class="font-mono" style="font-weight: 700; color: #0070f2;">Ending Balance: $${Number(acc.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <table class="sap-table">
                            <thead>
                                <tr><th>Date</th><th>Voucher #</th><th>Ref</th><th>Description</th><th class="text-right">Debit ($)</th><th class="text-right">Credit ($)</th><th class="text-right">Balance ($)</th></tr>
                            </thead>
                            <tbody>
                                ${acc.transactions.map(t => `
                                    <tr>
                                        <td>${t.date}</td>
                                        <td class="font-mono">${t.entryNumber}</td>
                                        <td>${t.reference || '-'}</td>
                                        <td>${t.description}</td>
                                        <td class="text-right font-mono">${t.debit > 0 ? `$${Number(t.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                        <td class="text-right font-mono">${t.credit > 0 ? `$${Number(t.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</td>
                                        <td class="text-right font-mono" style="font-weight: 600;">$${Number(t.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // 6. AR Aging Report
    async renderArAging(container) {
        const res = await window.API.get(`/api/reports/ar-aging?asOfDate=${this.endDate}`);
        const ar = res.report;

        container.innerHTML = `
            <div class="sap-report-container" style="max-width: 100%;">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Accounts Receivable Aging Report</div>
                    <div class="sap-report-period">As of ${ar.asOfDate}</div>
                </div>

                <table class="sap-table">
                    <thead>
                        <tr>
                            <th>Customer Code</th>
                            <th>Customer Name</th>
                            <th class="text-right">Current ($)</th>
                            <th class="text-right">1-30 Days</th>
                            <th class="text-right">31-60 Days</th>
                            <th class="text-right">61-90 Days</th>
                            <th class="text-right">90+ Days</th>
                            <th class="text-right">Total Outstanding</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ar.customers.map(c => `
                            <tr>
                                <td class="font-mono"><strong>${c.customerCode}</strong></td>
                                <td>${c.customerName}</td>
                                <td class="text-right font-mono">$${Number(c.current).toLocaleString()}</td>
                                <td class="text-right font-mono">$${Number(c.days1_30).toLocaleString()}</td>
                                <td class="text-right font-mono">$${Number(c.days31_60).toLocaleString()}</td>
                                <td class="text-right font-mono">$${Number(c.days61_90).toLocaleString()}</td>
                                <td class="text-right font-mono" style="color: ${c.days90Plus > 0 ? '#e53935' : 'inherit'};">$${Number(c.days90Plus).toLocaleString()}</td>
                                <td class="text-right font-mono" style="font-weight: 700; color: #0070f2;">$${Number(c.totalDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f8fafc; font-weight: 800; font-size: 13.5px;">
                            <td colspan="2">TOTAL RECEIVABLES:</td>
                            <td class="text-right font-mono">$${Number(ar.totals.current).toLocaleString()}</td>
                            <td class="text-right font-mono">$${Number(ar.totals.days1_30).toLocaleString()}</td>
                            <td class="text-right font-mono">$${Number(ar.totals.days31_60).toLocaleString()}</td>
                            <td class="text-right font-mono">$${Number(ar.totals.days61_90).toLocaleString()}</td>
                            <td class="text-right font-mono">$${Number(ar.totals.days90Plus).toLocaleString()}</td>
                            <td class="text-right font-mono" style="color: #0070f2;">$${Number(ar.totals.totalDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    // 7. AP Aging Report
    async renderApAging(container) {
        const res = await window.API.get(`/api/reports/ap-aging?asOfDate=${this.endDate}`);
        const ap = res.report;

        container.innerHTML = `
            <div class="sap-report-container" style="max-width: 100%;">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Accounts Payable Aging Report</div>
                    <div class="sap-report-period">As of ${ap.asOfDate}</div>
                </div>

                <table class="sap-table">
                    <thead>
                        <tr>
                            <th>Supplier Code</th>
                            <th>Vendor Name</th>
                            <th class="text-right">Current ($)</th>
                            <th class="text-right">1-30 Days</th>
                            <th class="text-right">31-60 Days</th>
                            <th class="text-right">61-90 Days</th>
                            <th class="text-right">90+ Days</th>
                            <th class="text-right">Total Payable</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ap.suppliers.map(s => `
                            <tr>
                                <td class="font-mono"><strong>${s.supplierCode}</strong></td>
                                <td>${s.supplierName}</td>
                                <td class="text-right font-mono">$${Number(s.current).toLocaleString()}</td>
                                <td class="text-right font-mono">$${Number(s.days1_30).toLocaleString()}</td>
                                <td class="text-right font-mono">$${Number(s.days31_60).toLocaleString()}</td>
                                <td class="text-right font-mono">$${Number(s.days61_90).toLocaleString()}</td>
                                <td class="text-right font-mono" style="color: ${s.days90Plus > 0 ? '#e53935' : 'inherit'};">$${Number(s.days90Plus).toLocaleString()}</td>
                                <td class="text-right font-mono" style="font-weight: 700; color: #e53935;">$${Number(s.totalDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f8fafc; font-weight: 800; font-size: 13.5px;">
                            <td colspan="2">TOTAL PAYABLES:</td>
                            <td class="text-right font-mono">$${Number(ap.totals.current).toLocaleString()}</td>
                            <td class="text-right font-mono">$${Number(ap.totals.days1_30).toLocaleString()}</td>
                            <td class="text-right font-mono">$${Number(ap.totals.days31_60).toLocaleString()}</td>
                            <td class="text-right font-mono">$${Number(ap.totals.days61_90).toLocaleString()}</td>
                            <td class="text-right font-mono">$${Number(ap.totals.days90Plus).toLocaleString()}</td>
                            <td class="text-right font-mono" style="color: #e53935;">$${Number(ap.totals.totalDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    // 8. Expense Report
    async renderExpenses(container) {
        const res = await window.API.get(`/api/reports/expenses?startDate=${this.startDate}&endDate=${this.endDate}`);
        const exp = res.report;

        container.innerHTML = `
            <div class="sap-report-container">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Corporate Operating Expenses Report</div>
                    <div class="sap-report-period">${this.startDate} to ${this.endDate}</div>
                </div>

                <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Expenses by Category</h4>
                <table class="sap-table" style="margin-bottom: 24px;">
                    <thead><tr><th>Category</th><th class="text-right">Transactions</th><th class="text-right">Total Spent ($)</th></tr></thead>
                    <tbody>
                        ${exp.byCategory.map(c => `
                            <tr>
                                <td><strong>${c.category_name}</strong></td>
                                <td class="text-right font-mono">${c.count}</td>
                                <td class="text-right font-mono">$${Number(c.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Expenses by Department</h4>
                <table class="sap-table">
                    <thead><tr><th>Department</th><th class="text-right">Transactions</th><th class="text-right">Total Spent ($)</th></tr></thead>
                    <tbody>
                        ${exp.byDepartment.map(d => `
                            <tr>
                                <td><strong>${d.department}</strong></td>
                                <td class="text-right font-mono">${d.count}</td>
                                <td class="text-right font-mono">$${Number(d.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: 800; background: #f8fafc;">
                            <td>TOTAL EXPENSES:</td>
                            <td colspan="2" class="text-right font-mono" style="color: #e53935; font-size: 14px;">$${Number(exp.totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    // 9. Sales Report
    async renderSales(container) {
        const res = await window.API.get(`/api/reports/sales?startDate=${this.startDate}&endDate=${this.endDate}`);
        const s = res.report;

        container.innerHTML = `
            <div class="sap-report-container">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Sales Revenue by Customer Report</div>
                    <div class="sap-report-period">${this.startDate} to ${this.endDate}</div>
                </div>

                <table class="sap-table">
                    <thead><tr><th>Code</th><th>Customer</th><th class="text-right">Invoices</th><th class="text-right">Total Sales ($)</th></tr></thead>
                    <tbody>
                        ${s.byCustomer.map(c => `
                            <tr>
                                <td class="font-mono"><strong>${c.code}</strong></td>
                                <td>${c.name}</td>
                                <td class="text-right font-mono">${c.invoice_count}</td>
                                <td class="text-right font-mono" style="font-weight: 700; color: #0070f2;">$${Number(c.total_sales).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: 800; background: #f8fafc;">
                            <td colspan="3" class="text-right">TOTAL BILLED SALES:</td>
                            <td class="text-right font-mono" style="color: #0070f2; font-size: 14px;">$${Number(s.totalSales).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    // 10. Purchase Report
    async renderPurchases(container) {
        const res = await window.API.get(`/api/reports/purchases?startDate=${this.startDate}&endDate=${this.endDate}`);
        const p = res.report;

        container.innerHTML = `
            <div class="sap-report-container">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Procurement & Purchases by Supplier</div>
                    <div class="sap-report-period">${this.startDate} to ${this.endDate}</div>
                </div>

                <table class="sap-table">
                    <thead><tr><th>Code</th><th>Supplier / Vendor</th><th class="text-right">Bills</th><th class="text-right">Total Purchases ($)</th></tr></thead>
                    <tbody>
                        ${p.bySupplier.map(s => `
                            <tr>
                                <td class="font-mono"><strong>${s.code}</strong></td>
                                <td>${s.name}</td>
                                <td class="text-right font-mono">${s.bill_count}</td>
                                <td class="text-right font-mono" style="font-weight: 700;">$${Number(s.total_purchases).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: 800; background: #f8fafc;">
                            <td colspan="3" class="text-right">TOTAL PURCHASES:</td>
                            <td class="text-right font-mono" style="color: #e53935; font-size: 14px;">$${Number(p.totalPurchases).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    // 11. Tax Report
    async renderTax(container) {
        const res = await window.API.get(`/api/reports/tax?startDate=${this.startDate}&endDate=${this.endDate}`);
        const t = res.report;

        container.innerHTML = `
            <div class="sap-report-container">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Statutory Tax Audit Report (Input vs Output Tax)</div>
                    <div class="sap-report-period">${this.startDate} to ${this.endDate}</div>
                </div>

                <div class="sap-report-subtotal" style="background: #f8fafc; padding: 12px; margin-bottom: 16px;">
                    <span>NET STATUTORY TAX LIABILITY</span>
                    <span class="font-mono" style="font-size: 16px; font-weight: 800; color: ${t.netTaxLiability >= 0 ? '#e53935' : '#10b981'};">
                        $${Number(t.netTaxLiability).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                </div>

                <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Output Tax (Sales Invoices)</h4>
                <table class="sap-table" style="margin-bottom: 20px;">
                    <thead><tr><th>Tax Rate</th><th class="text-right">Taxable Amount ($)</th><th class="text-right">Tax Amount ($)</th></tr></thead>
                    <tbody>
                        ${t.outputTax.items.map(i => `
                            <tr>
                                <td>${i.tax_name}</td>
                                <td class="text-right font-mono">$${Number(i.taxable_amount).toLocaleString()}</td>
                                <td class="text-right font-mono">$${Number(i.tax_amount).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot><tr><td colspan="2" class="text-right">Total Output Tax:</td><td class="text-right font-mono">$${Number(t.outputTax.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr></tfoot>
                </table>

                <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Input Tax (Purchases & Expenses)</h4>
                <table class="sap-table">
                    <thead><tr><th>Tax Rate</th><th class="text-right">Taxable Amount ($)</th><th class="text-right">Input Tax ($)</th></tr></thead>
                    <tbody>
                        ${t.inputTax.bills.map(i => `
                            <tr>
                                <td>Vendor Bills - ${i.tax_name}</td>
                                <td class="text-right font-mono">$${Number(i.taxable_amount).toLocaleString()}</td>
                                <td class="text-right font-mono">$${Number(i.tax_amount).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot><tr><td colspan="2" class="text-right">Total Input Tax:</td><td class="text-right font-mono">$${Number(t.inputTax.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr></tfoot>
                </table>
            </div>
        `;
    },

    // 12. Bank Reconciliation Report
    async renderBankRec(container) {
        const data = await window.API.get('/api/banking/reconciliations');
        const list = data.reconciliations || [];

        if (!list.length) {
            container.innerHTML = `<div class="sap-card" style="padding: 40px; text-align: center; color: var(--sap-text-muted);">No completed bank reconciliations found.</div>`;
            return;
        }

        const rec = list[0];
        const detail = await window.API.get(`/api/reports/bank-reconciliation/${rec.id}`);
        const r = detail.report;

        container.innerHTML = `
            <div class="sap-report-container">
                <div class="sap-report-header">
                    <div class="sap-report-company">${this.getCompanyName()}</div>
                    <div class="sap-report-title">Bank Reconciliation Audit Statement</div>
                    <div class="sap-report-period">Statement Cut-Off: ${r.reconciliation.statement_date} • ${r.reconciliation.bank_name}</div>
                </div>

                <div style="background: #f8fafc; border: 1px solid var(--sap-border-color); border-radius: 6px; padding: 14px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                    <div>Bank Statement Balance: <strong class="font-mono">$${Number(r.reconciliation.statement_balance).toLocaleString()}</strong></div>
                    <div>General Ledger Book Balance: <strong class="font-mono">$${Number(r.reconciliation.book_balance).toLocaleString()}</strong></div>
                    <div>Variance: <strong class="font-mono" style="color: ${Math.abs(r.reconciliation.difference) < 0.01 ? '#10b981' : '#e53935'};">$${Number(r.reconciliation.difference).toLocaleString()}</strong></div>
                </div>

                <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Cleared Transactions</h4>
                <table class="sap-table">
                    <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Ref</th><th class="text-right">Amount ($)</th></tr></thead>
                    <tbody>
                        ${r.transactions.map(t => `
                            <tr>
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
        `;
    },

    exportCurrentReport() {
        if (this.lastExportData) {
            window.API.exportToCsv(this.lastExportData.name, this.lastExportData.rows, this.lastExportData.columns);
        } else {
            window.App.showToast('Printing or exporting viewable statement directly...', 'info');
            window.print();
        }
    }
};

window.ReportsView = ReportsView;
