/**
 * ApexERP API Client Wrapper
 * Handles network requests, authentication tokens, and enterprise error handling
 */

const API = {
    token: localStorage.getItem('apex_token') || null,
    activeUser: JSON.parse(localStorage.getItem('apex_user') || 'null'),

    setSession(token, user) {
        this.token = token;
        this.activeUser = user;
        if (token) localStorage.setItem('apex_token', token);
        else localStorage.removeItem('apex_token');
        if (user) localStorage.setItem('apex_user', JSON.stringify(user));
        else localStorage.removeItem('apex_user');
    },

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        if (this.activeUser && this.activeUser.username) {
            headers['x-impersonate-user'] = this.activeUser.username;
        }

        try {
            const res = await fetch(endpoint, {
                ...options,
                headers
            });

            const data = await res.json();
            if (!res.ok || data.success === false) {
                throw new Error(data.error || `HTTP error ${res.status}`);
            }
            return data;
        } catch (err) {
            console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err.message);
            throw err;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    // File Upload helper
    async uploadReceipt(file) {
        const formData = new FormData();
        formData.append('receipt', file);

        const res = await fetch('/api/uploads/receipt', {
            method: 'POST',
            headers: {
                ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
                ...(this.activeUser ? { 'x-impersonate-user': this.activeUser.username } : {})
            },
            body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
        return data;
    },

    // CSV Export Utility for any table
    exportToCsv(filename, rows, columns) {
        if (!rows || !rows.length) {
            window.App.showToast('No records to export', 'info');
            return;
        }

        const headerLine = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
        const contentLines = rows.map(row => {
            return columns.map(c => {
                let val = typeof c.key === 'function' ? c.key(row) : row[c.key];
                if (val === null || val === undefined) val = '';
                val = String(val).replace(/"/g, '""');
                return `"${val}"`;
            }).join(',');
        });

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headerLine, ...contentLines].join('\r\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

window.API = API;
