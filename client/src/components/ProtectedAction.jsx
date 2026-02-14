import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

export default function ProtectedAction({ children, onAction }) {
    const { isAuthenticated } = useAuth();
    const [showAuth, setShowAuth] = useState(false);

    const handleClick = () => {
        if (!isAuthenticated) {
            setShowAuth(true);
        } else {
            onAction?.();
        }
    };

    return (
        <>
            <span onClick={handleClick} style={{ cursor: 'pointer' }}>
                {children}
            </span>
            {showAuth && (
                <AuthModal
                    onClose={() => setShowAuth(false)}
                    onSuccess={() => {
                        setShowAuth(false);
                        onAction?.();
                    }}
                />
            )}
        </>
    );
}
