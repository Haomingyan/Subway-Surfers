import { useState, useEffect, useRef, useCallback } from 'react';
import propTypes from 'prop-types';
import axios from 'axios';
import { stationMapping } from './StationMapping';
import './RealtimeData.css';
import { Link } from 'react-router-dom';

// Official MTA line colors
const lineColors = {
  'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
  'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'M': '#FF6319',
  'G': '#6CBE45',
  'J': '#996633', 'Z': '#996633',
  'L': '#A7A9AC',
  'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  '4': '#00933C', '5': '#00933C', '6': '#00933C',
  '7': '#B933AD',
  'S': '#808183',
};

const darkTextLines = new Set(['N', 'Q', 'R', 'W']);

function LineBadge({ line, size = 'normal' }) {
  const bg = lineColors[line] || '#0039A6';
  const color = darkTextLines.has(line) ? '#333' : '#fff';
  const className = size === 'small' ? 'line-badge line-badge-sm' : 'line-badge';
  return (
    <span className={className} style={{ backgroundColor: bg, color }}>
      {line}
    </span>
  );
}

function ErrorMessage({ message }) {
  return (
    <div className="error-message">
      <span className="error-icon">!</span>
      {message}
    </div>
  );
}

ErrorMessage.propTypes = {
  message: propTypes.string.isRequired,
};

const REFRESH_INTERVAL = 60;

function RealtimeData() {
  const [error, setError] = useState('');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentLines, setcurrentLines] = useState('bdfm');
  const [timeUpdated, setTimeUpdated] = useState('');
  const [currentLinesArray, setcurrentLinesArray] = useState(["B", "D", "F", "M"]);
  const [currentLine, setcurrentLine] = useState('');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef(null);

  const subwayLines = [
    { id: 'bdfm', lines: ['B', 'D', 'F', 'M'] },
    { id: 'ace', lines: ['A', 'C', 'E'] },
    { id: 'g', lines: ['G'] },
    { id: 'jz', lines: ['J', 'Z'] },
    { id: 'l', lines: ['L'] },
    { id: 'nqrw', lines: ['N', 'Q', 'R', 'W'] },
    { id: '1234567s', lines: ['1', '2', '3', '4', '5', '6', '7'] },
    { id: 'sir', lines: ['SIR'], label: 'Staten Island Railway' }
  ];

  const startCountdown = () => {
    setCountdown(REFRESH_INTERVAL);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return REFRESH_INTERVAL;
        return prev - 1;
      });
    }, 1000);
  };

  const fetchData = useCallback((line = currentLines) => {
    setLoading(true);
    setError('');

    axios.get(`/${line}`)
      .then(({ data }) => {
        setTrips(data);
        setTimeUpdated(new Date().toLocaleTimeString());
        setLoading(false);
        startCountdown();
      })
      .catch(err => {
        setError(`There was a problem retrieving data for line ${line.toUpperCase()}. ${err}`);
        setLoading(false);
      });
  }, [currentLines]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => {
      fetchData();
    }, REFRESH_INTERVAL * 1000);

    return () => {
      clearInterval(intervalId);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchData]);

  const handleLineChange = (line) => {
    setcurrentLines(line);
    setTrips([]);
    fetchData(line);
    let lines = [];
    if (line === "bdfm") lines = ["B", "D", "F", "M"];
    if (line === "ace") lines = ["A", "C", "E"];
    if (line === "g") lines = ["G"];
    if (line === "jz") lines = ["J", "Z"];
    if (line === "l") lines = ["L"];
    if (line === "nqrw") lines = ["N", "Q", "R", "W"];
    if (line === "1234567s") lines = ["1", "2", "3", "4", "5", "6", "7"];
    if (line === "sir") lines = ['Staten Island Railway'];
    setcurrentLinesArray(lines);
    setcurrentLine('');
  };

  const handleLineChange2 = (line) => {
    setcurrentLine(line);
  };

  const getStationName = (stopId) => {
    return stationMapping[stopId] || stopId;
  };

  const getTripDirection = (tripId) => {
    let dotIndex = tripId.indexOf(".");
    if (tripId[dotIndex + 2] === 'N') return 'Northbound';
    if (tripId[dotIndex + 2] === 'S') return 'Southbound';
    return 'Unknown direction';
  };

  const getTripLine = (tripId) => {
    let dotIndex = tripId.indexOf(".");
    return tripId[dotIndex - 1];
  };

  const getTimeUntil = (timeString) => {
    if (!timeString) return 'N/A';
    const arrivalTime = new Date(timeString);
    const now = new Date();
    const diffMs = arrivalTime - now;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 0) return 'Departed';
    if (diffMin === 0) return 'Arriving now';
    return `${diffMin} min`;
  };

  const getEtaClass = (timeString) => {
    if (!timeString) return 'eta';
    const arrivalTime = new Date(timeString);
    const now = new Date();
    const diffMin = Math.floor((arrivalTime - now) / 60000);
    if (diffMin < 0) return 'eta eta-departed';
    if (diffMin === 0) return 'eta eta-now';
    if (diffMin <= 3) return 'eta eta-soon';
    return 'eta';
  };

  const getFirstStopEta = (trip) => {
    if (!trip.stop_time_updates || trip.stop_time_updates.length === 0) return null;
    const first = trip.stop_time_updates[0];
    return {
      station: getStationName(first.stop_id),
      eta: getTimeUntil(first.arrival_time),
      etaClass: getEtaClass(first.arrival_time),
    };
  };

  const renderTripCard = (trip) => {
    const line = getTripLine(trip.trip_id);
    const accentColor = lineColors[line] || '#0039A6';
    const firstStop = getFirstStopEta(trip);

    return (
      <div key={trip.trip_id} className="trip-card" style={{ borderLeftColor: accentColor }}>
        <div className="trip-header">
          <div className="trip-header-left">
            <LineBadge line={line} />
            {firstStop && (
              <span className="trip-next-stop">
                Next: <strong>{firstStop.station}</strong>
              </span>
            )}
          </div>
          {firstStop && (
            <span className={firstStop.etaClass + ' trip-header-eta'}>
              {firstStop.eta}
            </span>
          )}
        </div>
        <div className="trip-stops">
          {trip.stop_time_updates.slice(0, 8).map((stop, j) => (
            <div key={stop.stop_id + j} className="stop-row">
              <div className="stop-dot-col">
                <span className="stop-dot" style={{ borderColor: accentColor }} />
                {j < Math.min(trip.stop_time_updates.length, 8) - 1 && (
                  <span className="stop-line" style={{ backgroundColor: accentColor }} />
                )}
              </div>
              <div className="stop-info">
                <Link to={`/station/${encodeURIComponent(getStationName(stop.stop_id))}`} className="stop-name">
                  {getStationName(stop.stop_id)}
                </Link>
                <span className="stop-time">
                  {stop.arrival_time ? new Date(stop.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </span>
              </div>
              <span className={getEtaClass(stop.arrival_time)}>
                {getTimeUntil(stop.arrival_time)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const LoadingSkeleton = () => (
    <div className="skeleton-container">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-header" />
          <div className="skeleton-rows">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="skeleton-row" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="realtime-container">
      {/* Hero Header */}
      <header className="app-header">
        {/* Animated track line */}
        <div className="header-track">
          <div className="header-track-line" />
          <div className="header-train-dot" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="header-station-dot" style={{ left: `${15 + i * 14}%` }} />
          ))}
        </div>
        <div className="app-header-content">
          <div className="app-title-row">
            <h1 className="app-title">NYC Subway Live</h1>
            <span className="live-badge">
              <span className="live-dot" />
              LIVE
            </span>
            <Link to="/map" className="map-view-btn">
              🗺 Map View
            </Link>
          </div>
          <p className="app-subtitle">Real-time train arrivals across all MTA lines</p>
        </div>
        <div className="header-rainbow" />
      </header>

      {/* Line Selector */}
      <section className="line-selector-section">
        <h3 className="section-label">Select a line group</h3>
        <div className="line-buttons">
          {subwayLines.map(line => (
            <button
              key={line.id}
              className={`line-group-button ${currentLines === line.id ? 'active' : ''}`}
              onClick={() => handleLineChange(line.id)}
            >
              {line.label ? line.label : line.lines.map(l => (
                <LineBadge key={l} line={l} size="small" />
              ))}
            </button>
          ))}
        </div>

        {/* Individual line filter */}
        <div className="line-filter">
          {currentLinesArray.map(line => {
            const bg = lineColors[line] || '#0039A6';
            const textColor = darkTextLines.has(line) ? '#333' : '#fff';
            const isActive = currentLine === line;
            return (
              <button
                key={line}
                className={`line-badge-btn ${isActive ? 'active' : ''}`}
                style={{ backgroundColor: bg, color: textColor }}
                onClick={() => handleLineChange2(line)}
              >
                {line}
              </button>
            );
          })}
        </div>
      </section>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-bar-left">
          <h3 className="showing-trips-header">
            Showing trips for{' '}
            {currentLine === ""
              ? subwayLines.find(l => l.id === currentLines)?.lines.map(l => (
                  <LineBadge key={l} line={l} size="small" />
                ))
              : <LineBadge line={currentLine} size="small" />
            }
          </h3>
          {timeUpdated && <span className="last-updated">Updated {timeUpdated}</span>}
        </div>
        <button className="refresh-button" onClick={() => fetchData()} disabled={loading}>
          {loading ? (
            <span className="refresh-spinner" />
          ) : (
            <>↻ Refresh</>
          )}
        </button>
      </div>

      {/* Refresh progress bar */}
      {!loading && timeUpdated && (
        <div className="refresh-progress-track">
          <div
            className="refresh-progress-bar"
            style={{ width: `${(countdown / REFRESH_INTERVAL) * 100}%` }}
          />
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {loading && <LoadingSkeleton />}

      {/* Trip columns */}
      <div className="trips-container">
        {trips.length > 0 ? (
          <div className="direction-columns">
            <div className="direction-column">
              <div className="direction-header">
                <span className="direction-arrow">↑</span>
                Northbound
              </div>
              {trips
                .filter(trip => getTripDirection(trip.trip_id) === "Northbound")
                .filter(trip => currentLine === "" || getTripLine(trip.trip_id) === currentLine)
                .slice(0, 10)
                .map(trip => renderTripCard(trip))}
              {trips.filter(trip => getTripDirection(trip.trip_id) === "Northbound")
                .filter(trip => currentLine === "" || getTripLine(trip.trip_id) === currentLine)
                .length === 0 &&
                <p className="no-trips">No northbound trips available</p>
              }
            </div>

            <div className="direction-column">
              <div className="direction-header">
                <span className="direction-arrow">↓</span>
                Southbound
              </div>
              {trips
                .filter(trip => getTripDirection(trip.trip_id) === "Southbound")
                .filter(trip => currentLine === "" || getTripLine(trip.trip_id) === currentLine)
                .slice(0, 10)
                .map(trip => renderTripCard(trip))}
              {trips.filter(trip => getTripDirection(trip.trip_id) === "Southbound")
                .filter(trip => currentLine === "" || getTripLine(trip.trip_id) === currentLine)
                .length === 0 &&
                <p className="no-trips">No southbound trips available</p>
              }
            </div>
          </div>
        ) : (
          !loading && <p className="no-trips">No trips data available</p>
        )}
      </div>
    </div>
  );
}

export default RealtimeData;
