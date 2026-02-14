import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import AuthModal from './AuthModal';

export default function Navbar() {
    const { user, isAuthenticated, logout } = useAuth();
    const location = useLocation();
    const [showAuth, setShowAuth] = useState(false);

    const links = [
        { to: '/', label: 'Dashboard', icon: '📊' },
        { to: '/components', label: 'Components', icon: '🔧' },
        { to: '/pcbs', label: 'PCBs', icon: '🖥️' },
        { to: '/procurement', label: 'Procurement', icon: '📦' },
        { to: '/analytics', label: 'Analytics', icon: '📈' },
        { to: '/excel', label: 'Excel Files', icon: '📂' },
    ];

    return (
        <>
            <nav className="navbar">
                <div className="navbar-inner">
                    <Link to="/" className="navbar-brand">
                        <div className="logo">⚡</div>
                        PCB Inventory
                    </Link>

                    <ul className="navbar-links">
                        {links.map(link => (
                            <li key={link.to}>
                                <Link
                                    to={link.to}
                                    className={location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to)) ? 'active' : ''}
                                >
                                    {link.icon} {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    <div className="navbar-actions">
                        {isAuthenticated ? (
                            <>
                                <span className="admin-badge">🔐 {user.username}</span>
                                <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
                            </>
                        ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => setShowAuth(true)}>
                                🔐 Login
                            </button>
                        )}
                    </div>
                </div>
            </nav>
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        </>
    );
}
