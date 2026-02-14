import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import ProtectedAction from '../components/ProtectedAction';
import AuthModal from '../components/AuthModal';

import { useAuth } from '../context/AuthContext';

export default function Components() {
    const { isAuthenticated } = useAuth();
    const [components, setComponents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(null);
    const [showScrap, setShowScrap] = useState(null);
    const [showAuth, setShowAuth] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [msg, setMsg] = useState(null);
    const [form, setForm] = useState({ name: '', part_number: '', working_stock: 0, scrap_stock: 0, monthly_requirement: 0 });
    const [scrapForm, setScrapForm] = useState({ quantity: 0, reason: '' });


    const fetchComponents = () => {
        api.get('/components?limit=1000').then(res => setComponents(res.data.data || res.data)).catch(console.error).finally(() => setLoading(false));
    };


    useEffect(() => { fetchComponents(); }, []);

    const requireAuth = (action) => {
        if (!isAuthenticated) {
            setPendingAction(() => action);
            setShowAuth(true);
        } else {
            action();
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/components', form);
            setMsg({ type: 'success', text: 'Component added successfully' });
            setShowAdd(false);
            setForm({ name: '', part_number: '', working_stock: 0, scrap_stock: 0, monthly_requirement: 0 });
            fetchComponents();
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to add' });
        }
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/components/${showEdit.id}`, form);
            setMsg({ type: 'success', text: 'Component updated' });
            setShowEdit(null);
            fetchComponents();
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to update' });
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this component?')) return;
        try {
            await api.delete(`/components/${id}`);
            setMsg({ type: 'success', text: 'Component deleted' });
            fetchComponents();
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to delete' });
        }
    };

    const handleScrap = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/components/${showScrap.id}/scrap`, scrapForm);
            setMsg({ type: 'success', text: 'Components moved to scrap' });
            setShowScrap(null);
            setScrapForm({ quantity: 0, reason: '' });
            fetchComponents();
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to scrap' });
        }
    };

    const handleExport = () => {
        window.open('/api/excel/export', '_blank');
    };

    const openEdit = (comp) => {
        setForm({ name: comp.name, part_number: comp.part_number, working_stock: comp.working_stock, scrap_stock: comp.scrap_stock, monthly_requirement: comp.monthly_requirement });
        setShowEdit(comp);
    };

    if (loading) return <div className="page-container"><div className="loading"><div className="spinner"></div></div></div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1><span className="icon">🔧</span> Component Inventory</h1>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="btn btn-outline btn-sm" onClick={handleExport}>📥 Export Excel</button>
                    <button className="btn btn-primary btn-sm" onClick={() => requireAuth(() => { setForm({ name: '', part_number: '', working_stock: 0, scrap_stock: 0, monthly_requirement: 0 }); setShowAdd(true); })}>
                        + Add Component
                    </button>
                </div>
            </div>

            {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Part Number</th>
                            <th>Working</th>
                            <th>Scrap</th>
                            <th>Required</th>
                            <th>Status</th>
                            <th>PCBs</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {components.length === 0 ? (
                            <tr><td colSpan="8" className="empty-state"><h3>No components yet</h3><p>Add a component or import from Excel</p></td></tr>
                        ) : components.map(c => (
                            <tr key={c.id}>
                                <td style={{ fontWeight: 500 }}>{c.name}</td>
                                <td><code style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.part_number}</code></td>
                                <td><span style={{ fontWeight: 600, color: 'var(--success)' }}>{c.working_stock}</span></td>
                                <td><span style={{ color: 'var(--scrap)' }}>{c.scrap_stock}</span></td>
                                <td>{c.total_requirement}</td>
                                <td>
                                    {c.low_stock ? (
                                        <span className="low-stock-indicator">⚠️ LOW</span>
                                    ) : (
                                        <span className="badge badge-success">OK</span>
                                    )}
                                </td>
                                <td>{c.pcb_count}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <Link to={`/components/${c.id}/analytics`} className="btn btn-ghost btn-sm" title="Analytics">📊</Link>
                                        <button className="btn btn-ghost btn-sm" onClick={() => requireAuth(() => openEdit(c))} title="Edit">✏️</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => requireAuth(() => { setScrapForm({ quantity: 0, reason: '' }); setShowScrap(c); })} title="Scrap">🗑️</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => requireAuth(() => handleDelete(c.id))} title="Delete" style={{ color: 'var(--danger)' }}>✕</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Auth Modal */}
            {showAuth && <AuthModal onClose={() => { setShowAuth(false); setPendingAction(null); }} onSuccess={() => { setShowAuth(false); if (pendingAction) { pendingAction(); setPendingAction(null); } }} />}

            {/* Add Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>➕ Add Component</h2>
                        <form onSubmit={handleAdd}>
                            <div className="form-row">
                                <div className="form-group"><label>Name</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                <div className="form-group"><label>Part Number</label><input className="form-control" value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} required /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Working Stock</label><input type="number" className="form-control" value={form.working_stock} onChange={e => setForm({ ...form, working_stock: parseInt(e.target.value) || 0 })} min="0" /></div>
                                <div className="form-group"><label>Scrap Stock</label><input type="number" className="form-control" value={form.scrap_stock} onChange={e => setForm({ ...form, scrap_stock: parseInt(e.target.value) || 0 })} min="0" /></div>
                                <div className="form-group"><label>Monthly Req.</label><input type="number" className="form-control" value={form.monthly_requirement} onChange={e => setForm({ ...form, monthly_requirement: parseInt(e.target.value) || 0 })} min="0" /></div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Component</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEdit && (
                <div className="modal-overlay" onClick={() => setShowEdit(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>✏️ Edit Component</h2>
                        <form onSubmit={handleEdit}>
                            <div className="form-row">
                                <div className="form-group"><label>Name</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                <div className="form-group"><label>Part Number</label><input className="form-control" value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} required /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Working Stock</label><input type="number" className="form-control" value={form.working_stock} onChange={e => setForm({ ...form, working_stock: parseInt(e.target.value) || 0 })} min="0" /></div>
                                <div className="form-group"><label>Scrap Stock</label><input type="number" className="form-control" value={form.scrap_stock} onChange={e => setForm({ ...form, scrap_stock: parseInt(e.target.value) || 0 })} min="0" /></div>
                                <div className="form-group"><label>Monthly Req.</label><input type="number" className="form-control" value={form.monthly_requirement} onChange={e => setForm({ ...form, monthly_requirement: parseInt(e.target.value) || 0 })} min="0" /></div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowEdit(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Scrap Modal */}
            {showScrap && (
                <div className="modal-overlay" onClick={() => setShowScrap(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>🗑️ Move to Scrap</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            Moving <strong>{showScrap.name}</strong> units from working to scrap. Available: {showScrap.working_stock}
                        </p>
                        <form onSubmit={handleScrap}>
                            <div className="form-group"><label>Quantity</label><input type="number" className="form-control" value={scrapForm.quantity} onChange={e => setScrapForm({ ...scrapForm, quantity: parseInt(e.target.value) || 0 })} min="1" max={showScrap.working_stock} required /></div>
                            <div className="form-group"><label>Reason</label><input className="form-control" value={scrapForm.reason} onChange={e => setScrapForm({ ...scrapForm, reason: e.target.value })} placeholder="e.g., Damaged, Defective" /></div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowScrap(null)}>Cancel</button>
                                <button type="submit" className="btn btn-danger">Move to Scrap</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
