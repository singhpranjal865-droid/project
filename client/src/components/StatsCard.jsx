export default function StatsCard({ label, value, icon, variant = 'accent' }) {
    return (
        <div className={`stat-card ${variant}`}>
            <div className="stat-icon">{icon}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
        </div>
    );
}
