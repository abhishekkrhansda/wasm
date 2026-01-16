import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI } from '../services/api';
import './NewCase.css';

export default function NewCase() {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'IT',
        priority: 'Medium'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await casesAPI.create(formData);
            navigate(`/cases/${response.data.case.id}`);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create case');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="new-case-page fade-in">
            <div className="page-header">
                <h1 className="page-title">Create New Case</h1>
                <p className="page-subtitle">Submit a new case for the team to review</p>
            </div>

            <div className="card new-case-form-card">
                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label className="form-label">Title *</label>
                        <input
                            type="text"
                            name="title"
                            className="form-input"
                            placeholder="Brief summary of the issue"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            maxLength={255}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            name="description"
                            className="form-textarea"
                            placeholder="Provide detailed information about the case..."
                            value={formData.description}
                            onChange={handleChange}
                            rows={6}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Category *</label>
                            <select
                                name="category"
                                className="form-select"
                                value={formData.category}
                                onChange={handleChange}
                            >
                                <option value="IT">IT</option>
                                <option value="HR">HR</option>
                                <option value="Finance">Finance</option>
                                <option value="Compliance">Compliance</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Priority *</label>
                            <select
                                name="priority"
                                className="form-select"
                                value={formData.priority}
                                onChange={handleChange}
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate('/cases')}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Case'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
