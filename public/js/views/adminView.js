/**
 * Administration & Governance Module View
 * Handles Users & RBAC, Company Profile, Financial Years & Audit Trail Logs
 */

const AdminView = {
    currentTab: 'users',
    users: [],

    async render(container, subTab = 'users') {
        this.currentTab = subTab;

        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Administration & Governance</h1>
                    <div class="sap-page-subtitle">Security, Roles & Permissions, Entity Settings, Fiscal Years & Audit Trails</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="AdminView.downloadBackup()">
                        💾 Download Backup (.db)
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="AdminView.openUserModal()">
                        + New User
                    </button>
                </div>
            </div>

            <div class="sap-tabs-bar">
                <div class="sap-tab-item ${this.currentTab === 'users' ? 'active' : ''}" onclick="AdminView.switchTab('users')">
                    Users & Roles (RBAC)
                </div>
                <div class="sap-tab-item ${this.currentTab === 'company' ? 'active' : ''}" onclick="AdminView.switchTab('company')">
                    Company Settings
                </div>
                <div class="sap-tab-item ${this.currentTab === 'fiscal' ? 'active' : ''}" onclick="AdminView.switchTab('fiscal')">
                    Fiscal Years
                </div>
                <div class="sap-tab-item ${this.currentTab === 'audit' ? 'active' : ''}" onclick="AdminView.switchTab('audit')">
                    Audit Trail Logs
                </div>
            </div>

            <div class="sap-workspace-body" id="admin-tab-content">
                <!-- Tab body -->
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
        const content = document.getElementById('admin-tab-content');
        if (!content) return;

        if (this.currentTab === 'users') {
            await this.renderUsers(content);
        } else if (this.currentTab === 'company') {
            await this.renderCompany(content);
        } else if (this.currentTab === 'fiscal') {
            await this.renderFiscal(content);
        } else if (this.currentTab === 'audit') {
            await this.renderAudit(content);
        }
    },

    // 1. Users & RBAC
    async renderUsers(container) {
        container.innerHTML = `
            <div id="users-table-container">Loading Users...</div>
            <div class="sap-card" style="margin-top: 24px;">
                <div class="sap-card-header">
                    <span class="sap-card-title">🛡️ Role-Based Access Control (RBAC) Permission Matrix</span>
                </div>
                <div class="sap-table-wrapper">
                    <table class="sap-table">
                        <thead>
                            <tr>
                                <th>Role</th>
                                <th class="text-center">View Reports</th>
                                <th class="text-center">Create Transactions</th>
                                <th class="text-center">Post to GL</th>
                                <th class="text-center">Reverse Entries</th>
                                <th class="text-center">Reconcile Banks</th>
                                <th class="text-center">Administer Users</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td><strong>Super Admin</strong></td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td></tr>
                            <tr><td><strong>Admin</strong></td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td></tr>
                            <tr><td><strong>Finance Manager</strong></td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">-</td></tr>
                            <tr><td><strong>Accountant</strong></td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">✓</td><td class="text-center">-</td><td class="text-center">✓</td><td class="text-center">-</td></tr>
                            <tr><td><strong>Auditor</strong></td><td class="text-center">✓</td><td class="text-center">-</td><td class="text-center">-</td><td class="text-center">-</td><td class="text-center">✓</td><td class="text-center">-</td></tr>
                            <tr><td><strong>Viewer</strong></td><td class="text-center">✓</td><td class="text-center">-</td><td class="text-center">-</td><td class="text-center">-</td><td class="text-center">-</td><td class="text-center">-</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        try {
            const data = await window.API.get('/api/admin/users');
            this.users = data.users || [];

            new EnterpriseTable({
                containerId: 'users-table-container',
                title: 'Enterprise Users Register',
                exportName: 'Users_Register',
                columns: [
                    { key: 'username', label: 'Username', fontMono: true },
                    { key: 'full_name', label: 'Full Name' },
                    { key: 'email', label: 'Email' },
                    { 
                        key: 'role', 
                        label: 'Role',
                        render: (r) => `<span class="sap-badge sap-badge-posted">${r.role}</span>`
                    },
                    { key: 'department', label: 'Department' },
                    { key: 'last_login', label: 'Last Login' },
                    {
                        key: 'actions',
                        label: 'Simulate Role',
                        sortable: false,
                        render: (r) => `
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="App.switchRole('${r.role}')" title="Test platform with this role">
                                Switch to ${r.role}
                            </button>
                        `
                    }
                ],
                data: this.users
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 2. Company Settings
    async renderCompany(container) {
        container.innerHTML = 'Loading Company Settings...';
        try {
            const data = await window.API.get('/api/admin/company');
            const c = data.company;

            container.innerHTML = `
                <div class="sap-card" style="max-width: 800px;">
                    <div class="sap-card-header">
                        <span class="sap-card-title">🏢 Corporate Entity & Legal Setup</span>
                    </div>
                    <div class="sap-card-body">
                        <div class="sap-form-row">
                            <div class="sap-form-group">
                                <label class="sap-form-label">Brand Name *</label>
                                <input type="text" id="cmp-name" class="sap-input" value="${c.name || ''}">
                            </div>
                            <div class="sap-form-group">
                                <label class="sap-form-label">Legal Entity Name *</label>
                                <input type="text" id="cmp-legal" class="sap-input" value="${c.legal_name || ''}">
                            </div>
                        </div>
                        <div class="sap-form-row">
                            <div class="sap-form-group">
                                <label class="sap-form-label">Corporate Tax ID / Employer ID *</label>
                                <input type="text" id="cmp-tax" class="sap-input" value="${c.tax_id || ''}">
                            </div>
                            <div class="sap-form-group">
                                <label class="sap-form-label">Functional Currency *</label>
                                <input type="text" id="cmp-cur" class="sap-input" value="${c.currency || 'USD'}">
                            </div>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Headquarters Address</label>
                            <input type="text" id="cmp-addr" class="sap-input" value="${c.address || ''}">
                        </div>
                        <div class="sap-form-row">
                            <div class="sap-form-group">
                                <label class="sap-form-label">City</label>
                                <input type="text" id="cmp-city" class="sap-input" value="${c.city || ''}">
                            </div>
                            <div class="sap-form-group">
                                <label class="sap-form-label">Country</label>
                                <input type="text" id="cmp-country" class="sap-input" value="${c.country || 'United States'}">
                            </div>
                        </div>
                        <div class="sap-form-row">
                            <div class="sap-form-group">
                                <label class="sap-form-label">Phone</label>
                                <input type="text" id="cmp-phone" class="sap-input" value="${c.phone || ''}">
                            </div>
                            <div class="sap-form-group">
                                <label class="sap-form-label">Finance Email</label>
                                <input type="email" id="cmp-email" class="sap-input" value="${c.email || ''}">
                            </div>
                        </div>
                        <button class="sap-btn sap-btn-primary" style="margin-top: 10px;" onclick="AdminView.saveCompany()">
                            Save Company Settings
                        </button>
                    </div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    async saveCompany() {
        const name = document.getElementById('cmp-name').value;
        const legal_name = document.getElementById('cmp-legal').value;
        const tax_id = document.getElementById('cmp-tax').value;
        const currency = document.getElementById('cmp-cur').value;
        const address = document.getElementById('cmp-addr').value;
        const city = document.getElementById('cmp-city').value;
        const country = document.getElementById('cmp-country').value;
        const phone = document.getElementById('cmp-phone').value;
        const email = document.getElementById('cmp-email').value;

        try {
            const res = await window.API.put('/api/admin/company', {
                name, legal_name, tax_id, currency, address, city, country, phone, email
            });
            window.App.showToast(res.message, 'success');
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // 3. Fiscal Years
    async renderFiscal(container) {
        container.innerHTML = `<div id="fy-table-container">Loading Fiscal Years...</div>`;
        try {
            const data = await window.API.get('/api/admin/fiscal-years');
            new EnterpriseTable({
                containerId: 'fy-table-container',
                title: 'Fiscal Years Management',
                exportName: 'Fiscal_Years',
                columns: [
                    { key: 'name', label: 'Fiscal Year' },
                    { key: 'start_date', label: 'Start Date' },
                    { key: 'end_date', label: 'End Date' },
                    { key: 'is_active', label: 'Current Active FY', align: 'center', render: (r) => r.is_active ? `<span class="sap-badge sap-badge-posted">ACTIVE</span>` : `<span class="sap-badge sap-badge-draft">INACTIVE</span>` },
                    { key: 'is_closed', label: 'Closing Status', align: 'center', render: (r) => r.is_closed ? `<span class="sap-badge sap-badge-reversed">LOCKED (CLOSED)</span>` : `<span class="sap-badge sap-badge-posted">OPEN</span>` },
                    {
                        key: 'actions',
                        label: 'Year-End Close',
                        sortable: false,
                        render: (r) => !r.is_closed ? `
                            <button class="sap-btn sap-btn-danger sap-btn-sm" onclick="AdminView.closeFiscalYear(${r.id}, '${r.name}')">
                                Lock & Close Year
                            </button>
                        ` : `<span style="font-size: 11px; color: #64748b;">${r.closed_at || 'Closed'}</span>`
                    }
                ],
                data: data.fiscalYears || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    async closeFiscalYear(fyId, name) {
        if (!confirm(`Are you sure you want to lock and close ${name}? Once closed, all transactions for this period become immutable.`)) return;
        try {
            const res = await window.API.post(`/api/admin/fiscal-years/${fyId}/close`, {});
            window.App.showToast(res.message, 'success');
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // 4. Audit Trail Logs
    async renderAudit(container) {
        container.innerHTML = `<div id="audit-table-container">Loading Audit Logs...</div>`;
        try {
            const data = await window.API.get('/api/admin/audit-logs?limit=100');
            new EnterpriseTable({
                containerId: 'audit-table-container',
                title: 'System Activity & Accounting Audit Trail',
                searchPlaceholder: 'Search action, entity, user...',
                exportName: 'Audit_Trail_Logs',
                columns: [
                    { key: 'created_at', label: 'Timestamp' },
                    { key: 'username', label: 'User Actor' },
                    { key: 'action', label: 'Audit Action', fontMono: true },
                    { key: 'entity', label: 'Entity Target' },
                    { key: 'entity_id', label: 'Record ID' },
                    { key: 'details', label: 'Audit Details / Payload' },
                    { key: 'ip_address', label: 'IP Address' }
                ],
                data: data.rows || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    openUserModal() {
        let modalEl = document.getElementById('new-user-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'new-user-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">Create Enterprise User</div>
                    <button class="sap-modal-close" onclick="document.getElementById('new-user-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Username *</label>
                            <input type="text" id="usr-username" class="sap-input">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Full Name *</label>
                            <input type="text" id="usr-fullname" class="sap-input">
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Email Address *</label>
                            <input type="email" id="usr-email" class="sap-input">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Password *</label>
                            <input type="password" id="usr-pass" class="sap-input">
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Role *</label>
                            <select id="usr-role" class="sap-select">
                                <option value="Accountant">Accountant</option>
                                <option value="Finance Manager">Finance Manager</option>
                                <option value="Auditor">Auditor</option>
                                <option value="Viewer">Viewer</option>
                                <option value="Admin">Admin</option>
                                <option value="Super Admin">Super Admin</option>
                            </select>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Department</label>
                            <input type="text" id="usr-dept" class="sap-input" placeholder="e.g. Finance">
                        </div>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('new-user-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="AdminView.submitUser()">Save User</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitUser() {
        const username = document.getElementById('usr-username').value;
        const full_name = document.getElementById('usr-fullname').value;
        const email = document.getElementById('usr-email').value;
        const password = document.getElementById('usr-pass').value;
        const role = document.getElementById('usr-role').value;
        const department = document.getElementById('usr-dept').value;

        if (!username || !full_name || !email || !password) {
            window.App.showToast('Please fill all required user fields.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/admin/users', { username, full_name, email, password, role, department });
            window.App.showToast(res.message, 'success');
            document.getElementById('new-user-modal').classList.remove('active');
            this.loadCurrentTab();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    downloadBackup() {
        window.location.href = '/api/admin/backup';
    }
};

window.AdminView = AdminView;
