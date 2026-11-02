/**
 * Inventory Management Module View
 * Handles Products, Stock Deductions/Additions, Stock Adjustments & Inventory Valuation
 */

const InventoryView = {
    products: [],

    async render(container) {
        container.innerHTML = `
            <div class="sap-workspace-header">
                <div class="sap-page-title-group">
                    <h1>Inventory & Materials Management</h1>
                    <div class="sap-page-subtitle">Product SKUs, Stock Movements, Adjustments & Asset Valuation</div>
                </div>
                <div class="sap-page-actions">
                    <button class="sap-btn sap-btn-secondary" onclick="InventoryView.openAdjustmentModal()">
                        ⚖️ Stock Adjustment
                    </button>
                    <button class="sap-btn sap-btn-primary" onclick="InventoryView.openProductModal()">
                        + Add Product SKU
                    </button>
                </div>
            </div>

            <div class="sap-workspace-body">
                <div id="inventory-valuation-card" style="margin-bottom: 20px;"></div>
                <div id="products-table-container">Loading Inventory...</div>
                <div id="movements-table-container" style="margin-top: 24px;">Loading Stock Movements...</div>
            </div>
        `;

        await this.loadData();
    },

    async loadData() {
        try {
            const [valData, prodData, moveData] = await Promise.all([
                window.API.get('/api/inventory/valuation'),
                window.API.get('/api/inventory/products'),
                window.API.get('/api/inventory/movements')
            ]);

            this.products = prodData.products || [];

            // Valuation banner
            const cardEl = document.getElementById('inventory-valuation-card');
            if (cardEl) {
                cardEl.innerHTML = `
                    <div style="background: #ffffff; border: 1px solid var(--sap-border-color); border-radius: 6px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <div style="font-size: 11.5px; text-transform: uppercase; color: #64748b; font-weight: 600;">Total Inventory Asset Valuation (General Ledger)</div>
                            <div style="font-size: 26px; font-weight: 800; color: #0070f2; font-family: monospace;">
                                $${Number(valData.totalInventoryValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div style="font-size: 12px; color: #475569;">
                            Active SKUs: <strong>${this.products.length}</strong>
                        </div>
                    </div>
                `;
            }

            // Products Table
            new EnterpriseTable({
                containerId: 'products-table-container',
                title: 'Product Catalog & Current Stock Levels',
                searchPlaceholder: 'Search SKU, product name...',
                exportName: 'Inventory_Products',
                columns: [
                    { key: 'sku', label: 'SKU / Code', fontMono: true },
                    { key: 'name', label: 'Product Name' },
                    { key: 'category_name', label: 'Category' },
                    { key: 'unit', label: 'Unit' },
                    { 
                        key: 'cost_price', 
                        label: 'Cost Price ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.cost_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'selling_price', 
                        label: 'Selling Price ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.selling_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { 
                        key: 'current_stock', 
                        label: 'Stock On-Hand', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `<strong>${r.current_stock}</strong>`
                    },
                    { 
                        key: 'inventory_value', 
                        label: 'Asset Value ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.inventory_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    {
                        key: 'is_low_stock',
                        label: 'Stock Status',
                        align: 'center',
                        render: (r) => r.is_low_stock ? `<span class="sap-badge sap-badge-overdue">⚠️ Low Stock</span>` : `<span class="sap-badge sap-badge-posted">In Stock</span>`
                    }
                ],
                data: this.products
            });

            // Stock Movements Table
            new EnterpriseTable({
                containerId: 'movements-table-container',
                title: 'Stock Ledger & Movement History',
                exportName: 'Stock_Movements',
                columns: [
                    { key: 'movement_date', label: 'Date' },
                    { key: 'sku', label: 'SKU', fontMono: true },
                    { key: 'product_name', label: 'Product' },
                    { 
                        key: 'movement_type', 
                        label: 'Type',
                        render: (r) => {
                            const isAdd = r.movement_type.includes('IN') || r.movement_type === 'PURCHASE';
                            return `<span style="font-weight: 600; color: ${isAdd ? '#10b981' : '#e53935'};">${r.movement_type}</span>`;
                        }
                    },
                    { key: 'quantity', label: 'Quantity', align: 'right', fontMono: true },
                    { 
                        key: 'total_cost', 
                        label: 'Cost Value ($)', 
                        align: 'right', 
                        fontMono: true,
                        render: (r) => `$${Number(r.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    },
                    { key: 'reference', label: 'Document Ref' },
                    { key: 'notes', label: 'Notes' },
                    { key: 'journal_entry_number', label: 'GL Journal', fontMono: true }
                ],
                data: moveData.movements || []
            });
        } catch (err) {
            window.App.showToast('Error loading inventory: ' + err.message, 'error');
        }
    },

    openProductModal() {
        let modalEl = document.getElementById('new-product-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'new-product-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">Add Product SKU</div>
                    <button class="sap-modal-close" onclick="document.getElementById('new-product-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Product SKU *</label>
                            <input type="text" id="prod-sku" class="sap-input" placeholder="e.g. SKU-HW-770">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Unit of Measure</label>
                            <input type="text" id="prod-unit" class="sap-input" value="Unit">
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Product Name *</label>
                        <input type="text" id="prod-name" class="sap-input" placeholder="e.g. Rack Server Appliance">
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Cost Price ($) *</label>
                            <input type="number" step="0.01" min="0" id="prod-cost" class="sap-input" value="0.00">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Selling Price ($) *</label>
                            <input type="number" step="0.01" min="0" id="prod-price" class="sap-input" value="0.00">
                        </div>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Initial Stock Quantity</label>
                            <input type="number" min="0" id="prod-stock" class="sap-input" value="10">
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Reorder Level Alert</label>
                            <input type="number" min="0" id="prod-reorder" class="sap-input" value="5">
                        </div>
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('new-product-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="InventoryView.submitProduct()">Save Product</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitProduct() {
        const sku = document.getElementById('prod-sku').value;
        const name = document.getElementById('prod-name').value;
        const unit = document.getElementById('prod-unit').value;
        const cost_price = Number(document.getElementById('prod-cost').value) || 0;
        const selling_price = Number(document.getElementById('prod-price').value) || 0;
        const current_stock = Number(document.getElementById('prod-stock').value) || 0;
        const reorder_level = Number(document.getElementById('prod-reorder').value) || 5;

        if (!sku || !name) {
            window.App.showToast('SKU and Product Name are required.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/inventory/products', {
                sku, name, unit, cost_price, selling_price, current_stock, reorder_level, category_id: 1
            });
            window.App.showToast(res.message, 'success');
            document.getElementById('new-product-modal').classList.remove('active');
            this.loadData();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    },

    // Stock Adjustment Modal
    openAdjustmentModal() {
        let modalEl = document.getElementById('stock-adj-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'stock-adj-modal';
            modalEl.className = 'sap-modal-backdrop';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div class="sap-modal">
                <div class="sap-modal-header">
                    <div class="sap-modal-title">⚖️ Physical Stock Count Adjustment</div>
                    <button class="sap-modal-close" onclick="document.getElementById('stock-adj-modal').classList.remove('active')">×</button>
                </div>
                <div class="sap-modal-body">
                    <div class="sap-form-group">
                        <label class="sap-form-label">Product SKU *</label>
                        <select id="adj-prod-id" class="sap-select">
                            ${this.products.map(p => `<option value="${p.id}">${p.sku} - ${p.name} (Stock: ${p.current_stock})</option>`).join('')}
                        </select>
                    </div>
                    <div class="sap-form-row">
                        <div class="sap-form-group">
                            <label class="sap-form-label">Adjustment Type *</label>
                            <select id="adj-type" class="sap-select">
                                <option value="ADJUSTMENT_IN">Adjustment In (Stock Found / Gain)</option>
                                <option value="ADJUSTMENT_OUT">Adjustment Out (Damaged / Shrinkage Loss)</option>
                            </select>
                        </div>
                        <div class="sap-form-group">
                            <label class="sap-form-label">Quantity *</label>
                            <input type="number" min="1" step="1" id="adj-qty" class="sap-input" value="1">
                        </div>
                    </div>
                    <div class="sap-form-group">
                        <label class="sap-form-label">Reason / Audit Notes *</label>
                        <input type="text" id="adj-notes" class="sap-input" placeholder="e.g. Annual physical inventory audit reconciliation">
                    </div>
                </div>
                <div class="sap-modal-footer">
                    <button class="sap-btn sap-btn-secondary" onclick="document.getElementById('stock-adj-modal').classList.remove('active')">Cancel</button>
                    <button class="sap-btn sap-btn-primary" onclick="InventoryView.submitAdjustment()">Post Adjustment to Ledger</button>
                </div>
            </div>
        `;
        modalEl.classList.add('active');
    },

    async submitAdjustment() {
        const product_id = document.getElementById('adj-prod-id').value;
        const adjustment_type = document.getElementById('adj-type').value;
        const quantity = document.getElementById('adj-qty').value;
        const notes = document.getElementById('adj-notes').value;

        if (!product_id || !quantity || Number(quantity) <= 0) {
            window.App.showToast('Please select product and enter valid quantity.', 'error');
            return;
        }

        try {
            const res = await window.API.post('/api/inventory/adjustments', {
                product_id, adjustment_type, quantity: Number(quantity), notes
            });
            window.App.showToast(res.message, 'success');
            document.getElementById('stock-adj-modal').classList.remove('active');
            this.loadData();
        } catch (err) {
            window.App.showToast(err.message, 'error');
        }
    }
};

window.InventoryView = InventoryView;
