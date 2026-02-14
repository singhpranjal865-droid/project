import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import api from '../api';
import StatsCard from '../components/StatsCard';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/analytics/overview')
            .then(res => setData(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="page-container"><div className="loading"><div className="spinner"></div></div></div>;
    if (!data) return <div className="page-container"><div className="alert alert-danger">Failed to load dashboard</div></div>;

    const pieData = {
        labels: ['Working Stock', 'Scrap Stock'],
        datasets: [{
            data: [data.summary.total_working_stock, data.summary.total_scrap_stock],
            backgroundColor: ['rgba(99, 102, 241, 0.8)', 'rgba(249, 115, 22, 0.8)'],
            borderColor: ['#6366f1', '#f97316'],
            borderWidth: 2
        }]
    };

    const topUsedData = {
        labels: data.most_used_components.map(c => c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name),
        datasets: [{
            label: 'PCBs Using',
            data: data.most_used_components.map(c => parseInt(c.usage_count)),
            backgroundColor: 'rgba(99, 102, 241, 0.7)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 6
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
        scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1><span className="icon">📊</span> Dashboard</h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link to="/components" className="btn btn-outline btn-sm">View Components</Link>
                    <Link to="/pcbs" className="btn btn-primary btn-sm">Manage PCBs</Link>
                </div>
            </div>

            <div className="stats-grid">
                <StatsCard label="Total Components" value={data.summary.total_components} icon="🔧" variant="accent" />
                <StatsCard label="Total PCBs" value={data.summary.total_pcbs} icon="🖥️" variant="info" />
                <StatsCard label="Total Builds" value={data.summary.total_builds} icon="🏭" variant="success" />
                <StatsCard label="Working Stock" value={data.summary.total_working_stock.toLocaleString()} icon="✅" variant="success" />
                <StatsCard label="Scrap Stock" value={data.summary.total_scrap_stock.toLocaleString()} icon="🗑️" variant="scrap" />
                <StatsCard label="Low Stock Alerts" value={data.summary.low_stock_count} icon="⚠️" variant={data.summary.low_stock_count > 0 ? 'danger' : 'success'} />
            </div>

            <div className="grid-2">
                <div className="chart-container">
                    <h3>📊 Working vs Scrap Stock</h3>
                    <div className="chart-wrapper" style={{ height: '260px' }}>
                        <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } } }} />
                    </div>
                </div>

                <div className="chart-container">
                    <h3>📈 Most Used Components (by PCB count)</h3>
                    <div className="chart-wrapper" style={{ height: '260px' }}>
                        <Bar data={topUsedData} options={chartOptions} />
                    </div>
                </div>
            </div>

            {data.low_stock_components.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                    <div className="card-header">
                        <span className="card-title">⚠️ Low Stock Components</span>
                        <span className="badge badge-danger">{data.low_stock_components.length} alerts</span>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Component</th>
                                    <th>Part Number</th>
                                    <th>Working Stock</th>
                                    <th>Required</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.low_stock_components.map(c => (
                                    <tr key={c.id}>
                                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                                        <td><code style={{ color: 'var(--text-muted)' }}>{c.part_number}</code></td>
                                        <td><span style={{ color: 'var(--danger)', fontWeight: 600 }}>{c.working_stock}</span></td>
                                        <td>{parseInt(c.total_requirement)}</td>
                                        <td><Link to="/procurement" className="btn btn-warning btn-sm">Restock</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {data.recent_builds.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                    <div className="card-header">
                        <span className="card-title">🏭 Recent Builds</span>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>PCB</th><th>Quantity</th><th>Date</th></tr>
                            </thead>
                            <tbody>
                                {data.recent_builds.map(b => (
                                    <tr key={b.id}>
                                        <td><Link to={`/pcbs/${b.pcb_id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{b.pcb_name}</Link></td>
                                        <td>{b.quantity_built}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{new Date(b.built_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
