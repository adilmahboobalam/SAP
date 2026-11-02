/**
 * Employee & Payroll Management Module View
 * Handles Staff Records, Salary Allowances/Deductions, Monthly Payroll Processing & Payslips
 */

const PayrollView = {
    currentTab: 'runs',
    employees: [],
    departments: [],
    bankAccounts: [],

    async render(container, subTab = 'runs') {
        this.currentTab = subTab;

        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Employee & Payroll Management</h1>
                    <div class="sap-page-subtitle">Personnel Records, Compensation, Statutory Withholdings & Monthly Payroll Postings</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="PayrollView.openEmployeeModal()">
                        + New Employee
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="PayrollView.openPayrollModal()">
                        ⚡ Run Monthly Payroll
                    </button>
                </div>
            </div>

            <div class="sap-tabs-bar">
                <div class="sap-tab-item ${this.currentTab === 'runs' ? 'active' : ''}" onclick="PayrollView.switchTab('runs')">
                    Payroll Runs & Journal Vouchers
                </div>
                <div class="sap-tab-item ${this.currentTab === 'employees' ? 'active' : ''}" onclick="PayrollView.switchTab('employees')">
                    Employee Directory
                </div>
                <div class="sap-tab-item ${this.currentTab === 'departments' ? 'active' : ''}" onclick="PayrollView.switchTab('departments')">
                    Departments Cost Centers
                </div>
            </div>

            <div class="sap-workspace-body" id="payroll-tab-content">
                <!-- Tab Content -->
            </div>
        `;

        await this.loadDependencies();
        await this.loadCurrentTab();
    },

    async loadDependencies() {
        try {
            const [empData, deptData, bankData] = await Promise.all([
                window.API.get('/api/payroll/employees'),
                window.API.get('/api/payroll/departments'),
                window.API.get('/api/banking/accounts')
            ]);
            this.employees = empData.employees || [];
            this.departments = deptData.departments || [];
            this.bankAccounts = bankData.accounts || [];
        } catch (e) {
            console.error('Failed to load payroll dependencies:', e);
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
        const content = document.getElementById('payroll-tab-content');
        if (!content) return;

        if (this.currentTab === 'runs') {
            await this.renderRuns(content);
        } else if (this.currentTab === 'employees') {
            await this.renderEmployees(content);
        } else if (this.currentTab === 'departments') {
            await this.renderDepartments(content);
        }
    },

    // 1. Payroll Runs Tab
    async renderRuns(container) {
        container.innerHTML = `<div id="runs-table-container">Loading Payroll Runs...</div>`;
        try {
            const data = await window.API.get('/api/payroll/runs');
            new EnterpriseTable({
                containerId: 'runs-table-container',
                title: 'Monthly Enterprise Payroll Processings',
                exportName: 'Payroll_Runs',
                columns: [
                    { key: 'run_number', label: 'Run #', fontMono: true },
                    { key: 'period_name', label: 'Pay Period' },
                    { key: 'payment_date', label: 'Disbursement Date' },
                    { key: 'employee_count', label: 'Staff Count', align: 'center' },
                    { 
                        key: 'total_basic', 
                        label: 'Basic Pay ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_basic).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'total_tax', 
                        label: 'Tax Withheld ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'net_payroll', 
                        label: 'Net Payroll ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong style="color: #0070f2;">$${Number(r.net_payroll).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
                    },
                    { key: 'journal_entry_number', label: 'GL Journal', fontMono: true },
                    { key: 'status', label: 'Status', align: 'center', render: (r) => `<span class="sap-badge sap-badge-posted">${r.status}</span>` },
                    {
                        key: 'actions',
                        label: 'Payslips',
                        sortable: false,
                        render: (r) => `
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="PayrollView.viewPayslips(${r.id})">
                                Payslips
                            </button>
                        `
                    }
                ],
                data: data.runs || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 2. Employees Tab
    async renderEmployees(container) {
        container.innerHTML = `<div id="employees-table-container">Loading Employees...</div>`;
        try {
            const data = await window.API.get('/api/payroll/employees');
            this.employees = data.employees || [];

            new EnterpriseTable({
                containerId: 'employees-table-container',
                title: 'Corporate Employee Roster & Compensation',
                searchPlaceholder: 'Search employee code, name, department...',
                exportName: 'Employees_Roster',
                columns: [
                    { key: 'employee_code', label: 'Employee ID', fontMono: true },
                    { key: (r) => `${r.first_name} ${r.last_name}`, label: 'Full Name' },
                    { key: 'department_name', label: 'Department' },
                    { key: 'position', label: 'Corporate Title' },
                    { 
                        key: 'basic_salary', 
                        label: 'Monthly Base ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'allowances', 
                        label: 'Allowances ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.allowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'gross_salary', 
                        label: 'Gross Compensation', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong>$${Number(r.gross_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>`
                    },
                    { key: 'status', label: 'Status', align: 'center', render: (r) => `<span class="sap-badge sap-badge-posted">${r.status}</span>` }
                ],
                data: this.employees
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // 3. Departments Tab
    async renderDepartments(container) {
        container.innerHTML = `<div id="departments-table-container">Loading Departments...</div>`;
        try {
            const data = await window.API.get('/api/payroll/departments');
            new EnterpriseTable({
                containerId: 'departments-table-container',
                title: 'Department Cost Centers',
                exportName: 'Departments',
                columns: [
                    { key: 'code', label: 'Code', fontMono: true },
                    { key: 'name', label: 'Department Name' },
                    { key: 'employee_count', label: 'Headcount', align: 'center' },
                    { 
                        key: 'monthly_payroll_cost', 
                        label: 'Monthly Payroll Cost ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.monthly_payroll_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    }
                ],
                data: data.departments || []
            });
        } catch (err) {
            container.innerHTML = `<div class="sap-card" style="padding: 20px; color: red;">Error: ${err.message}</div>`;
        }
    },

    // Process Monthly Payroll Modal
    openPayrollModal() {
        let modalEl = document.getElementById('run-payroll-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'run-payroll-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        const today = new Date().toISOString().split('T')[0];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const currentMonthName = `${monthNames[new Date().getMonth()]} ${new Date().getFullYear()}`;

        // Calculate active headcount cost preview
        let totalGross = 0;
        this.employees.forEach(e => {
            if (e.status === 'ACTIVE') totalGross += (e.basic_salary + e.allowances);
        });
        const estTax = Math.round(totalGross * 0.18 * 100) / 100;
        const estDed = Math.round(totalGross * 0.05 * 100) / 100;
        const estNet = Math.round((totalGross - estTax - estDed) * 100) / 100;

        modalEl.innerHTML = `
            <div class="sap-modal modal-lg">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">⚡ Process Monthly Payroll Run</div>
                    <button class="sap-modal-close" onclick="document.getElementById('run-payroll-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Period Name *</label>
                            <input type="text" id="pr-period-name" class="sap-input" value="${currentMonthName}">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Disbursement Date *</label>
                            <input type="date" id="pr-pay-date" class="sap-input" value="${today}">
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Period Start Date *</label>
                            <input type="date" id="pr-start-date" class="sap-input" value="2026-02-01">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Period End Date *</label>
                            <input type="date" id="pr-end-date" class="sap-input" value="2026-02-28">
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Payout Bank Account (Wells Fargo Payroll) *</label>
                        <select id="pr-bank-id" class="sap-select">
                            ${this.bankAccounts.map(b => `<option value="${b.id}">${b.bank_name} ($${Number(b.current_balance).toLocaleString()})</option>`).join('')}
                        </select>
                    </div>

                    <!-- Payroll Calculation Preview -->
                    <div style="background: #f8fafc; border: 1px solid var(--sap-border-color); border-radius: 6px; padding: 16px; margin-top: 14px;">
                        <h4 style="font-size: 12.5px; font-weight: 700; color: #1e293b; margin-bottom: 10px;">Automated Payroll Calculation Summary (${this.employees.length} Staff)</h4>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; font-family: monospace;">
                            <div>
                                <div style="font-size: 11px; color: #64748b;">Gross Payroll:</div>
                                <strong style="font-size: 14px; color: #0f172a;">$${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #64748b;">Tax Withholding (18%):</div>
                                <strong style="font-size: 14px; color: #e53935;">-$${estTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #64748b;">Deductions / Ins (5%):</div>
                                <strong style="font-size: 14px; color: #e53935;">-$${estDed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #64748b;">Net Payout:</div>
                                <strong style="font-size: 16px; color: #0070f2;">$${estNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                            </div>
                        </div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 10px;">
                            * Submitting will automatically generate individual payslips and post the double-entry payroll voucher: 
                            <strong>Dr Salaries & Wages (60300)</strong>, <strong>Cr Payroll Taxes Payable (22100)</strong>, <strong>Cr Bank Account</strong>.
                        </div>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('run-payroll-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="PayrollView.submitPayroll()">✓ Post & Disburse Payroll</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitPayroll() {
        const period_name = document.getElementById('pr-period-name').value;
        const payment_date = document.getElementById('pr-pay-date').value;
        const start_date = document.getElementById('pr-start-date').value;
        const end_date = document.getElementById('pr-end-date').value;
        const bank_account_id = document.getElementById('pr-bank-id').value;

        if (!period_name || !payment_date || !start_date || !end_date) {
            window.App.showToast('Please fill all required payroll dates.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/payroll/runs', {
                period_name, payment_date, start_date, end_date, bank_account_id, auto_post: true
            });

            window.App.showToast(res.message, 'success');
            document.getElementById('run-payroll-modal').classList.remove('active');
            this.switchTab('runs');
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // View Payslips for a run
    async viewPayslips(runId) {
        try {
            const data = await window.API.get(`/api/payroll/runs/${runId}`);
            const run = data.run;
            const slips = run.payslips || [];

            let modalEl = document.getElementById('payslips-modal');
            if (!modalEl) {
                modalEl = document.createElement('div');
                modalEl.id = 'payslips-modal';
                modalEl.className = 'sap-modal-backdrop';
                document.body.appendChild(modalEl);
            }

            modalEl.innerHTML = `
                <div class="sap-modal modal-xl">
                    <div class="sap-modal-header">
                        <div class="sap-modal-title">📄 Payslips for ${run.period_name} (${run.run_number})</div>
                        <div style="display: flex; gap: 8px;">
                            <button class="sap-btn sap-btn-secondary sap-btn-sm" onclick="window.print()">🖨️ Print All Payslips</button>
                            <button class="sap-modal-close" onclick="document.getElementById('payslips-modal').classList.remove('active')">×</button>
                        </div>
                    </div>
                    <div class="sap-modal-body">
                        <table class="sap-table">
                            <thead>
                                <tr>
                                    <th>Emp ID</th>
                                    <th>Staff Name</th>
                                    <th>Title</th>
                                    <th class="text-right">Base Salary</th>
                                    <th class="text-right">Allowances</th>
                                    <th class="text-right">Tax Withheld</th>
                                    <th class="text-right">Deductions</th>
                                    <th class="text-right">Net Compensation</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${slips.map(s => `
                                    <tr>
                                        <td class="font-mono"><strong>${s.employee_code}</strong></td>
                                        <td>${s.first_name} ${s.last_name}</td>
                                        <td>${s.position}</td>
                                        <td class="text-right font-mono">$${Number(s.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td class="text-right font-mono">$${Number(s.allowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td class="text-right font-mono" style="color: #e53935;">-$${Number(s.tax_withheld).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td class="text-right font-mono" style="color: #e53935;">-$${Number(s.deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td class="text-right font-mono" style="font-weight: 700; color: #0070f2;">$${Number(s.net_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td><span class="sap-badge sap-badge-paid">${s.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="sap-modal-footer">
                        <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('payslips-modal').classList.remove('active')">Close</button>
                    </div>
                </div>
            `;
            modalEl.classList.add('active');
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // New Employee Modal
    openEmployeeModal() {
        let modalEl = document.getElementById('new-emp-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'new-emp-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">Register Employee</div>
                    <button class="sap-modal-close" onclick="document.getElementById('new-emp-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">First Name *</label>
                            <input type="text" id="emp-first" class="sap-input">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Last Name *</label>
                            <input type="text" id="emp-last" class="sap-input">
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Department *</label>
                            <select id="emp-dept-id" class="sap-select">
                                ${this.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Position Title *</label>
                            <input type="text" id="emp-pos" class="sap-input" placeholder="e.g. Senior Financial Analyst">
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Basic Monthly Salary ($) *</label>
                            <input type="number" step="100" id="emp-basic" class="sap-input" placeholder="e.g. 7500">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Allowances ($)</label>
                            <input type="number" step="50" id="emp-allow" class="sap-input" value="0">
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Bank Name</label>
                            <input type="text" id="emp-bank" class="sap-input" placeholder="Chase / Wells Fargo">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Account Number</label>
                            <input type="text" id="emp-acc" class="sap-input" placeholder="Direct deposit account">
                        </div>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('new-emp-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="PayrollView.submitEmployee()">Save Employee</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitEmployee() {
        const first_name = document.getElementById('emp-first').value;
        const last_name = document.getElementById('emp-last').value;
        const department_id = document.getElementById('emp-dept-id').value;
        const position = document.getElementById('emp-pos').value;
        const basic_salary = Number(document.getElementById('emp-basic').value) || 0;
        const allowances = Number(document.getElementById('emp-allow').value) || 0;
        const bank_name = document.getElementById('emp-bank').value;
        const bank_account = document.getElementById('emp-acc').value;

        if (!first_name || !last_name || !position || !basic_salary) {
            window.App.showToast('Please fill all required employee details.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/payroll/employees', {
                first_name, last_name, department_id, position, basic_salary, allowances, bank_name, bank_account
            });
            window.App.showToast(res.message, 'success');
            document.getElementById('new-emp-modal').classList.remove('active');
            await this.loadDependencies();
            this.switchTab('employees');
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    }
};

window.PayrollView = PayrollView;
