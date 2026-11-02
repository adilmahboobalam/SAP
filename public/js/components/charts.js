/**
 * Enterprise SVG Charting Component
 * Clean, lightweight, responsive charts with tooltips and high aesthetic precision
 */

const EnterpriseCharts = {
    /**
     * Render Monthly Revenue vs Expenses Grouped Bar Chart
     */
    renderMonthlyBarChart(containerId, monthlyData = []) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const width = 680;
        const height = 240;
        const padding = { top: 20, right: 20, bottom: 35, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Calculate maximum value for Y-axis scale
        const maxVal = Math.max(
            ...monthlyData.map(d => Math.max(d.revenue || 0, d.expenses || 0)),
            50000
        );

        const groupWidth = chartWidth / monthlyData.length;
        const barWidth = Math.min(groupWidth * 0.35, 16);

        // Y-axis gridlines (4 intervals)
        const gridTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

        let svgHtml = `
            <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; font-family: var(--font-family);">
                <!-- Grid lines & Y Axis labels -->
                ${gridTicks.map(val => {
                    const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
                    return `
                        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3,3" />
                        <text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="#64748b" text-anchor="end">$${Math.round(val / 1000)}k</text>
                    `;
                }).join('')}

                <!-- Bars -->
                ${monthlyData.map((d, i) => {
                    const groupX = padding.left + i * groupWidth + (groupWidth / 2);
                    
                    const revHeight = (d.revenue / maxVal) * chartHeight;
                    const revY = padding.top + chartHeight - revHeight;
                    const revX = groupX - barWidth - 1;

                    const expHeight = (d.expenses / maxVal) * chartHeight;
                    const expY = padding.top + chartHeight - expHeight;
                    const expX = groupX + 1;

                    return `
                        <g class="chart-bar-group">
                            <!-- Revenue Bar -->
                            <rect x="${revX}" y="${revY}" width="${barWidth}" height="${revHeight}" fill="#0070f2" rx="2">
                                <title>${d.month_name} Revenue: $${Number(d.revenue).toLocaleString()}</title>
                            </rect>
                            <!-- Expense Bar -->
                            <rect x="${expX}" y="${expY}" width="${barWidth}" height="${expHeight}" fill="#e53935" rx="2">
                                <title>${d.month_name} Expenses: $${Number(d.expenses).toLocaleString()}</title>
                            </rect>
                            <!-- Month Label -->
                            <text x="${groupX}" y="${height - 10}" font-size="10.5" fill="#475569" text-anchor="middle">${d.month_name}</text>
                        </g>
                    `;
                }).join('')}

                <!-- Legend -->
                <g transform="translate(${width - 180}, 8)">
                    <rect x="0" y="0" width="10" height="10" fill="#0070f2" rx="2" />
                    <text x="14" y="9" font-size="11" fill="#334155" font-weight="600">Revenue</text>
                    <rect x="80" y="0" width="10" height="10" fill="#e53935" rx="2" />
                    <text x="94" y="9" font-size="11" fill="#334155" font-weight="600">Expenses</text>
                </g>
            </svg>
        `;

        container.innerHTML = svgHtml;
    },

    /**
     * Render Expense Breakdown Donut Chart
     */
    renderDonutChart(containerId, data = []) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const total = data.reduce((acc, d) => acc + d.amount, 0);
        if (total === 0) {
            container.innerHTML = `<div style="text-align:center; padding: 40px; color: #94a3b8;">No expense data available</div>`;
            return;
        }

        const size = 200;
        const radius = 70;
        const center = size / 2;
        const colors = ['#0070f2', '#00a4b8', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

        let cumulativeAngle = 0;
        const slices = data.map((d, i) => {
            const percentage = d.amount / total;
            const angle = percentage * 360;
            const startAngle = cumulativeAngle;
            cumulativeAngle += angle;
            const endAngle = cumulativeAngle;

            const startRad = (startAngle - 90) * (Math.PI / 180);
            const endRad = (endAngle - 90) * (Math.PI / 180);

            const x1 = center + radius * Math.cos(startRad);
            const y1 = center + radius * Math.sin(startRad);
            const x2 = center + radius * Math.cos(endRad);
            const y2 = center + radius * Math.sin(endRad);

            const largeArc = angle > 180 ? 1 : 0;
            const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            return {
                path: pathData,
                color: colors[i % colors.length],
                name: d.name,
                amount: d.amount,
                percentage: (percentage * 100).toFixed(1)
            };
        });

        let svgHtml = `
            <div style="display: flex; align-items: center; justify-content: space-around; flex-wrap: wrap; gap: 16px;">
                <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
                    ${slices.map(s => `
                        <path d="${s.path}" fill="${s.color}">
                            <title>${s.name}: $${Number(s.amount).toLocaleString()} (${s.percentage}%)</title>
                        </path>
                    `).join('')}
                    <!-- Donut cutout hole -->
                    <circle cx="${center}" cy="${center}" r="45" fill="#ffffff" />
                    <text x="${center}" y="${center - 2}" text-anchor="middle" font-size="10" fill="#64748b" font-weight="600">TOTAL</text>
                    <text x="${center}" y="${center + 14}" text-anchor="middle" font-size="12" fill="#0f172a" font-weight="700">$${Math.round(total / 1000)}k</text>
                </svg>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11.5px; max-width: 200px;">
                    ${slices.map(s => `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                <span style="width: 8px; height: 8px; border-radius: 2px; background: ${s.color}; display: inline-block; flex-shrink: 0;"></span>
                                <span style="color: #334155; font-weight: 500;">${s.name}</span>
                            </div>
                            <span style="color: #64748b; font-weight: 600;">${s.percentage}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = svgHtml;
    }
};

window.EnterpriseCharts = EnterpriseCharts;
