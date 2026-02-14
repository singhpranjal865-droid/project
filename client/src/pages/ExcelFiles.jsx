import { useState, useEffect } from 'react';
import api from '../api';
import ExcelViewer from '../components/ExcelViewer';
import { useAuth } from '../context/AuthContext';

export default function ExcelFiles() {
    const { isAuthenticated } = useAuth();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState(null);
    const [expandedFiles, setExpandedFiles] = useState([]);

    const fetchFiles = () => {
        setLoading(true);
        api.get('/excel/files')
            .then(res => setFiles(res.data))
            .catch(err => setMsg({ type: 'danger', text: 'Failed to load files' }))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchFiles(); }, []);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            await api.post('/excel/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setMsg({ type: 'success', text: 'File uploaded successfully' });
            fetchFiles();
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.error || 'Upload failed' });
        }
    };

    const handleProcess = async (filename) => {
        if (!confirm(`Process ${filename} and add to inventory?`)) return;
        try {
            const res = await api.post(`/excel/process/${filename}`);
            setMsg({ type: 'success', text: res.data.message });
        } catch (err) {
            setMsg({ type: 'danger', text: err.response?.data?.error || 'Processing failed' });
        }
    };

    const handleDelete = async (filename) => {
        if (!confirm(`Delete file ${filename}?`)) return;
        try {
            await api.delete(`/excel/files/${filename}`);
            setMsg({ type: 'success', text: 'File deleted' });
            fetchFiles();
        } catch (err) {
            setMsg({ type: 'danger', text: 'Failed to delete file' });
        }
    };

    const toggleFile = (name) => {
        if (expandedFiles.includes(name)) {
            setExpandedFiles(expandedFiles.filter(n => n !== name));
        } else {
            setExpandedFiles([...expandedFiles, name]);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1><span className="icon">📊</span> Excel Management</h1>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                        📤 Upload Excel
                        <input type="file" accept=".xlsx,.xls,.xlsm" style={{ display: 'none' }} onChange={handleUpload} />
                    </label>
                </div>
            </div>

            {msg && (
                <div className={`alert alert-${msg.type}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {msg.text}
                    <button className="btn btn-ghost btn-sm" onClick={() => setMsg(null)}>✕</button>
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden', borderColor: 'var(--accent)' }}>
                <h3 style={{ padding: '1rem', margin: 0, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>📂 Uploaded Files</h3>
                {files.length === 0 ? <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>No files found.</p> : (
                    <div className="files-list">
                        {files.map(f => (
                            <div key={f.name} className="file-item" style={{ borderBottom: '1px solid var(--border)' }}>
                                <div className="file-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', alignItems: 'center', background: expandedFiles.includes(f.name) ? 'var(--bg-elevated)' : 'transparent' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                        <span style={{ fontSize: '1.2rem' }}>{expandedFiles.includes(f.name) ? '📂' : '📁'}</span>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{f.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {(f.size / 1024).toFixed(1)} KB • {new Date(f.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-sm btn-outline" onClick={() => toggleFile(f.name)}>
                                            {expandedFiles.includes(f.name) ? 'Hide Content' : 'View Content'}
                                        </button>
                                        <button className="btn btn-sm btn-success" onClick={() => handleProcess(f.name)} title="Add to Inventory">
                                            ✅ Process
                                        </button>
                                        <button className="btn btn-sm btn-ghost text-danger" onClick={() => handleDelete(f.name)} title="Delete File">🗑️ Delete</button>
                                    </div>
                                </div>
                                {expandedFiles.includes(f.name) && (
                                    <div className="file-content" style={{ padding: '0 1rem 1rem 1rem' }}>
                                        <ExcelViewer filename={f.name} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
