import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from 'chart.js';
import api from '../api';
import StatsCard from '../components/StatsCard';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

const chartColors = [
    'rgba(99, 102, 241, 0.8)', 'rgba(34, 197, 94, 0.8)', 'rgba(249, 115, 22, 0.8)',
    'rgba(239, 68, 68, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(168, 85, 247, 0.8)',
    'rgba(20, 184, 166, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(236, 72, 153, 0.8)',
    'rgba(139, 92, 246, 0.8)'
];

export default function Analytics() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/analytics/overview').then(res => setData(res.data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="page-container"><div className="loading"><div className="spinner"></div></div></div>;
    if (!data) return <div className="page-container"><div className="alert alert-danger">Failed to load analytics</div></div>;

    const workingVsScrapPie = {
        labels: ['Working Stock', 'Scrap Stock'],
        datasets: [{
            data: [data.summary.total_working_stock, data.summary.total_scrap_stock],
            backgroundColor: ['rgba(99, 102, 241, 0.8)', 'rgba(249, 115, 22, 0.8)'],
            borderColor: ['#6366f1', '#f97316'],
            borderWidth: 2
        }]
    };

    const stockDistPie = {
        labels: data.stock_distribution.map(c => c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name),
        datasets: [{
            label: 'Working Stock',
            data: data.stock_distribution.map(c => c.working_stock),
            backgroundColor: chartColors.slice(0, data.stock_distribution.length),
            borderWidth: 1
        }]
    };

    const mostUsedBar = {
        labels: data.most_used_components.map(c => c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name),
        datasets: [{
            label: 'Used in # PCBs',
            data: data.most_used_components.map(c => parseInt(c.usage_count)),
            backgroundColor: 'rgba(99, 102, 241, 0.7)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 6
        }]
    };

    const leastUsedBar = {
        labels: data.least_used_components.map(c => c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name),
        datasets: [{
            label: 'Used in # PCBs',
            data: data.least_used_components.map(c => parseInt(c.usage_count)),
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 6
        }]
    };

    const lowStockBar = {
        labels: data.most_low_stock.map(c => c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name),
        datasets: [{
            label: 'Low Stock Events',
            data: data.most_low_stock.map(c => c.low_stock_count),
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 6
        }]
    };

    const procuredBar = {
        labels: data.most_procured.map(c => c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name),
        datasets: [{
            label: 'Times Procured',
            data: data.most_procured.map(c => c.procurement_count),
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: '#22c55e',
            borderWidth: 1,
            borderRadius: 6
        }]
    };

    const trendLine = {
        labels: data.consumption_trend.map(d => new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
        datasets: [{
            label: 'PCBs Built',
            data: data.consumption_trend.map(d => parseInt(d.builds)),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#6366f1'
        }]
    };

    const mostScrappedBar = {
        labels: data.most_scrapped?.map(c => c.name) || [],
        datasets: [{
            label: 'Total Scrapped Used',
            data: data.most_scrapped?.map(c => parseInt(c.total_scrapped)) || [],
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 6
        }]
    };

    const scrapReasonPie = {
        labels: data.scrap_reasons?.map(r => r.reason) || [],
        datasets: [{
            data: data.scrap_reasons?.map(r => parseInt(r.total_qty)) || [],
            backgroundColor: [
                'rgba(239, 68, 68, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(234, 179, 8, 0.8)',
                'rgba(168, 85, 247, 0.8)',
                'rgba(100, 116, 139, 0.8)'
            ],
            borderWidth: 1
        }]
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
        scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
        }
    };

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 15 } } }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1><span className="icon">📈</span> Analytics Dashboard</h1>
                <button className="btn btn-outline btn-sm" onClick={() => window.open('/api/excel/export', '_blank')}>📥 Export Report</button>
            </div>

            <div className="stats-grid">
                <StatsCard label="Total Components" value={data.summary.total_components} icon="🔧" variant="accent" />
                <StatsCard label="Total PCBs" value={data.summary.total_pcbs} icon="🖥️" variant="info" />
                <StatsCard label="Total Builds" value={data.summary.total_builds} icon="🏭" variant="success" />
                <StatsCard label="Working Stock" value={data.summary.total_working_stock.toLocaleString()} icon="✅" variant="success" />
                <StatsCard label="Scrap Stock" value={data.summary.total_scrap_stock.toLocaleString()} icon="🗑️" variant="scrap" />
                <StatsCard label="Low Stock Alerts" value={data.summary.low_stock_count} icon="⚠️" variant={data.summary.low_stock_count > 0 ? 'danger' : 'success'} />
            </div>

            {/* Row 1: Pie Charts */}
            <div className="grid-2">
                <div className="chart-container">
                    <h3>🥧 Working vs Scrap Stock</h3>
                    <div className="chart-wrapper" style={{ height: '280px' }}>
                        <Pie data={workingVsScrapPie} options={pieOptions} />
                    </div>
                </div>
                <div className="chart-container">
                    <h3>🥧 Stock Distribution by Component</h3>
                    <div className="chart-wrapper" style={{ height: '280px' }}>
                        <Pie data={stockDistPie} options={pieOptions} />
                    </div>
                </div>
            </div>

            {/* Row 2: Bar Charts */}
            <div className="grid-2" style={{ marginTop: '1.5rem' }}>
                <div className="chart-container">
                    <h3>📊 Most Used Components</h3>
                    <div className="chart-wrapper">
                        <Bar data={mostUsedBar} options={barOptions} />
                    </div>
                </div>
                <div className="chart-container">
                    <h3>📊 Least Used Components</h3>
                    <div className="chart-wrapper">
                        <Bar data={leastUsedBar} options={barOptions} />
                    </div>
                </div>
            </div>

            <div className="grid-2" style={{ marginTop: '1.5rem' }}>
                <div className="chart-container">
                    <h3>🔴 Most Low-Stock Hitting Components</h3>
                    <div className="chart-wrapper">
                        {data.most_low_stock.length > 0 ? (
                            <Bar data={lowStockBar} options={barOptions} />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No low-stock events recorded</div>
                        )}
                    </div>
                </div>
                <div className="chart-container">
                    <h3>📦 Most Procured Components</h3>
                    <div className="chart-wrapper">
                        {data.most_procured.length > 0 ? (
                            <Bar data={procuredBar} options={barOptions} />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No procurement records yet</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Scrap Analysis */}
            <div className="grid-2" style={{ marginTop: '1.5rem' }}>
                <div className="chart-container">
                    <h3>🗑️ Most Scrapped Components</h3>
                    <div className="chart-wrapper">
                        {data.most_scrapped?.length > 0 ? (
                            <Bar data={mostScrappedBar} options={barOptions} />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No scrap data</div>
                        )}
                    </div>
                </div>
                <div className="chart-container">
                    <h3>📉 Scrap Reasons</h3>
                    <div className="chart-wrapper" style={{ height: '280px' }}>
                        {data.scrap_reasons?.length > 0 ? (
                            <Pie data={scrapReasonPie} options={pieOptions} />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No scrap reasons recorded</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Build Trend */}
            {data.consumption_trend.length > 0 && (
                <div className="chart-container" style={{ marginTop: '1.5rem' }}>
                    <h3>📈 Build Trend (Last 30 Days)</h3>
                    <div className="chart-wrapper">
                        <Line data={trendLine} options={barOptions} />
                    </div>
                </div>
            )}

            {/* Component Table */}
            <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                    <span className="card-title">📋 All Components Overview</span>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr><th>Component</th><th>Part #</th><th>Working</th><th>Scrap</th><th>Used in PCBs</th><th>Analytics</th></tr>
                        </thead>
                        <tbody>
                            {data.most_used_components.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No component data</td></tr>
                            ) : data.most_used_components.map(c => (
                                <tr key={c.id}>
                                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                                    <td><code style={{ color: 'var(--text-muted)' }}>{c.part_number}</code></td>
                                    <td style={{ color: 'var(--success)' }}>{c.working_stock}</td>
                                    <td style={{ color: 'var(--scrap)' }}>{c.scrap_stock}</td>
                                    <td>{parseInt(c.usage_count)}</td>
                                    <td><Link to={`/components/${c.id}/analytics`} className="btn btn-ghost btn-sm">📊 View</Link></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
