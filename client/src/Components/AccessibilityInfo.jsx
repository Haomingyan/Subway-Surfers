import { useState, useEffect } from 'react';
import axios from 'axios';
import './AccessibilityInfo.css';

const AccessibilityInfo = ({ stationId }) => {
    const [accessibilityData, setAccessibilityData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAccessibilityData = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`/mta/accessibility/${stationId}`);
                setAccessibilityData(response.data);
                setError(null);
            } catch (err) {
                setError('Failed to load accessibility information');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (stationId) {
            fetchAccessibilityData();
        }
    }, [stationId]);

    if (loading) return (
        <div className="acc-container">
            <div className="acc-loading">
                <div className="acc-loading-spinner" />
                <p>Loading accessibility information...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="acc-container">
            <div className="acc-error">
                <span className="acc-error-icon">!</span>
                {error}
            </div>
        </div>
    );

    if (!accessibilityData) return (
        <div className="acc-container">
            <p className="acc-empty">No accessibility data available</p>
        </div>
    );

    const workingElevators = accessibilityData.elevators.filter(el => el.is_working);
    const outOfServiceElevators = accessibilityData.elevators.filter(el => !el.is_working);
    const workingEscalators = accessibilityData.escalators.filter(esc => esc.is_working);
    const outOfServiceEscalators = accessibilityData.escalators.filter(esc => !esc.is_working);
    const hasUpcomingOutages = accessibilityData.upcoming_outages && accessibilityData.upcoming_outages.length > 0;

    return (
        <div className="acc-container">
            {/* Header */}
            <div className="acc-header">
                <h2 className="acc-title">Station Accessibility</h2>
                <a href="/" className="acc-back-btn">← Back to Live Trains</a>
            </div>

            {/* Summary Stats */}
            <div className="acc-stats-grid">
                <div className="acc-stat-card">
                    <span className="acc-stat-icon acc-stat-elevator">⬆</span>
                    <div className="acc-stat-info">
                        <span className="acc-stat-number">{accessibilityData.elevators.length}</span>
                        <span className="acc-stat-label">Elevators</span>
                    </div>
                </div>
                <div className="acc-stat-card">
                    <span className="acc-stat-icon acc-stat-escalator">⏫</span>
                    <div className="acc-stat-info">
                        <span className="acc-stat-number">{accessibilityData.escalators.length}</span>
                        <span className="acc-stat-label">Escalators</span>
                    </div>
                </div>
                <div className="acc-stat-card acc-stat-working">
                    <span className="acc-stat-icon acc-stat-ok">✓</span>
                    <div className="acc-stat-info">
                        <span className="acc-stat-number">{workingElevators.length + workingEscalators.length}</span>
                        <span className="acc-stat-label">In Service</span>
                    </div>
                </div>
                <div className={`acc-stat-card ${outOfServiceElevators.length + outOfServiceEscalators.length > 0 ? 'acc-stat-alert' : ''}`}>
                    <span className="acc-stat-icon acc-stat-err">✕</span>
                    <div className="acc-stat-info">
                        <span className="acc-stat-number">{outOfServiceElevators.length + outOfServiceEscalators.length}</span>
                        <span className="acc-stat-label">Out of Service</span>
                    </div>
                </div>
            </div>

            {/* Elevators */}
            <section className="acc-section">
                <h3 className="acc-section-title">
                    <span className="acc-section-icon">⬆</span>
                    Elevators
                </h3>

                {workingElevators.length > 0 && (
                    <div className="acc-group">
                        <h4 className="acc-group-title acc-group-ok">In Service ({workingElevators.length})</h4>
                        <div className="acc-items">
                            {workingElevators.map((elevator, index) => (
                                <div key={`working-${index}`} className="acc-item acc-item-ok">
                                    <div className="acc-item-status">
                                        <span className="acc-status-dot acc-dot-ok" />
                                    </div>
                                    <div className="acc-item-content">
                                        <span className="acc-item-id">{elevator.id || 'N/A'}</span>
                                        <span className="acc-item-location">{elevator.location || 'N/A'}</span>
                                    </div>
                                    <span className="acc-item-badge acc-badge-ok">
                                        {elevator.status || 'In Service'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {outOfServiceElevators.length > 0 && (
                    <div className="acc-group">
                        <h4 className="acc-group-title acc-group-err">Out of Service ({outOfServiceElevators.length})</h4>
                        <div className="acc-items">
                            {outOfServiceElevators.map((elevator, index) => (
                                <div key={`out-${index}`} className="acc-item acc-item-err">
                                    <div className="acc-item-status">
                                        <span className="acc-status-dot acc-dot-err" />
                                    </div>
                                    <div className="acc-item-content">
                                        <span className="acc-item-id">{elevator.id || 'N/A'}</span>
                                        <span className="acc-item-location">{elevator.location || 'N/A'}</span>
                                        {elevator.estimated_return && (
                                            <span className="acc-item-return">Est. Return: {elevator.estimated_return}</span>
                                        )}
                                    </div>
                                    <span className="acc-item-badge acc-badge-err">
                                        {elevator.status || 'Out of Service'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {accessibilityData.elevators.length === 0 && (
                    <p className="acc-empty">No elevators at this station</p>
                )}
            </section>

            {/* Escalators */}
            <section className="acc-section">
                <h3 className="acc-section-title">
                    <span className="acc-section-icon">⏫</span>
                    Escalators
                </h3>

                {workingEscalators.length > 0 && (
                    <div className="acc-group">
                        <h4 className="acc-group-title acc-group-ok">In Service ({workingEscalators.length})</h4>
                        <div className="acc-items">
                            {workingEscalators.map((escalator, index) => (
                                <div key={`working-${index}`} className="acc-item acc-item-ok">
                                    <div className="acc-item-status">
                                        <span className="acc-status-dot acc-dot-ok" />
                                    </div>
                                    <div className="acc-item-content">
                                        <span className="acc-item-id">{escalator.id || 'N/A'}</span>
                                        <span className="acc-item-location">{escalator.location || 'N/A'}</span>
                                    </div>
                                    <span className="acc-item-badge acc-badge-ok">
                                        {escalator.status || 'In Service'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {outOfServiceEscalators.length > 0 && (
                    <div className="acc-group">
                        <h4 className="acc-group-title acc-group-err">Out of Service ({outOfServiceEscalators.length})</h4>
                        <div className="acc-items">
                            {outOfServiceEscalators.map((escalator, index) => (
                                <div key={`out-${index}`} className="acc-item acc-item-err">
                                    <div className="acc-item-status">
                                        <span className="acc-status-dot acc-dot-err" />
                                    </div>
                                    <div className="acc-item-content">
                                        <span className="acc-item-id">{escalator.id || 'N/A'}</span>
                                        <span className="acc-item-location">{escalator.location || 'N/A'}</span>
                                        {escalator.estimated_return && (
                                            <span className="acc-item-return">Est. Return: {escalator.estimated_return}</span>
                                        )}
                                    </div>
                                    <span className="acc-item-badge acc-badge-err">
                                        {escalator.status || 'Out of Service'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {accessibilityData.escalators.length === 0 && (
                    <p className="acc-empty">No escalators at this station</p>
                )}
            </section>

            {/* Upcoming Outages */}
            {hasUpcomingOutages && (
                <section className="acc-section">
                    <h3 className="acc-section-title">
                        <span className="acc-section-icon">⚠</span>
                        Upcoming Outages
                        <span className="acc-outage-count">{accessibilityData.upcoming_outages.length}</span>
                    </h3>
                    <div className="acc-items">
                        {accessibilityData.upcoming_outages.map((outage, index) => (
                            <div key={index} className="acc-item acc-item-warn">
                                <div className="acc-item-status">
                                    <span className="acc-status-dot acc-dot-warn" />
                                </div>
                                <div className="acc-item-content">
                                    <span className="acc-item-id">{outage.type || 'N/A'}</span>
                                    <span className="acc-item-location">{outage.reason || 'N/A'}</span>
                                    <span className="acc-item-return">
                                        {outage.start_date || 'N/A'} — {outage.end_date || 'N/A'}
                                    </span>
                                </div>
                                <span className="acc-item-badge acc-badge-warn">Planned</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default AccessibilityInfo;
