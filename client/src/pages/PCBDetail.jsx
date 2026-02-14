import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';

export default function PCBDetail() {
    const { id } = useParams();
    const { isAuthenticated } = useAuth();
    const [pcb, setPcb] = useState(null);
    const [loading, setLoading] = useState(true);
    const [buildQty, setBuildQty] = useState(1);
    const [msg, setMsg] = useState(null);
    const [showAuth, setShowAuth] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [buildResult, setBuildResult] = useState(null);

    const fetchPcb = () => {
        api.get(`/pcbs/${id}`).then(res => setPcb(res.data)).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => { fetchPcb(); }, [id]);

    const requireAuth = (action) => {
        if (!isAuthenticated) { setPendingAction(() => action); setShowAuth(true); }
        else { action(); }
    };

    const handleBuild = async () => {
        try {
            const res = await api.post(`/pcbs/${id}/build`, { quantity: buildQty });
            setMsg({ type: 'success', text: res.data.message });
            setBuildResult(res.data.deductions);
            fetchPcb();
        } catch (err) {
            const errData = err.response?.data;
            if (errData?.insufficient) {
                setMsg({ type: 'danger', text: `Insufficient stock: ${errData.insufficient.map(i => `${i.name} (need ${i.needed}, have ${i.available})`).join(', ')}` });
            } else {
                setMsg({ type: 'danger', text: errData?.error || 'Build failed' });
            }
        }
    };

    if (loading) return <div className="page-container"><div className="loading"><div className="spinner"></div></div></div>;
    if (!pcb) return <div className="page-container"><div className="alert alert-danger">PCB not found</div></div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>
                    <Link to="/pcbs" className="btn btn-ghost">←</Link>
                    <span className="icon">🖥️</span> {pcb.name}
                </h1>
                {pcb.preorder_type && (
                    <div>
                        <span className="badge badge-info">{pcb.preorder_type}</span>
                        <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>×{pcb.preorder_quantity} preorder</span>
                    </div>
                )}
            </div>

            {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

            <div className="grid-2">
                {/* Build Section */}
                <div className="card" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                    <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🏭 Build PCB
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                        Building will deduct required components from working stock. Stock cannot go negative.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                            <label>Build Quantity</label>
                            <input type="number" className="form-control" value={buildQty} onChange={e => setBuildQty(parseInt(e.target.value) || 1)} min="1" />
                        </div>
                        <button className="btn btn-success btn-lg" onClick={() => requireAuth(handleBuild)}>
                            🏭 Build {buildQty} PCB{buildQty > 1 ? 's' : ''}
                        </button>
                    </div>

                    {buildResult && (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34,197,94,0.2)' }}>
                            <strong style={{ color: 'var(--success)' }}>✅ Build Complete - Stock Deductions:</strong>
                            <div style={{ marginTop: '0.5rem' }}>
                                {buildResult.map((d, i) => (
                                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.2rem 0' }}>
                                        {d.component}: -{d.deducted} (remaining: {d.remaining})
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Component Requirements */}
                <div className="card">
                    <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem' }}>📋 Components Required</h3>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr><th>Component</th><th>Per PCB</th><th>Stock</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {pcb.components.map(c => {
                                    const needed = c.quantity_per_pcb * buildQty;
                                    const sufficient = c.working_stock >= needed;
                                    return (
                                        <tr key={c.id}>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{c.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.part_number}</div>
                                            </td>
                                            <td>×{c.quantity_per_pcb}</td>
                                            <td>
                                                <span style={{ color: 'var(--success)' }}>{c.working_stock}</span>
                                                {c.scrap_stock > 0 && <span style={{ color: 'var(--scrap)', fontSize: '0.75rem', marginLeft: '0.25rem' }}>({c.scrap_stock} scrap)</span>}
                                            </td>
                                            <td>
                                                {sufficient ? (
                                                    <span className="badge badge-success">✅ OK ({needed} needed)</span>
                                                ) : (
                                                    <span className="badge badge-danger">❌ Need {needed}, have {c.working_stock}</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Build History */}
            {pcb.build_history && pcb.build_history.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem' }}>📜 Build History</h3>
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>Quantity Built</th><th>Date</th></tr></thead>
                            <tbody>
                                {pcb.build_history.map(b => (
                                    <tr key={b.id}>
                                        <td>{b.quantity_built} unit{b.quantity_built > 1 ? 's' : ''}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{new Date(b.built_at).toLocaleString()}</td>
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
