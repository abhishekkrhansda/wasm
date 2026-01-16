import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { casesAPI } from '../services/api';
import './Cases.css';

export default function Cases() {
    const [cases, setCases] = useState([]);
    const [pagination, setPagination] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();

    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
    const page = parseInt(searchParams.get('page')) || 1;

    useEffect(() => {
        loadCases();
    }, [status, priority, page]);

    const loadCases = async () => {
        setLoading(true);
        try {
            const response = await casesAPI.list({ status, priority, page, limit: 10 });
            setCases(response.data.cases);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Failed to load cases:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateFilter = (key, value) => {
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        params.delete('page');
        setSearchParams(params);
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

    return (
        <div className="cases-page fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cases</h1>
                    <p className="page-subtitle">Manage and track all cases</p>
                </div>
                <Link to="/cases/new" className="btn btn-primary">
                    + New Case
                </Link>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <select
                    className="form-select filter-select"
                    value={status}
                    onChange={(e) => updateFilter('status', e.target.value)}
                >
                    <option value="">All Statuses</option>
                    <option value="Created">Created</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Closed">Closed</option>
                </select>

                <select
                    className="form-select filter-select"
                    value={priority}
                    onChange={(e) => updateFilter('priority', e.target.value)}
                >
                    <option value="">All Priorities</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                </select>
            </div>

            {/* Cases Table */}
            <div className="card">
                {loading ? (
                    <div className="loading">Loading cases...</div>
                ) : (
                    <>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Case ID</th>
                                    <th>Title</th>
                                    <th>Category</th>
                                    <th>Status</th>
                                    <th>Priority</th>
                                    <th>SLA</th>
                                    <th>Assigned To</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cases.map(c => (
                                    <tr key={c.id}>
                                        <td>
                                            <Link to={`/cases/${c.id}`} className="case-link">
                                                {c.case_id}
                                            </Link>
                                        </td>
                                        <td className="title-cell">{c.title}</td>
                                        <td>{c.category}</td>
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
                                        <td>{c.assigned_to_name || <span className="text-muted">Unassigned</span>}</td>
                                        <td className="text-muted">{new Date(c.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                {cases.length === 0 && (
                                    <tr>
                                        <td colSpan="8" className="text-center text-muted">No cases found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    className="btn btn-ghost"
                                    disabled={page <= 1}
                                    onClick={() => updateFilter('page', page - 1)}
                                >
                                    Previous
                                </button>
                                <span className="pagination-info">
                                    Page {page} of {pagination.totalPages}
                                </span>
                                <button
                                    className="btn btn-ghost"
                                    disabled={page >= pagination.totalPages}
                                    onClick={() => updateFilter('page', page + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
