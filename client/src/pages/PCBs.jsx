import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';

export default function PCBs() {
    const { isAuthenticated } = useAuth();
    const [pcbs, setPcbs] = useState([]);
    const [allComponents, setAllComponents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [msg, setMsg] = useState(null);
    const [form, setForm] = useState({ name: '', preorder_type: '', preorder_quantity: 0, components: [] });
    const [newComp, setNewComp] = useState({ id: '', quantity_per_pcb: 1, name: '', part_number: '' });
    const [addMode, setAddMode] = useState('existing'); // 'existing' or 'new'

    const fetchData = async () => {
        try {
            const [pcbRes, compRes] = await Promise.all([api.get('/pcbs'), api.get('/components')]);
            setPcbs(pcbRes.data);
            setAllComponents(compRes.data);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const requireAuth = (action) => {
        if (!isAuthenticated) { setPendingAction(() => action); setShowAuth(true); }
        else { action(); }
    };

    const addComponentToForm = () => {
        if (addMode === 'existing' && newComp.id) {
            const comp = allComponents.find(c => c.id === parseInt(newComp.id));
            if (comp && !form.components.find(c => c.id === comp.id)) {
                setForm({
                    ...form,
                    components: [...form.components, { id: comp.id, name: comp.name, part_number: comp.part_number, quantity_per_pcb: parseInt(newComp.quantity_per_pcb) || 1 }]
                });
            }
        } else if (addMode === 'new' && newComp.name && newComp.part_number) {
            setForm({
                ...form,
                components: [...form.components, { name: newComp.name, part_number: newComp.part_number, quantity_per_pcb: parseInt(newComp.quantity_per_pcb) || 1 }]
            });
        }
        setNewComp({ id: '', quantity_per_pcb: 1, name: '', part_number: '' });
    };

    const removeComp = (idx) => {
        setForm({ ...form, components: form.components.filter((_, i) => i !== idx) });
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/pcbs', {
                ...form,
                preorder_type: form.preorder_type || null,
                preorder_quantity: parseInt(form.preorder_quantity) || 0
            });
            setMsg({ type: 'success', text: 'PCB created successfully' });
            setShowAdd(false);
            setForm({ name: '', preorder_type: '', preorder_quantity: 0, components: [] });
            fetchData();
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to create' });
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this PCB?')) return;
        try {
            await api.delete(`/pcbs/${id}`);
            setMsg({ type: 'success', text: 'PCB deleted' });
            fetchData();
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to delete' });
        }
    };

    if (loading) return <div className="page-container"><div className="loading"><div className="spinner"></div></div></div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1><span className="icon">🖥️</span> PCB Management</h1>
                <button className="btn btn-primary" onClick={() => requireAuth(() => { setForm({ name: '', preorder_type: '', preorder_quantity: 0, components: [] }); setShowAdd(true); })}>
                    + Add PCB
                </button>
            </div>

            {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

            {pcbs.length === 0 ? (
                <div className="empty-state"><div className="icon">🖥️</div><h3>No PCBs defined yet</h3><p>Add a PCB to start tracking component requirements</p></div>
            ) : (
                <div className="grid-3">
                    {pcbs.map(pcb => (
                        <div className="card" key={pcb.id}>
                            <div className="card-header">
                                <span className="card-title">{pcb.name}</span>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <Link to={`/pcbs/${pcb.id}`} className="btn btn-ghost btn-sm" title="View Details">👁️</Link>
                                    <button className="btn btn-ghost btn-sm" onClick={() => requireAuth(() => handleDelete(pcb.id))} style={{ color: 'var(--danger)' }}>✕</button>
                                </div>
                            </div>

                            {pcb.preorder_type && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <span className="badge badge-info">{pcb.preorder_type}</span>
                                    <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                        ×{pcb.preorder_quantity} preorder
                                    </span>
                                </div>
                            )}

                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                {pcb.components.length} component{pcb.components.length !== 1 ? 's' : ''}
                            </div>

                            <div className="comp-list">
                                {pcb.components.slice(0, 4).map(c => (
                                    <div className="comp-list-item" key={c.id}>
                                        <div className="comp-info">
                                            <div className="comp-name">{c.name}</div>
                                            <div className="comp-pn">{c.part_number}</div>
                                        </div>
                                        <span className="badge badge-info">×{c.quantity_per_pcb}</span>
                                    </div>
                                ))}
                                {pcb.components.length > 4 && (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.25rem' }}>
                                        +{pcb.components.length - 4} more
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '0.75rem' }}>
                                <Link to={`/pcbs/${pcb.id}`} className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                                    🏭 Build / View Details
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Auth Modal */}
            {showAuth && <AuthModal onClose={() => { setShowAuth(false); setPendingAction(null); }} onSuccess={() => { setShowAuth(false); if (pendingAction) { pendingAction(); setPendingAction(null); } }} />}

            {/* Add PCB Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <h2>🖥️ Add New PCB</h2>
                        <form onSubmit={handleAdd}>
                            <div className="form-group">
                                <label>PCB Name</label>
                                <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Power Supply Board v2" required />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Preorder Type (optional)</label>
                                    <select className="form-control" value={form.preorder_type} onChange={e => setForm({ ...form, preorder_type: e.target.value })}>
                                        <option value="">No preorder</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Preorder Quantity</label>
                                    <input type="number" className="form-control" value={form.preorder_quantity} onChange={e => setForm({ ...form, preorder_quantity: parseInt(e.target.value) || 0 })} min="0" />
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: 'var(--text-heading)' }}>Components Required</label>

                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <button type="button" className={`btn btn-sm ${addMode === 'existing' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAddMode('existing')}>Existing</button>
                                    <button type="button" className={`btn btn-sm ${addMode === 'new' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setAddMode('new')}>New Component</button>
                                </div>

                                {addMode === 'existing' ? (
                                    <div className="form-row" style={{ alignItems: 'end' }}>
                                        <div className="form-group" style={{ flex: 2 }}>
                                            <label>Component</label>
                                            <select className="form-control" value={newComp.id} onChange={e => setNewComp({ ...newComp, id: e.target.value })}>
                                                <option value="">Select component</option>
                                                {allComponents.map(c => <option key={c.id} value={c.id}>{c.name} ({c.part_number})</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label>Qty per PCB</label>
                                            <input type="number" className="form-control" value={newComp.quantity_per_pcb} onChange={e => setNewComp({ ...newComp, quantity_per_pcb: parseInt(e.target.value) || 1 })} min="1" />
                                        </div>
                                        <button type="button" className="btn btn-success btn-sm" onClick={addComponentToForm} style={{ marginBottom: '1rem' }}>Add</button>
                                    </div>
                                ) : (
                                    <div className="form-row" style={{ alignItems: 'end' }}>
                                        <div className="form-group">
                                            <label>Name</label>
                                            <input className="form-control" value={newComp.name} onChange={e => setNewComp({ ...newComp, name: e.target.value })} placeholder="Component name" />
                                        </div>
                                        <div className="form-group">
                                            <label>Part #</label>
                                            <input className="form-control" value={newComp.part_number} onChange={e => setNewComp({ ...newComp, part_number: e.target.value })} placeholder="Part number" />
                                        </div>
                                        <div className="form-group" style={{ maxWidth: '80px' }}>
                                            <label>Qty</label>
                                            <input type="number" className="form-control" value={newComp.quantity_per_pcb} onChange={e => setNewComp({ ...newComp, quantity_per_pcb: parseInt(e.target.value) || 1 })} min="1" />
                                        </div>
                                        <button type="button" className="btn btn-success btn-sm" onClick={addComponentToForm} style={{ marginBottom: '1rem' }}>Add</button>
                                    </div>
                                )}

                                {form.components.length > 0 && (
                                    <div className="comp-list" style={{ marginTop: '0.5rem' }}>
                                        {form.components.map((c, i) => (
                                            <div className="comp-list-item" key={i}>
                                                <div className="comp-info">
                                                    <div className="comp-name">{c.name || `Component #${c.id}`}</div>
                                                    <div className="comp-pn">{c.part_number || ''}</div>
                                                </div>
                                                <span className="badge badge-info">×{c.quantity_per_pcb}</span>
                                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeComp(i)} style={{ color: 'var(--danger)' }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create PCB</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
