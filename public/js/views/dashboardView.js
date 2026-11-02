/**
 * Main Enterprise Executive Dashboard View
 * Displays real-time KPIs, monthly financial comparison chart, expense breakdown,
 * recent double-entry ledger transactions, and upcoming due dates
 */

const DashboardView = {
    async render(container) {
        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Executive Financial Dashboard</h1>
                    <div class="sap-page-subtitle">Real-time General Ledger KPIs, Cash Flow & Financial Position (FY 2026)</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="DashboardView.loadData()">
                        ↻ Refresh
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="JournalModal.open({ onSuccess: () => DashboardView.loadData() })">
                        + New Journal Entry
                    </button>
                </div>
            </div>

            <div class="sap-workspace-body">
                <!-- KPI Tiles Row 1: Core Financial Performance -->
                <div class="sap-kpi-grid">
                    <div class="sap-kpi-tile">
                        <div class="sap-kpi-header">
                            <span class="sap-kpi-title">Total Revenue</span>
                            <div class="sap-kpi-icon">📈</div>
                        </div>
                        <div class="sap-kpi-value" id="kpi-revenue">...</div>
                        <div class="sap-kpi-footer">Posted Sales & Services</div>
                    </div>

                    <div class="sap-kpi-tile">
                        <div class="sap-kpi-header">
                            <span class="sap-kpi-title">Total Expenses</span>
                            <div class="sap-kpi-icon">📉</div>
                        </div>
                        <div class="sap-kpi-value" id="kpi-expenses">...</div>
                        <div class="sap-kpi-footer">COGS & Operating Expenses</div>
                    </div>

                    <div class="sap-kpi-tile">
                        <div class="sap-kpi-header">
                            <span class="sap-kpi-title">Net Profit</span>
                            <div class="sap-kpi-icon">💼</div>
                        </div>
                        <div class="sap-kpi-value" id="kpi-net-profit" style="color: #10b981;">...</div>
                        <div class="sap-kpi-footer">Net Margin (P&L Bottom Line)</div>
                    </div>

                    <div class="sap-kpi-tile">
                        <div class="sap-kpi-header">
                            <span class="sap-kpi-title">Cash & Bank Balance</span>
                            <div class="sap-kpi-icon">🏦</div>
                        </div>
                        <div class="sap-kpi-value" id="kpi-cash-bank" style="color: #0070f2;">...</div>
                        <div class="sap-kpi-footer">Liquid Operating Reserves</div>
                    </div>
                </div>

                <!-- KPI Tiles Row 2: Balance Sheet & Working Capital -->
                <div class="sap-kpi-grid">
                    <div class="sap-kpi-tile">
                        <div class="sap-kpi-header">
                            <span class="sap-kpi-title">Total Assets</span>
                            <div class="sap-kpi-icon">🏛️</div>
                        </div>
                        <div class="sap-kpi-value" id="kpi-assets">...</div>
                        <div class="sap-kpi-footer">Current & Fixed Capital</div>
                    </div>

                    <div class="sap-kpi-tile">
                        <div class="sap-kpi-header">
                            <span class="sap-kpi-title">Total Liabilities</span>
                            <div class="sap-kpi-icon">⚖️</div>
                        </div>
                        <div class="sap-kpi-value" id="kpi-liabilities">...</div>
                        <div class="sap-kpi-footer">Current & Long Term Obligations</div>
                    </div>

                    <div class="sap-kpi-tile">
                        <div class="sap-kpi-header">
                            <span class="sap-kpi-title">Accounts Receivable</span>
                            <div class="sap-kpi-icon">📄</div>
                        </div>
                        <div class="sap-kpi-value" id="kpi-ar">...</div>
                        <div class="sap-kpi-footer" id="kpi-ar-count">Outstanding Customer Invoices</div>
                    </div>

                    <div class="sap-kpi-tile">
                        <div class="sap-kpi-header">
                            <span class="sap-kpi-title">Accounts Payable</span>
                            <div class="sap-kpi-icon">📋</div>
                        </div>
                        <div class="sap-kpi-value" id="kpi-ap">...</div>
                        <div class="sap-kpi-footer" id="kpi-ap-count">Unsettled Vendor Bills</div>
                    </div>
                </div>

                <!-- Charts Section: Revenue vs Expenses & Expense Breakdown -->
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div class="sap-card">
                        <div class="sap-card-header">
                            <span class="sap-card-title">📊 Monthly Revenue vs Expenses (Fiscal Year 2026)</span>
                            <span style="font-size: 11px; color: var(--sap-text-muted);">Real-time GL Posting Totals</span>
                        </div>
                        <div class="sap-card-body" id="monthly-chart-container" style="min-height: 250px;">
                            <div style="text-align: center; padding: 60px; color: var(--sap-text-muted);">Loading chart...</div>
                        </div>
                    </div>

                    <div class="sap-card">
                        <div class="sap-card-header">
                            <span class="sap-card-title">🍩 Operating Expenses Breakdown</span>
                        </div>
                        <div class="sap-card-body" id="expense-donut-container" style="min-height: 250px;">
                            <div style="text-align: center; padding: 60px; color: var(--sap-text-muted);">Loading breakdown...</div>
                        </div>
                    </div>
                </div>

                <!-- Split Row: Recent Transactions & Upcoming Due Dates -->
                <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px;">
                    <div class="sap-card">
                        <div class="sap-card-header">
                            <span class="sap-card-title">📖 Recent General Ledger Postings</span>
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="App.navigate('gl-journals')">
                                View Full Ledger
                            </button>
                        </div>
                        <div class="sap-table-wrapper">
                            <table class="sap-table">
                                <thead>
                                    <tr>
                                        <th>Entry #</th>
                                        <th>Date</th>
                                        <th>Description</th>
                                        <th>Source</th>
                                        <th class="text-right">Debit / Credit</th>
                                        <th class="text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody id="recent-txns-body">
                                    <tr><td colspan="6" class="text-center">Loading transactions...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="sap-card">
                        <div class="sap-card-header">
                            <span class="sap-card-title">⏳ Upcoming Due Dates</span>
                        </div>
                        <div class="sap-card-body" style="padding: 12px 16px;">
                            <h4 style="font-size: 11.5px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Customer Invoices Receivable</h4>
                            <div id="upcoming-invoices-list" style="margin-bottom: 16px;">
                                <div style="color: #94a3b8; font-size: 12px;">Loading...</div>
                            </div>

                            <h4 style="font-size: 11.5px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Vendor Bills Payable</h4>
                            <div id="upcoming-bills-list">
                                <div style="color: #94a3b8; font-size: 12px;">Loading...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadData();
    },

    async loadData() {
        try {
            // Load KPIs
            const kpiData = await window.API.get('/api/dashboard/kpis');
            if (kpiData.kpis) {
                const k = kpiData.kpis;
                document.getElementById('kpi-revenue').textContent = `$${Number(k.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('kpi-expenses').textContent = `$${Number(k.totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('kpi-net-profit').textContent = `$${Number(k.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('kpi-cash-bank').textContent = `$${Number(k.cashAndBankBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('kpi-assets').textContent = `$${Number(k.totalAssets).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('kpi-liabilities').textContent = `$${Number(k.totalLiabilities).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('kpi-ar').textContent = `$${Number(k.accountsReceivable).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('kpi-ar-count').textContent = `${k.arCount} uncollected invoices`;
                document.getElementById('kpi-ap').textContent = `$${Number(k.accountsPayable).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('kpi-ap-count').textContent = `${k.apCount} pending vendor bills`;
            }

            // Load Charts
            const chartData = await window.API.get('/api/dashboard/charts');
            if (chartData.monthlyComparison) {
                EnterpriseCharts.renderMonthlyBarChart('monthly-chart-container', chartData.monthlyComparison);
            }
            if (chartData.expenseBreakdown) {
                EnterpriseCharts.renderDonutChart('expense-donut-container', chartData.expenseBreakdown);
            }

            // Load Recent Ledger Transactions
            const txnData = await window.API.get('/api/dashboard/recent-transactions');
            const tbody = document.getElementById('recent-txns-body');
            if (tbody && txnData.transactions) {
                if (txnData.transactions.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center">No transactions recorded yet.</td></tr>`;
                } else {
                    tbody.innerHTML = txnData.transactions.map(t => `
                        <tr>
                            <td class="font-mono"><strong>${t.entry_number}</strong></td>
                            <td>${t.posting_date}</td>
                            <td>${t.description}</td>
                            <td><span style="font-size: 11px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${t.source_module}</span></td>
                            <td class="text-right font-mono">$${Number(t.total_debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td class="text-center">
                                <span class="sap-badge ${t.is_reversed ? 'sap-badge-reversed' : 'sap-badge-posted'}">
                                    ${t.is_reversed ? 'REVERSED' : 'POSTED'}
                                </span>
                            </td>
                        </tr>
                    `).join('');
                }
            }

            // Load Upcoming Dues
            const dueData = await window.API.get('/api/dashboard/upcoming-dues');
            const invList = document.getElementById('upcoming-invoices-list');
            const billList = document.getElementById('upcoming-bills-list');

            if (invList && dueData.upcomingInvoices) {
                if (dueData.upcomingInvoices.length === 0) {
                    invList.innerHTML = `<div style="font-size: 12px; color: #94a3b8;">All customer invoices up to date.</div>`;
                } else {
                    invList.innerHTML = dueData.upcomingInvoices.map(i => `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted #e2e8f0; font-size: 12px;">
                            <div>
                                <span class="font-mono" style="font-weight: 600; color: #0070f2;">${i.invoice_number}</span>
                                <span style="color: #64748b; margin-left: 6px;">${i.customer_name}</span>
                            </div>
                            <div class="text-right font-mono">
                                <span style="font-weight: 700;">$${Number(i.amount_due).toLocaleString()}</span>
                                <div style="font-size: 10.5px; color: #e53935;">Due ${i.due_date}</div>
                            </div>
                        </div>
                    `).join('');
                }
            }

            if (billList && dueData.upcomingBills) {
                if (dueData.upcomingBills.length === 0) {
                    billList.innerHTML = `<div style="font-size: 12px; color: #94a3b8;">No vendor bills pending due.</div>`;
                } else {
                    billList.innerHTML = dueData.upcomingBills.map(b => `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted #e2e8f0; font-size: 12px;">
                            <div>
                                <span class="font-mono" style="font-weight: 600; color: #475569;">${b.bill_number}</span>
                                <span style="color: #64748b; margin-left: 6px;">${b.supplier_name}</span>
                            </div>
                            <div class="text-right font-mono">
                                <span style="font-weight: 700;">$${Number(b.amount_due).toLocaleString()}</span>
                                <div style="font-size: 10.5px; color: #f59e0b;">Due ${b.due_date}</div>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch (err) {
            window.App.showToast('Error loading dashboard metrics: ' + err.message, 'error');
        }
    }
};

window.DashboardView = DashboardView;
