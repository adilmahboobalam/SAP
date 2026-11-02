/**
 * Reusable Enterprise Table Component
 * Supports column sorting, search query filtering, pagination, and CSV export
 */

class EnterpriseTable {
    constructor({
        containerId,
        columns = [],
        data = [],
        title = '',
        searchPlaceholder = 'Search records...',
        pageSize = 10,
        actions = [],
        exportName = 'export',
        emptyMessage = 'No records found.'
    }) {
        this.container = document.getElementById(containerId);
        this.columns = columns;
        this.rawDta = [...data];
        this.filteredData = [...data];
        this.title = title;
        this.searchPlaceholder = searchPlaceholder;
        this.pageSize = pageSize;
        this.currentPage = 1;
        this.sortKey = null;
        this.sortAsc = true;
        this.searchQuery = '';
        this.actions = actions;
        this.exportName = exportName;
        this.emptyMessage = emptyMessage;

        this.render();
    }

    setData(newData) {
        this.rawDta = [...newData];
        this.applyFilter();
    }

    applyFilter() {
        if (!this.searchQuery) {
            this.filteredData = [...this.rawDta];
        } else {
            const q = this.searchQuery.toLowerCase();
            this.filteredData = this.rawDta.filter(row => {
                return this.columns.some(col => {
                    const val = typeof col.key === 'function' ? col.key(row) : row[col.key];
                    return String(val || '').toLowerCase().includes(q);
                });
            });
        }

        if (this.sortKey) {
            this.filteredData.sort((a, b) => {
                let valA = typeof this.sortKey === 'function' ? this.sortKey(a) : a[this.sortKey];
                let valB = typeof this.sortKey === 'function' ? this.sortKey(b) : b[this.sortKey];

                if (valA === null || valA === undefined) valA = '';
                if (valB === null || valB === undefined) valB = '';

                if (typeof valA === 'number' && typeof valB === 'number') {
                    return this.sortAsc ? valA - valB : valB - valA;
                }
                const cmp = String(valA).localeCompare(String(valB));
                return this.sortAsc ? cmp : -cmp;
            });
        }

        this.currentPage = 1;
        this.renderBody();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="sap-card">
                <div class="sap-table-toolbar">
                    <div class="sap-toolbar-left">
                        ${this.title ? `<span class="sap-card-title">${this.title}</span>` : ''}
                        <input type="text" class="sap-input table-search-input" placeholder="${this.searchPlaceholder}" style="width: 220px;" value="${this.searchQuery}">
                    </div>
                    <div class="sap-toolbar-right">
                        ${this.actions.map(act => `
                            <button class="sap-btn ${act.btnClass || 'sap-btn-secondary'} sap-btn-sm" data-action="${act.name}">
                                ${act.icon || ''} ${act.label}
                            </button>
                        `).join('')}
                        <button class="sap-btn sap-btn-secondary sap-btn-sm btn-export-csv" title="Export CSV">
                            📥 Export CSV
                        </button>
                    </div>
                </div>
                <div class="sap-table-wrapper">
                    <table class="sap-table">
                        <thead>
                            <tr>
                                ${this.columns.map(col => `
                                    <th class="${col.sortable !== false ? 'sortable' : ''} ${col.align === 'right' ? 'text-right' : ''}" data-col="${typeof col.key === 'string' ? col.key : ''}">
                                        ${col.label}
                                        <span class="sort-indicator" data-sort-for="${typeof col.key === 'string' ? col.key : ''}"></span>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody class="table-body">
                            <!-- Rows rendered dynamically -->
                        </tbody>
                    </table>
                </div>
                <div class="sap-pagination">
                    <div class="pagination-info">Showing 0 of 0 records</div>
                    <div class="sap-pagination-controls">
                        <button class="sap-btn sap-btn-secondary sap-btn-sm btn-prev-page">« Prev</button>
                        <span class="page-indicator">1 / 1</span>
                        <button class="sap-btn sap-btn-secondary sap-btn-sm btn-next-page">Next »</button>
                    </div>
                </div>
            </div>
        `;

        // Bind events
        const searchInput = this.container.querySelector('.table-search-input');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.applyFilter();
        });

        this.container.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const colKey = th.getAttribute('data-col');
                if (!colKey) return;
                if (this.sortKey === colKey) {
                    this.sortAsc = !this.sortAsc;
                } else {
                    this.sortKey = colKey;
                    this.sortAsc = true;
                }
                this.applyFilter();
            });
        });

        this.container.querySelector('.btn-export-csv').addEventListener('click', () => {
            window.API.exportToCsv(this.exportName, this.filteredData, this.columns);
        });

        this.container.querySelector('.btn-prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderBody();
            }
        });

        this.container.querySelector('.btn-next-page').addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredData.length / this.pageSize) || 1;
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderBody();
            }
        });

        // Custom action clicks
        this.actions.forEach(act => {
            const btn = this.container.querySelector(`[data-action="${act.name}"]`);
            if (btn && act.onClick) {
                btn.addEventListener('click', () => act.onClick(this.filteredData));
            }
        });

        this.renderBody();
    }

    renderBody() {
        const tbody = this.container.querySelector('.table-body');
        const paginationInfo = this.container.querySelector('.pagination-info');
        const pageIndicator = this.container.querySelector('.page-indicator');
        const prevBtn = this.container.querySelector('.btn-prev-page');
        const nextBtn = this.container.querySelector('.btn-next-page');

        if (!tbody) return;

        const total = this.filteredData.length;
        const totalPages = Math.ceil(total / this.pageSize) || 1;
        const startIdx = (this.currentPage - 1) * this.pageSize;
        const pageItems = this.filteredData.slice(startIdx, startIdx + this.pageSize);

        if (total === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${this.columns.length}" class="text-center" style="padding: 30px; color: var(--sap-text-muted);">
                        ${this.emptyMessage}
                    </td>
                </tr>
            `;
            paginationInfo.textContent = 'Showing 0 of 0 records';
            pageIndicator.textContent = 'Page 1 of 1';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }

        tbody.innerHTML = pageItems.map(row => `
            <tr>
                ${this.columns.map(col => {
                    let content = '';
                    if (col.render) {
                        content = col.render(row);
                    } else if (typeof col.key === 'function') {
                        content = col.key(row);
                    } else {
                        content = row[col.key];
                    }
                    if (content === null || content === undefined) content = '-';

                    return `<td class="${col.align === 'right' ? 'text-right' : ''} ${col.fontMono ? 'font-mono' : ''}">${content}</td>`;
                }).join('')}
            </tr>
        `).join('');

        paginationInfo.textContent = `Showing ${startIdx + 1} to ${Math.min(startIdx + this.pageSize, total)} of ${total} records`;
        pageIndicator.textContent = `Page ${this.currentPage} of ${totalPages}`;
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= totalPages;

        // Update sort indicators
        this.container.querySelectorAll('.sort-indicator').forEach(el => {
            const forCol = el.getAttribute('data-sort-for');
            if (forCol === this.sortKey) {
                el.textContent = this.sortAsc ? ' ↑' : ' ↓';
            } else {
                el.textContent = '';
            }
        });
    }
}

window.EnterpriseTable = EnterpriseTable;
