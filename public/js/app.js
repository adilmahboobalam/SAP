/**
 * ApexERP Central Application Orchestrator & Router
 * Manages view routing, global search, notifications, shell state, and active role switcher
 */

const App = {
    currentRoute: 'dashboard',
    activeUser: null,

    async init() {
        console.log('--- Initializing ApexERP Enterprise Financials ---');

        // Check authentication / profile
        try {
            const meData = await window.API.get('/api/auth/me');
            this.activeUser = meData.user;
            this.renderShellUserInfo();
        } catch (e) {
            console.warn('Using default administrator session:', e.message);
        }

        // Initialize Journal Modal Account Cache
        if (window.JournalModal) {
            await window.JournalModal.init();
        }

        // Setup Event Listeners
        this.setupNavigation();
        this.setupGlobalSearch();

        // Check hash route or default to dashboard
        const initialHash = window.location.hash.replace('#', '') || 'dashboard';
        this.navigate(initialHash);
    },

    renderShellUserInfo() {
        if (!this.activeUser) return;
        const nameEl = document.getElementById('shell-user-name');
        const roleEl = document.getElementById('shell-user-role');
        const avatarEl = document.getElementById('shell-user-avatar');

        if (nameEl) nameEl.textContent = this.activeUser.fullName || this.activeUser.username;
        if (roleEl) roleEl.textContent = this.activeUser.role;
        if (avatarEl) {
            const initials = (this.activeUser.fullName || this.activeUser.username).split(' ').map(n => n[0]).join('').substring(0, 2);
            avatarEl.textContent = initials.toUpperCase();
        }
    },

    setupNavigation() {
        // Handle Sidebar item clicks
        document.querySelectorAll('.sap-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = item.getAttribute('data-route');
                if (route) {
                    this.navigate(route);
                }
            });
        });

        // Sidebar collapse toggle
        const toggleBtn = document.getElementById('btn-toggle-sidebar');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                document.getElementById('app-sidebar')?.classList.toggle('collapsed');
            });
        }

        // Listen for browser popstate
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '');
            if (hash && hash !== this.currentRoute) {
                this.navigate(hash);
            }
        });
    },

    navigate(route) {
        this.currentRoute = route;
        window.location.hash = `#${route}`;

        // Update active sidebar state
        document.querySelectorAll('.sap-nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-route') === route);
        });

        const container = document.getElementById('main-workspace');
        if (!container) return;

        // Routing Map
        switch (route) {
            case 'dashboard':
                DashboardView.render(container);
                break;

            // Financial Accounting
            case 'gl':
            case 'gl-coa':
                GeneralLedgerView.render(container, 'coa');
                break;
            case 'gl-journals':
                GeneralLedgerView.render(container, 'journals');
                break;
            case 'gl-ledger':
                GeneralLedgerView.render(container, 'account-ledger');
                break;
            case 'gl-trial-balance':
                GeneralLedgerView.render(container, 'trial-balance');
                break;

            // Sales
            case 'sales-invoices':
                SalesView.render(container, 'invoices');
                break;
            case 'sales-customers':
                SalesView.render(container, 'customers');
                break;
            case 'sales-orders':
                SalesView.render(container, 'orders');
                break;
            case 'sales-payments':
                SalesView.render(container, 'payments');
                break;
            case 'sales-credit-notes':
                SalesView.render(container, 'credit-notes');
                break;

            // Purchases
            case 'purchases-bills':
                PurchasesView.render(container, 'bills');
                break;
            case 'purchases-suppliers':
                PurchasesView.render(container, 'suppliers');
                break;
            case 'purchases-orders':
                PurchasesView.render(container, 'orders');
                break;
            case 'purchases-payments':
                PurchasesView.render(container, 'payments');
                break;
            case 'purchases-debit-notes':
                PurchasesView.render(container, 'debit-notes');
                break;

            // Banking
            case 'banking-accounts':
                BankingView.render(container, 'accounts');
                break;
            case 'banking-transactions':
                BankingView.render(container, 'transactions');
                break;
            case 'banking-reconciliation':
                BankingView.render(container, 'reconciliations');
                break;

            // Management
            case 'expenses':
                ExpensesView.render(container);
                break;
            case 'inventory':
                InventoryView.render(container);
                break;
            case 'payroll':
            case 'payroll-runs':
                PayrollView.render(container, 'runs');
                break;
            case 'payroll-employees':
                PayrollView.render(container, 'employees');
                break;
            case 'tax':
                TaxView.render(container);
                break;

            // Reports
            case 'reports-pnl':
                ReportsView.render(container, 'pnl');
                break;
            case 'reports-balance-sheet':
                ReportsView.render(container, 'balance-sheet');
                break;
            case 'reports-cash-flow':
                ReportsView.render(container, 'cash-flow');
                break;
            case 'reports-trial-balance':
                ReportsView.render(container, 'trial-balance');
                break;
            case 'reports-gl':
                ReportsView.render(container, 'general-ledger');
                break;
            case 'reports-ar-aging':
                ReportsView.render(container, 'ar-aging');
                break;
            case 'reports-ap-aging':
                ReportsView.render(container, 'ap-aging');
                break;
            case 'reports-expenses':
                ReportsView.render(container, 'expenses');
                break;
            case 'reports-sales':
                ReportsView.render(container, 'sales');
                break;
            case 'reports-purchases':
                ReportsView.render(container, 'purchases');
                break;
            case 'reports-tax':
                ReportsView.render(container, 'tax');
                break;
            case 'reports-bank-rec':
                ReportsView.render(container, 'bank-rec');
                break;

            // Administration
            case 'admin-users':
                AdminView.render(container, 'users');
                break;
            case 'admin-company':
                AdminView.render(container, 'company');
                break;
            case 'admin-fiscal':
                AdminView.render(container, 'fiscal');
                break;
            case 'admin-audit':
                AdminView.render(container, 'audit');
                break;

            default:
                DashboardView.render(container);
        }
    },

    setupGlobalSearch() {
        const searchInput = document.getElementById('global-search-input');
        if (!searchInput) return;

        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            if (!query) {
                this.closeSearchResults();
                return;
            }

            debounceTimer = setTimeout(() => {
                this.performGlobalSearch(query);
            }, 250);
        });

        // Close on escape or outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#global-search-container')) {
                this.closeSearchResults();
            }
        });
    },

    async performGlobalSearch(query) {
        let resultsBox = document.getElementById('global-search-results');
        if (!resultsBox) {
            resultsBox = document.createElement('div');
            resultsBox.id = 'global-search-results';
            resultsBox.style.cssText = `
                position: absolute; top: 38px; left: 0; right: 0;
                background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.15); max-height: 380px; overflow-y: auto;
                z-index: 9999; color: #1e293b; padding: 6px 0; font-size: 12px;
            `;
            document.getElementById('global-search-container')?.appendChild(resultsBox);
        }

        try {
            const [custData, suppData, invData, jeData] = await Promise.all([
                window.API.get('/api/sales/customers'),
                window.API.get('/api/purchases/suppliers'),
                window.API.get('/api/sales/invoices'),
                window.API.get('/api/gl/journals?search=' + encodeURIComponent(query))
            ]);

            const q = query.toLowerCase();
            const customers = (custData.customers || []).filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)).slice(0, 3);
            const suppliers = (suppData.suppliers || []).filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)).slice(0, 3);
            const invoices = (invData.invoices || []).filter(i => i.invoice_number.toLowerCase().includes(q) || i.customer_name.toLowerCase().includes(q)).slice(0, 4);
            const journals = (jeData.entries || []).slice(0, 3);

            let html = '';
            if (customers.length) {
                html += `<div style="padding: 6px 12px; font-weight: 700; color: #64748b; background: #f8fafc; font-size: 11px;">CUSTOMERS</div>`;
                customers.forEach(c => {
                    html += `<div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9;" onclick="App.navigate('sales-customers'); App.closeSearchResults();">
                        <strong>${c.code}</strong> - ${c.name}
                    </div>`;
                });
            }

            if (suppliers.length) {
                html += `<div style="padding: 6px 12px; font-weight: 700; color: #64748b; background: #f8fafc; font-size: 11px;">SUPPLIERS</div>`;
                suppliers.forEach(s => {
                    html += `<div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9;" onclick="App.navigate('purchases-suppliers'); App.closeSearchResults();">
                        <strong>${s.code}</strong> - ${s.name}
                    </div>`;
                });
            }

            if (invoices.length) {
                html += `<div style="padding: 6px 12px; font-weight: 700; color: #64748b; background: #f8fafc; font-size: 11px;">SALES INVOICES</div>`;
                invoices.forEach(i => {
                    html += `<div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9;" onclick="App.navigate('sales-invoices'); App.closeSearchResults();">
                        <strong>${i.invoice_number}</strong> • ${i.customer_name} ($${Number(i.total_amount).toLocaleString()})
                    </div>`;
                });
            }

            if (journals.length) {
                html += `<div style="padding: 6px 12px; font-weight: 700; color: #64748b; background: #f8fafc; font-size: 11px;">JOURNAL VOUCHERS</div>`;
                journals.forEach(j => {
                    html += `<div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9;" onclick="App.navigate('gl-journals'); App.closeSearchResults();">
                        <strong>${j.entry_number}</strong>: ${j.description} ($${Number(j.total_debit).toLocaleString()})
                    </div>`;
                });
            }

            if (!html) {
                html = `<div style="padding: 16px; text-align: center; color: #94a3b8;">No matching enterprise records found.</div>`;
            }

            resultsBox.innerHTML = html;
            resultsBox.style.display = 'block';
        } catch (e) {
            resultsBox.innerHTML = `<div style="padding: 12px; color: red;">Search error: ${e.message}</div>`;
        }
    },

    closeSearchResults() {
        const resultsBox = document.getElementById('global-search-results');
        if (resultsBox) resultsBox.style.display = 'none';
    },

    // Interactive Role Switcher Modal
    openRoleSwitcher() {
        let modalEl = document.getElementById('role-switcher-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'role-switcher-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const roles = [
            { role: 'Super Admin', user: 'Alexander Wright', desc: 'Full enterprise control, posting, reversing, RBAC admin' },
            { role: 'Finance Manager', user: 'Elena Vance, CPA', desc: 'Financial statements, GL postings, journal reversals, approvals' },
            { role: 'Accountant', user: 'Marcus Brooks', desc: 'Daily bookkeeping, customer billing, vendor bills, bank transfers' },
            { role: 'Auditor', user: 'Sophia Chen', desc: 'Read-only audit trail verification, trial balances, reconciliation check' },
            { role: 'Viewer', user: 'David Miller', desc: 'Read-only financial statement inspection' }
        ];

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">🎭 Switch Active Role (RBAC Simulation)</div>
                    <button class="sap-modal-close" onclick="document.getElementById('role-switcher-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 14px;">
                        Select a user role to simulate its specific enterprise permissions and workflows:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${roles.map(r => `
                            <div style="padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; transition: all 0.15s; background: ${this.activeUser && this.activeUser.role === r.role ? '#ebf4fe' : '#ffffff'};"
                                 onclick="App.switchRole('${r.role}')" onmouseover="this.style.borderColor='#0070f2'" onmouseout="this.style.borderColor='#e2e8f0'">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <strong style="color: #0070f2;">${r.role}</strong>
                                    <span style="font-size: 11px; color: #64748b;">${r.user}</span>
                                </div>
                                <div style="font-size: 11.5px; color: #475569; margin-top: 3px;">${r.desc}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('role-switcher-modal').classList.remove('active')">Cancel</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async switchRole(targetRole) {
        try {
            const res = await window.API.post('/api/auth/switch-role', { role: targetRole });
            window.API.setSession(res.token, res.user);
            this.activeUser = res.user;
            this.renderShellUserInfo();

            const modal = document.getElementById('role-switcher-modal');
            if (modal) modal.classList.remove('active');

            this.showToast(`Switched active persona to ${res.user.fullName} (${res.user.role})`, 'success');
            this.navigate(this.currentRoute);
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    showToast(message, type = 'info') {
        let container = document.getElementById('sap-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sap-toast-container';
            container.className = 'sap-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `sap-toast ${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
            <div style="flex: 1;">${message}</div>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.2s';
            setTimeout(() => toast.remove(), 200);
        }, 4000);
    }
};

window.App = App;

// Bootstrap on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
