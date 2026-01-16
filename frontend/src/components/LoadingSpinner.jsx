import './LoadingSpinner.css';

export default function LoadingSpinner() {
    return (
        <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Loading...</p>
        </div>
    );
}
