import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from 'chart.js';
import api from '../api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

export default function ComponentAnalytics() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/components/${id}/analytics`).then(res => setData(res.data)).catch(console.error).finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="page-container"><div className="loading"><div className="spinner"></div></div></div>;
    if (!data) return <div className="page-container"><div className="alert alert-danger">Component not found</div></div>;

    const { component, pcbs, procurement_history, scrap_history, consumption_history } = data;

    const stockPie = {
        labels: ['Working', 'Scrap'],
        datasets: [{
            data: [component.working_stock, component.scrap_stock],
            backgroundColor: ['rgba(99, 102, 241, 0.8)', 'rgba(249, 115, 22, 0.8)'],
            borderColor: ['#6366f1', '#f97316'],
            borderWidth: 2
        }]
    };

    const consumptionLine = {
        labels: consumption_history.map(d => new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
        datasets: [{
            label: 'Units Consumed',
            data: consumption_history.map(d => parseInt(d.consumed)),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#ef4444'
        }]
    };

    const pcbUsageBar = {
        labels: pcbs.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name),
        datasets: [{
            label: 'Qty per PCB',
            data: pcbs.map(p => p.quantity_per_pcb),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 6
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
        scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>
                    <Link to="/components" className="btn btn-ghost">←</Link>
                    <span className="icon">📊</span> {component.name}
                </h1>
                <code style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{component.part_number}</code>
            </div>

            {/* Stats Row */}
            <div className="stats-grid">
                <div className={`stat-card ${component.low_stock ? 'danger' : 'success'}`}>
                    <div className="stat-label">Working Stock</div>
                    <div className="stat-value">{component.working_stock}</div>
                </div>
                <div className="stat-card scrap">
                    <div className="stat-label">Scrap Stock</div>
                    <div className="stat-value">{component.scrap_stock}</div>
                </div>
                <div className="stat-card info">
                    <div className="stat-label">Total Requirement</div>
                    <div className="stat-value">{component.total_requirement}</div>
                </div>
                <div className="stat-card accent">
                    <div className="stat-label">PCBs Using This</div>
                    <div className="stat-value">{pcbs.length}</div>
                </div>
                <div className="stat-card warning">
                    <div className="stat-label">Low Stock Events</div>
                    <div className="stat-value">{component.low_stock_count}</div>
                </div>
                <div className="stat-card success">
                    <div className="stat-label">Times Procured</div>
                    <div className="stat-value">{component.procurement_count}</div>
                </div>
            </div>

            {component.low_stock && (
                <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
                    ⚠️ <strong>Low Stock Alert:</strong> Working stock ({component.working_stock}) is below 20% of required ({component.total_requirement}).
                    <Link to="/procurement" className="btn btn-warning btn-sm" style={{ marginLeft: '1rem' }}>Restock Now</Link>
                </div>
            )}

            {/* Charts */}
            <div className="grid-2">
                <div className="chart-container">
                    <h3>🥧 Working vs Scrap</h3>
                    <div className="chart-wrapper" style={{ height: '250px' }}>
                        <Pie data={stockPie} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} />
                    </div>
                </div>

                {pcbs.length > 0 && (
                    <div className="chart-container">
                        <h3>📊 Usage Across PCBs</h3>
                        <div className="chart-wrapper" style={{ height: '250px' }}>
                            <Bar data={pcbUsageBar} options={chartOptions} />
                        </div>
                    </div>
                )}
            </div>

            {consumption_history.length > 0 && (
                <div className="chart-container" style={{ marginTop: '1.5rem' }}>
                    <h3>📈 Consumption History</h3>
                    <div className="chart-wrapper">
                        <Line data={consumptionLine} options={chartOptions} />
                    </div>
                </div>
            )}

            {/* PCBs Table */}
            {pcbs.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem' }}>🖥️ PCBs Using This Component</h3>
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>PCB Name</th><th>Qty per PCB</th><th>Preorder</th><th>Total Needed</th></tr></thead>
                            <tbody>
                                {pcbs.map(p => (
                                    <tr key={p.id}>
                                        <td><Link to={`/pcbs/${p.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>{p.name}</Link></td>
                                        <td>×{p.quantity_per_pcb}</td>
                                        <td>{p.preorder_type ? <span className="badge badge-info">{p.preorder_type} ×{p.preorder_quantity}</span> : <span style={{ color: 'var(--text-muted)' }}>None</span>}</td>
                                        <td style={{ fontWeight: 500 }}>{p.quantity_per_pcb * (p.preorder_quantity > 0 ? p.preorder_quantity : 1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Procurement History */}
            <div className="grid-2" style={{ marginTop: '1.5rem' }}>
                <div className="card">
                    <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem' }}>📦 Procurement History</h3>
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>Qty Added</th><th>Before → After</th><th>Date</th></tr></thead>
                            <tbody>
                                {procurement_history.length === 0 ? (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No records</td></tr>
                                ) : procurement_history.map(p => (
                                    <tr key={p.id}>
                                        <td><span style={{ color: 'var(--success)', fontWeight: 600 }}>+{p.quantity_added}</span></td>
                                        <td>{p.previous_stock} → {p.new_stock}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(p.procured_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem' }}>🗑️ Scrap History</h3>
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>Qty</th><th>Reason</th><th>Date</th></tr></thead>
                            <tbody>
                                {scrap_history.length === 0 ? (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>No records</td></tr>
                                ) : scrap_history.map(s => (
                                    <tr key={s.id}>
                                        <td><span style={{ color: 'var(--scrap)', fontWeight: 600 }}>{s.quantity}</span></td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{s.reason}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(s.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
