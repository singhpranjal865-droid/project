import { useState, useEffect } from 'react';
import api from '../api';

export default function ExcelViewer({ filename }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeSheet, setActiveSheet] = useState(0);

    useEffect(() => {
        setLoading(true);
        api.get(`/excel/files/${filename}/view`)
            .then(res => {
                setData(res.data);
                if (res.data.sheets.length > 0) setActiveSheet(0);
            })
            .catch(err => setError(err.response?.data?.error || 'Failed to load file'))
            .finally(() => setLoading(false));
    }, [filename]);

    if (loading) return <div className="p-4 flex justify-center"><div className="spinner"></div></div>;
    if (error) return <div className="alert alert-danger">{error}</div>;
    if (!data || data.sheets.length === 0) return <div className="text-muted">No content found</div>;

    const sheet = data.sheets[activeSheet];

    return (
        <div className="excel-viewer" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginTop: '1rem', background: 'var(--bg-secondary)' }}>
            {/* Sheet Tabs */}
            <div className="sheet-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', overflowX: 'auto' }}>
                {data.sheets.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveSheet(i)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: i === activeSheet ? 'var(--bg-secondary)' : 'transparent',
                            border: 'none',
                            borderRight: '1px solid var(--border)',
                            borderBottom: i === activeSheet ? '2px solid var(--primary)' : 'none',
                            color: i === activeSheet ? 'var(--primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontWeight: i === activeSheet ? 600 : 400
                        }}
                    >
                        {s.name}
                    </button>
                ))}
            </div>

            <div className="sheet-body" style={{ padding: '1rem', overflowX: 'auto' }}>
                {/* Images Section */}
                {sheet.images && sheet.images.length > 0 && (
                    <div className="sheet-images" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {sheet.images.map((img, i) => (
                            <div key={i} style={{ border: '1px solid var(--border)', padding: '0.25rem', borderRadius: '4px', background: 'white' }}>
                                <img
                                    src={`data:${img.type || img.extension === 'png' ? 'image/png' : 'image/jpeg'};base64,${img.base64}`}
                                    alt={`Embedded content ${i + 1}`}
                                    style={{ maxWidth: '100%', maxHeight: '300px', display: 'block' }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Data Table */}
                {sheet.rows.length > 0 ? (
                    <table className="excel-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <tbody>
                            {sheet.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} style={{ background: rowIndex === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                                    <td style={{
                                        padding: '0.25rem 0.5rem',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-muted)',
                                        width: '40px',
                                        textAlign: 'center',
                                        userSelect: 'none',
                                        fontSize: '0.8rem'
                                    }}>
                                        {rowIndex + 1}
                                    </td>
                                    {row.map((cell, colIndex) => (
                                        <td key={colIndex} style={{
                                            padding: '0.5rem',
                                            border: '1px solid var(--border)',
                                            whiteSpace: 'nowrap',
                                            fontWeight: rowIndex === 0 ? 600 : 400
                                        }}>
                                            {cell !== null && cell !== undefined ? String(cell) : ''}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-muted">Empty Sheet</div>
                )}
            </div>
        </div>
    );
}
