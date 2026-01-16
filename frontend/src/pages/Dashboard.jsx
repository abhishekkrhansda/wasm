import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI, casesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
    const [summary, setSummary] = useState(null);
    const [recentCases, setRecentCases] = useState([]);
    const [pendingData, setPendingData] = useState({ pendingCases: [], pendingReviews: [], totalPending: 0 });
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const [summaryRes, casesRes, pendingRes] = await Promise.all([
                dashboardAPI.getSummary(),
                casesAPI.list({ limit: 5 }),
                dashboardAPI.getMyPendingActions()
            ]);
            setSummary(summaryRes.data.summary);
            setRecentCases(casesRes.data.cases);
            setPendingData(pendingRes.data);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        const map = {
            'Created': 'badge-created',
            'Assigned': 'badge-assigned',
            'In Progress': 'badge-progress',
            'Under Review': 'badge-review',
            'Closed': 'badge-closed'
        };
        return map[status] || '';
    };

    const getPriorityBadgeClass = (priority) => {
        return `badge-${priority.toLowerCase()}`;
    };

    const getSlaLabel = (slaStatus) => {
        if (slaStatus === 'overdue') return { label: '⚠ Overdue', class: 'sla-overdue' };
        if (slaStatus === 'at_risk') return { label: '⏱ SLA at risk', class: 'sla-at-risk' };
        return null;
    };

    if (loading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    return (
        <div className="dashboard fade-in">
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-subtitle">Welcome back, {user?.name}!</p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{summary?.total || 0}</div>
                    <div className="stat-label">Total Cases</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{summary?.open || 0}</div>
                    <div className="stat-label">Open Cases</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{summary?.closed || 0}</div>
                    <div className="stat-label">Closed Cases</div>
                </div>
                <div className="stat-card stat-card-highlight">
                    <div className="stat-value">{pendingData.totalPending}</div>
                    <div className="stat-label">My Pending</div>
                </div>
            </div>

            {/* My Pending Actions */}
            {pendingData.totalPending > 0 && (
                <div className="pending-actions-section">
                    {pendingData.pendingCases.length > 0 && (
                        <div className="card pending-card">
                            <div className="card-header">
                                <h2 className="card-title">
                                    📋 {user?.role === 'manager' || user?.role === 'admin'
                                        ? 'Cases Awaiting Assignment'
                                        : 'Cases Waiting for Your Action'}
                                </h2>
                                <span className="pending-count">{pendingData.pendingCases.length}</span>
                            </div>
                            <div className="pending-list">
                                {pendingData.pendingCases.slice(0, 5).map(c => (
                                    <Link key={c.id} to={`/cases/${c.id}`} className="pending-item">
                                        <div className="pending-item-main">
                                            <span className="pending-case-id">{c.case_id}</span>
                                            <span className="pending-title">{c.title}</span>
                                        </div>
                                        <div className="pending-item-badges">
                                            <span className={`badge ${getStatusBadgeClass(c.status)}`}>{c.status}</span>
                                            {getSlaLabel(c.sla_status) && (
                                                <span className={`sla-badge ${getSlaLabel(c.sla_status).class}`}>
                                                    {getSlaLabel(c.sla_status).label}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {pendingData.pendingReviews.length > 0 && (
                        <div className="card pending-card">
                            <div className="card-header">
                                <h2 className="card-title">📝 Pending Reviews</h2>
                                <span className="pending-count">{pendingData.pendingReviews.length}</span>
                            </div>
                            <div className="pending-list">
                                {pendingData.pendingReviews.slice(0, 5).map(c => (
                                    <Link key={c.id} to={`/cases/${c.id}`} className="pending-item">
                                        <div className="pending-item-main">
                                            <span className="pending-case-id">{c.case_id}</span>
                                            <span className="pending-title">{c.title}</span>
                                            <span className="pending-assignee">by {c.assigned_to_name}</span>
                                        </div>
                                        <div className="pending-item-badges">
                                            {getSlaLabel(c.sla_status) && (
                                                <span className={`sla-badge ${getSlaLabel(c.sla_status).class}`}>
                                                    {getSlaLabel(c.sla_status).label}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Status Distribution */}
            <div className="dashboard-grid">
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Cases by Status</h2>
                    </div>
                    <div className="status-bars">
                        {summary?.byStatus && Object.entries(summary.byStatus).map(([status, count]) => (
                            <div key={status} className="status-bar-item">
                                <div className="status-bar-label">
                                    <span className={`badge ${getStatusBadgeClass(status)}`}>{status}</span>
                                    <span className="status-count">{count}</span>
                                </div>
                                <div className="status-bar-track">
                                    <div
                                        className={`status-bar-fill ${getStatusBadgeClass(status)}`}
                                        style={{ width: `${(count / summary.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Priority Distribution</h2>
                    </div>
                    <div className="priority-grid">
                        {summary?.byPriority && Object.entries(summary.byPriority).map(([priority, count]) => (
                            <div key={priority} className="priority-item">
                                <div className={`priority-dot ${getPriorityBadgeClass(priority)}`}></div>
                                <span className="priority-label">{priority}</span>
                                <span className="priority-count">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Cases */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Recent Cases</h2>
                    <Link to="/cases" className="btn btn-secondary">View All</Link>
                </div>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Case ID</th>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>SLA</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentCases.map(c => (
                            <tr key={c.id}>
                                <td>
                                    <Link to={`/cases/${c.id}`} className="case-link">
                                        {c.case_id}
                                    </Link>
                                </td>
                                <td>{c.title}</td>
                                <td><span className={`badge ${getStatusBadgeClass(c.status)}`}>{c.status}</span></td>
                                <td><span className={`badge ${getPriorityBadgeClass(c.priority)}`}>{c.priority}</span></td>
                                <td>
                                    {getSlaLabel(c.sla_status) ? (
                                        <span className={`sla-badge ${getSlaLabel(c.sla_status).class}`}>
                                            {getSlaLabel(c.sla_status).label}
                                        </span>
                                    ) : (
                                        <span className="text-muted">—</span>
                                    )}
                                </td>
                                <td className="text-muted">{new Date(c.created_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        {recentCases.length === 0 && (
                            <tr>
                                <td colSpan="6" className="text-center text-muted">No cases yet</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
