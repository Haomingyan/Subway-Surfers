import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './SubwayMap.css';

import { stationCoordinates } from './stationCoordinates';
import subwayRoutes from './subwayRoutes.json';

// MTA line colors (same as RealtimeData)
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
  'S': '#808183', 'GS': '#808183', 'FS': '#808183', 'H': '#808183',
  'SI': '#0039A6',
};

const darkTextLines = new Set(['N', 'Q', 'R', 'W']);

// Line groups for the sidebar
const lineGroups = [
  { id: 'ace', lines: ['A', 'C', 'E'] },
  { id: 'bdfm', lines: ['B', 'D', 'F', 'M'] },
  { id: 'g', lines: ['G'] },
  { id: 'jz', lines: ['J', 'Z'] },
  { id: 'l', lines: ['L'] },
  { id: 'nqrw', lines: ['N', 'Q', 'R', 'W'] },
  { id: '1234567s', lines: ['1', '2', '3', '4', '5', '6', '7'] },
  { id: 'sir', lines: ['SI'] },
];

const allLines = lineGroups.flatMap(g => g.lines);

// NYC center
const NYC_CENTER = [40.7128, -74.0060];
const DEFAULT_ZOOM = 12;

// Build a lookup: stop_id (without N/S suffix) -> coordinates
function getStationCoords(stopId) {
  const base = stopId.replace(/[NS]$/, '');
  return stationCoordinates[base] || stationCoordinates[stopId] || null;
}

// Which line does a stop belong to (based on stop_id prefix patterns)
function getStopLines(stopId) {
  const base = stopId.replace(/[NS]$/, '');
  const firstChar = base.charAt(0);
  // MTA stop ID conventions
  if (/^[1-3]\d{2}$/.test(base)) return ['1', '2', '3'];
  if (/^[4]\d{2}$/.test(base)) return ['4', '5', '6'];
  if (/^[7]\d{2}$/.test(base)) return ['7'];
  if (/^A\d{2}$/.test(base)) return ['A', 'C', 'E'];
  if (/^B\d{2}$/.test(base)) return ['B', 'D', 'F', 'M'];
  if (/^D\d{2}$/.test(base)) return ['B', 'D', 'F', 'M'];
  if (/^F\d{2}$/.test(base)) return ['F'];
  if (/^G\d{2}$/.test(base)) return ['G'];
  if (/^J\d{2}$/.test(base)) return ['J', 'Z'];
  if (/^L\d{2}$/.test(base)) return ['L'];
  if (/^M\d{2}$/.test(base)) return ['M'];
  if (/^N\d{2}$/.test(base)) return ['N', 'Q', 'R', 'W'];
  if (/^R\d{2}$/.test(base)) return ['N', 'Q', 'R', 'W'];
  if (/^H\d{2}$/.test(base)) return ['S'];
  if (/^S\d{2}$/.test(base)) return ['SI'];
  return [firstChar];
}

function SubwayMap() {
  const [activeLines, setActiveLines] = useState(new Set(allLines));
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch trip data for active lines
  const fetchTrips = useCallback(() => {
    // Figure out which API endpoints to call
    const endpointsNeeded = new Set();
    activeLines.forEach(line => {
      lineGroups.forEach(g => {
        if (g.lines.includes(line)) endpointsNeeded.add(g.id);
      });
    });

    setLoading(true);
    Promise.all(
      [...endpointsNeeded].map(ep =>
        axios.get(`/${ep}`).then(r => r.data).catch(() => [])
      )
    ).then(results => {
      setTrips(results.flat());
      setLoading(false);
    });
  }, [activeLines]);

  useEffect(() => {
    fetchTrips();
    const interval = setInterval(fetchTrips, 60000);
    return () => clearInterval(interval);
  }, [fetchTrips]);

  // Toggle a line on/off
  const toggleLine = (line) => {
    setActiveLines(prev => {
      const next = new Set(prev);
      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }
      return next;
    });
  };

  // Parse trip helpers
  const getTripLine = (tripId) => {
    const dotIndex = tripId.indexOf(".");
    return tripId[dotIndex - 1];
  };

  const getTripDirection = (tripId) => {
    const dotIndex = tripId.indexOf(".");
    if (tripId[dotIndex + 2] === 'N') return 'Northbound';
    if (tripId[dotIndex + 2] === 'S') return 'Southbound';
    return '';
  };

  const getTimeUntil = (timeString) => {
    if (!timeString) return 'N/A';
    const diffMin = Math.floor((new Date(timeString) - new Date()) / 60000);
    if (diffMin < 0) return 'Departed';
    if (diffMin === 0) return 'Arriving';
    return `${diffMin} min`;
  };

  const getEtaClass = (timeString) => {
    if (!timeString) return '';
    const diffMin = Math.floor((new Date(timeString) - new Date()) / 60000);
    if (diffMin < 0) return 'departed';
    if (diffMin === 0) return 'arriving';
    if (diffMin <= 3) return 'soon';
    return '';
  };

  // Compute station arrivals from trips
  const stationArrivals = useMemo(() => {
    const arrivals = {};
    trips.forEach(trip => {
      const line = getTripLine(trip.trip_id);
      if (!activeLines.has(line)) return;
      const direction = getTripDirection(trip.trip_id);
      (trip.stop_time_updates || []).forEach(stop => {
        const base = stop.stop_id.replace(/[NS]$/, '');
        if (!arrivals[base]) arrivals[base] = [];
        arrivals[base].push({
          line,
          direction,
          arrival_time: stop.arrival_time,
        });
      });
    });
    // Sort each station's arrivals by time, keep top 5
    Object.keys(arrivals).forEach(key => {
      arrivals[key].sort((a, b) => new Date(a.arrival_time) - new Date(b.arrival_time));
      arrivals[key] = arrivals[key].filter(a => {
        const diff = new Date(a.arrival_time) - new Date();
        return diff > -60000; // exclude departed > 1 min ago
      }).slice(0, 5);
    });
    return arrivals;
  }, [trips, activeLines]);

  // Filter stations that belong to active lines
  const visibleStations = useMemo(() => {
    const stations = {};
    Object.entries(stationCoordinates).forEach(([id, data]) => {
      // Skip directional stops (N/S suffix)
      if (/[NS]$/.test(id)) return;
      const stopLines = getStopLines(id);
      if (stopLines.some(l => activeLines.has(l))) {
        stations[id] = data;
      }
    });
    return stations;
  }, [activeLines]);

  // GeoJSON style for routes
  const routeStyle = (feature) => {
    const routeId = feature.properties.route_id;
    const isActive = activeLines.has(routeId) ||
      (routeId === 'GS' && activeLines.has('S')) ||
      (routeId === 'FS' && activeLines.has('S')) ||
      (routeId === 'H' && activeLines.has('S')) ||
      (routeId === 'SI' && activeLines.has('SI')) ||
      (routeId === 'FX' && activeLines.has('F')) ||
      (routeId === '6X' && activeLines.has('6')) ||
      (routeId === '7X' && activeLines.has('7'));

    return {
      color: feature.properties.color || lineColors[routeId] || '#999',
      weight: isActive ? 3.5 : 0,
      opacity: isActive ? 0.85 : 0,
    };
  };

  // Sidebar filtered trips
  const sidebarTrips = useMemo(() => {
    return trips
      .filter(trip => {
        const line = getTripLine(trip.trip_id);
        return activeLines.has(line);
      })
      .filter(trip => {
        // Only show trips with future stops
        return (trip.stop_time_updates || []).some(s => {
          return new Date(s.arrival_time) > new Date();
        });
      })
      .slice(0, 20);
  }, [trips, activeLines]);

  // Get line color for a station marker
  const getStationColor = (stopId) => {
    const lines = getStopLines(stopId);
    const activeLine = lines.find(l => activeLines.has(l));
    return lineColors[activeLine] || '#666';
  };

  return (
    <div className="map-page">
      {/* Header */}
      <header className="map-header">
        <div className="map-header-left">
          <Link to="/" className="map-back-btn">
            ← <span>List View</span>
          </Link>
          <h1 className="map-header-title">NYC Subway Map</h1>
          <span className="map-live-badge">
            <span className="map-live-dot" />
            LIVE
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="map-body">
        {/* Toggle sidebar button (mobile) */}
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>

        {/* Map */}
        <div className="map-container">
          <MapContainer
            center={NYC_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            {/* Subway route lines */}
            <GeoJSON
              key={[...activeLines].sort().join(',')}
              data={subwayRoutes}
              style={routeStyle}
            />

            {/* Station markers */}
            {Object.entries(visibleStations).map(([stopId, data]) => (
              <CircleMarker
                key={stopId}
                center={[data.lat, data.lng]}
                radius={5}
                pathOptions={{
                  fillColor: getStationColor(stopId),
                  fillOpacity: 0.9,
                  color: '#fff',
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <h4 className="map-popup-title">{data.name}</h4>
                    {stationArrivals[stopId] && stationArrivals[stopId].length > 0 ? (
                      <div className="map-popup-arrivals">
                        {stationArrivals[stopId].map((arr, i) => {
                          const bg = lineColors[arr.line] || '#0039A6';
                          const textColor = darkTextLines.has(arr.line) ? '#333' : '#fff';
                          return (
                            <div key={i} className="map-popup-arrival">
                              <span
                                className="map-popup-badge"
                                style={{ backgroundColor: bg, color: textColor }}
                              >
                                {arr.line}
                              </span>
                              <span>{arr.direction}</span>
                              <span className="map-popup-eta">
                                {getTimeUntil(arr.arrival_time)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: '#888', margin: '4px 0' }}>
                        No upcoming arrivals
                      </p>
                    )}
                    <Link
                      className="map-popup-link"
                      to={`/station/${encodeURIComponent(data.name)}`}
                    >
                      View accessibility info →
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <aside className={`map-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3 className="sidebar-title">Filter Lines</h3>
          </div>

          <div className="sidebar-lines">
            {lineGroups.flatMap(g => g.lines).map(line => {
              const bg = lineColors[line] || '#0039A6';
              const textColor = darkTextLines.has(line) ? '#333' : '#fff';
              const isActive = activeLines.has(line);
              return (
                <button
                  key={line}
                  className={`sidebar-line-btn ${isActive ? 'active' : ''}`}
                  style={{ backgroundColor: bg, color: textColor }}
                  onClick={() => toggleLine(line)}
                >
                  {line}
                </button>
              );
            })}
          </div>

          <div className="sidebar-header">
            <h3 className="sidebar-title">Upcoming Trains</h3>
          </div>

          <div className="sidebar-trips">
            {loading && (
              <div className="sidebar-loading">
                <div className="sidebar-loading-spinner" />
                Loading...
              </div>
            )}

            {!loading && sidebarTrips.length === 0 && (
              <p className="sidebar-no-trips">No upcoming trips</p>
            )}

            {!loading && sidebarTrips.map(trip => {
              const line = getTripLine(trip.trip_id);
              const direction = getTripDirection(trip.trip_id);
              const futureStops = (trip.stop_time_updates || [])
                .filter(s => new Date(s.arrival_time) >= new Date())
                .slice(0, 3);

              return (
                <div key={trip.trip_id} className="sidebar-trip-card">
                  <div className="sidebar-trip-header">
                    <span
                      className="map-popup-badge"
                      style={{
                        backgroundColor: lineColors[line] || '#0039A6',
                        color: darkTextLines.has(line) ? '#333' : '#fff',
                      }}
                    >
                      {line}
                    </span>
                    <span className="sidebar-trip-direction">{direction}</span>
                  </div>
                  <div className="sidebar-trip-stops">
                    {futureStops.map((stop, j) => {
                      const coords = getStationCoords(stop.stop_id);
                      const name = coords ? coords.name : stop.stop_id;
                      return (
                        <div key={j} className="sidebar-stop-row">
                          <span className="sidebar-stop-name">{name}</span>
                          <span className={`sidebar-stop-eta ${getEtaClass(stop.arrival_time)}`}>
                            {getTimeUntil(stop.arrival_time)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default SubwayMap;
