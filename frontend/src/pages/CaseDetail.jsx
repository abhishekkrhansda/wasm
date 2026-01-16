import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { casesAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './CaseDetail.css';

export default function CaseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [caseData, setCaseData] = useState(null);
    const [comments, setComments] = useState([]);
    const [analysts, setAnalysts] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const isManager = ['manager', 'admin'].includes(user?.role);
    const isAnalyst = user?.role === 'analyst';

    useEffect(() => {
        loadCase();
    }, [id]);

    const loadCase = async () => {
        try {
            const [caseRes, commentsRes] = await Promise.all([
                casesAPI.get(id),
                casesAPI.getComments(id)
            ]);
            setCaseData(caseRes.data.case);
            setComments(commentsRes.data.comments);

            if (isManager) {
                const analystsRes = await usersAPI.getAnalysts();
                setAnalysts(analystsRes.data.analysts);
            }
        } catch (error) {
            console.error('Failed to load case:', error);
            navigate('/cases');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusTransition = async (newStatus) => {
        setActionLoading(true);
        try {
            await casesAPI.updateStatus(id, newStatus);
            await loadCase();
        } catch (error) {
            alert(error.response?.data?.reason || 'Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAssign = async (assigneeId) => {
        setActionLoading(true);
        try {
            await casesAPI.assign(id, parseInt(assigneeId));
            await loadCase();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to assign case');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            await casesAPI.addComment(id, newComment);
            setNewComment('');
            const res = await casesAPI.getComments(id);
            setComments(res.data.comments);
        } catch (error) {
            alert('Failed to add comment');
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
        return `badge-${priority?.toLowerCase()}`;
    };

    if (loading) {
        return <div className="loading">Loading case...</div>;
    }

    if (!caseData) {
        return <div className="loading">Case not found</div>;
    }

    return (
        <div className="case-detail fade-in">
            <div className="case-detail-header">
                <div>
                    <Link to="/cases" className="back-link">← Back to Cases</Link>
                    <h1 className="case-title">
                        <span className="case-id">{caseData.case_id}</span>
                        {caseData.title}
                    </h1>
                </div>
                <div className="case-badges">
                    <span className={`badge badge-lg ${getStatusBadgeClass(caseData.status)}`}>
                        {caseData.status}
                    </span>
                    <span className={`badge badge-lg ${getPriorityBadgeClass(caseData.priority)}`}>
                        {caseData.priority}
                    </span>
                </div>
            </div>

            <div className="case-detail-grid">
                {/* Main Content */}
                <div className="case-main">
                    {/* Description */}
                    <div className="card">
                        <h2 className="card-title">Description</h2>
                        <p className="case-description">
                            {caseData.description || <span className="text-muted">No description provided</span>}
                        </p>
                    </div>

                    {/* Workflow Actions */}
                    {caseData.availableTransitions?.length > 0 && (
                        <div className="card workflow-card">
                            <h2 className="card-title">Workflow Actions</h2>
                            <div className="workflow-actions">
                                {caseData.availableTransitions.map(status => (
                                    <button
                                        key={status}
                                        className={`btn btn-workflow ${getStatusBadgeClass(status)}`}
                                        onClick={() => handleStatusTransition(status)}
                                        disabled={actionLoading}
                                    >
                                        Transition to {status}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Assignment (Manager only) */}
                    {isManager && caseData.status === 'Created' && (
                        <div className="card">
                            <h2 className="card-title">Assign Case</h2>
                            <div className="assign-form">
                                <select
                                    className="form-select"
                                    value={caseData.assigned_to || ''}
                                    onChange={(e) => handleAssign(e.target.value)}
                                    disabled={actionLoading}
                                >
                                    <option value="">Select Analyst...</option>
                                    {analysts.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Comments */}
                    <div className="card">
                        <h2 className="card-title">Comments ({comments.length})</h2>

                        <form className="comment-form" onSubmit={handleAddComment}>
                            <textarea
                                className="form-textarea"
                                placeholder="Add a comment..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                rows={3}
                            />
                            <button type="submit" className="btn btn-primary" disabled={!newComment.trim()}>
                                Add Comment
                            </button>
                        </form>

                        <div className="comments-list">
                            {comments.map(comment => (
                                <div key={comment.id} className="comment">
                                    <div className="comment-header">
                                        <div className="comment-author-info">
                                            <span className="comment-author">{comment.created_by_name}</span>
                                            <span className={`badge badge-role badge-${comment.created_by_role}`}>
                                                {comment.created_by_role}
                                            </span>
                                        </div>
                                        <span className="comment-time">
                                            {new Date(comment.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="comment-text">{comment.comment}</p>
                                </div>
                            ))}
                            {comments.length === 0 && (
                                <p className="text-muted text-center">No comments yet</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="case-sidebar">
                    <div className="card">
                        <h3 className="sidebar-title">Details</h3>
                        <dl className="details-list">
                            <div className="detail-item">
                                <dt>Category</dt>
                                <dd>{caseData.category}</dd>
                            </div>
                            <div className="detail-item">
                                <dt>Created By</dt>
                                <dd>{caseData.created_by_name}</dd>
                            </div>
                            <div className="detail-item">
                                <dt>Assigned To</dt>
                                <dd>{caseData.assigned_to_name || <span className="text-muted">Unassigned</span>}</dd>
                            </div>
                            <div className="detail-item">
                                <dt>Created</dt>
                                <dd>{new Date(caseData.created_at).toLocaleString()}</dd>
                            </div>
                            <div className="detail-item">
                                <dt>Last Updated</dt>
                                <dd>{new Date(caseData.updated_at).toLocaleString()}</dd>
                            </div>
                            {caseData.sla_due_at && (
                                <div className="detail-item">
                                    <dt>SLA Due</dt>
                                    <dd className={new Date(caseData.sla_due_at) < new Date() ? 'sla-breached' : ''}>
                                        {new Date(caseData.sla_due_at).toLocaleString()}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
}
