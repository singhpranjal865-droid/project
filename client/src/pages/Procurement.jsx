import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';

export default function Procurement() {
    const { isAuthenticated } = useAuth();
    const [components, setComponents] = useState([]);
    const [procLog, setProcLog] = useState([]);
    const [scrapLog, setScrapLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAuth, setShowAuth] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [msg, setMsg] = useState(null);
    const [form, setForm] = useState({ component_id: '', quantity: 0 });
    const [activeTab, setActiveTab] = useState('restock');

    const fetchData = async () => {
        try {
            const [compRes, procRes, scrapRes] = await Promise.all([
                api.get('/components'),
                api.get('/procurement/log'),
                api.get('/procurement/scrap-log')
            ]);
            setComponents(compRes.data);
            setProcLog(procRes.data);
            setScrapLog(scrapRes.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const requireAuth = (action) => {
        if (!isAuthenticated) { setPendingAction(() => action); setShowAuth(true); }
        else { action(); }
    };

    const handleRestock = async () => {
        try {
            const res = await api.post('/procurement/restock', {
                component_id: parseInt(form.component_id),
                quantity: parseInt(form.quantity)
            });
            setMsg({ type: 'success', text: `${res.data.message}. Stock: ${res.data.previous_stock} → ${res.data.new_stock}` });
            setForm({ component_id: '', quantity: 0 });
            fetchData();
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.error || 'Restock failed' });
        }
    };

    const lowStockComponents = components.filter(c => c.low_stock);

    if (loading) return <div className="page-container"><div className="loading"><div className="spinner"></div></div></div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1><span className="icon">📦</span> Procurement & Restocking</h1>
            </div>

            {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

            <div className="grid-2">
                {/* Restock Form */}
                <div className="card" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                    <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem' }}>📦 Restock Component</h3>
                    <form onSubmit={(e) => { e.preventDefault(); requireAuth(() => handleRestock()); }}>
                        <div className="form-group">
                            <label>Component</label>
                            <select className="form-control" value={form.component_id} onChange={e => setForm({ ...form, component_id: e.target.value })} required>
                                <option value="">Select component to restock</option>
                                {components.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} ({c.part_number}) — Stock: {c.working_stock} {c.low_stock ? '⚠️ LOW' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Quantity to Add</label>
                            <input type="number" className="form-control" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} min="1" required />
                        </div>
                        <button type="submit" className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }}>
                            📦 Restock
                        </button>
                    </form>
                </div>

                {/* Low Stock Alerts */}
                <div className="card" style={{ borderColor: lowStockComponents.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)' }}>
                    <div className="card-header">
                        <span className="card-title">⚠️ Low Stock Alerts</span>
                        <span className="badge badge-danger">{lowStockComponents.length}</span>
                    </div>
                    {lowStockComponents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                            <p>All components are adequately stocked</p>
                        </div>
                    ) : (
                        <div className="comp-list">
                            {lowStockComponents.map(c => (
                                <div className="comp-list-item" key={c.id} style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                                    <div className="comp-info">
                                        <div className="comp-name">{c.name}</div>
                                        <div className="comp-pn">Stock: {c.working_stock} / Required: {c.total_requirement}</div>
                                    </div>
                                    <span className="low-stock-indicator">⚠️ LOW</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2rem', marginBottom: '1rem' }}>
                <button className={`btn ${activeTab === 'restock' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setActiveTab('restock')}>
                    📦 Procurement Log
                </button>
                <button className={`btn ${activeTab === 'scrap' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setActiveTab('scrap')}>
                    🗑️ Scrap Log
                </button>
            </div>

            {activeTab === 'restock' && (
                <div className="card">
                    <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem' }}>📜 Procurement History</h3>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>Component</th><th>Qty Added</th><th>Before</th><th>After</th><th>Date</th></tr>
                            </thead>
                            <tbody>
                                {procLog.length === 0 ? (
                                    <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No procurement records yet</td></tr>
                                ) : procLog.map(log => (
                                    <tr key={log.id}>
                                        <td><div style={{ fontWeight: 500 }}>{log.component_name}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{log.part_number}</div></td>
                                        <td><span style={{ color: 'var(--success)', fontWeight: 600 }}>+{log.quantity_added}</span></td>
                                        <td>{log.previous_stock}</td>
                                        <td style={{ fontWeight: 500 }}>{log.new_stock}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(log.procured_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'scrap' && (
                <div className="card">
                    <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem' }}>🗑️ Scrap History</h3>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>Component</th><th>Qty Scrapped</th><th>Reason</th><th>Date</th></tr>
                            </thead>
                            <tbody>
                                {scrapLog.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No scrap records yet</td></tr>
                                ) : scrapLog.map(log => (
                                    <tr key={log.id}>
                                        <td><div style={{ fontWeight: 500 }}>{log.component_name}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{log.part_number}</div></td>
                                        <td><span style={{ color: 'var(--scrap)', fontWeight: 600 }}>{log.quantity}</span></td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{log.reason}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(log.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showAuth && <AuthModal onClose={() => { setShowAuth(false); setPendingAction(null); }} onSuccess={() => { setShowAuth(false); if (pendingAction) { pendingAction(); setPendingAction(null); } }} />}
        </div>
    );
}
