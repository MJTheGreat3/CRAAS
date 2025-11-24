import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Icon, divIcon } from 'leaflet';
import { Card, Spin, message } from 'antd';
import 'leaflet/dist/leaflet.css';
import './MapComponent.css';

// Fix for default markers in Leaflet
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapEvents = ({ onContaminationAdd, setCursorCoords }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onContaminationAdd({ lat, lng: lng });
      message.success('Contamination point added. Configure analysis in the panel.');
    },
    mousemove: (e) => {
      const { lat, lng } = e.latlng;
      setCursorCoords({ 
        lat: lat.toFixed(6), 
        lng: lng.toFixed(6) 
      });
    },
    mouseout: () => {
      setCursorCoords({ lat: null, lng: null });
    }
  });
  return null;
};

const MapComponent = ({
  hydrologyData,
  endpointsData,
  contaminationPoints,
  analysisResults,
  onContaminationAdd,
  onBoundsChange,
  loading
}) => {
  const [mapCenter] = useState([12.9716, 77.5946]); // Default to Bangalore
  const [mapZoom] = useState(10);
  const [cursorCoords, setCursorCoords] = useState({ lat: null, lng: null });

  const getEndpointIcon = (type) => {
    const colors = {
      hospital: '#1890ff',
      school: '#52c41a',
      farmland: '#faad14',
      residential: '#722ed1'
    };
    
    return divIcon({
      className: `endpoint-marker endpoint-${type}`,
      html: `<div style="background-color: ${colors[type] || '#666'}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  };

  const getContaminationIcon = () => {
    return divIcon({
      className: 'contamination-marker',
      html: '<div style="background-color: #ff4d4f; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  };

  const getRiskIcon = (riskLevel) => {
    const colors = {
      High: '#ff4d4f',
      Moderate: '#fa8c16',
      Low: '#fadb14'
    };
    
    return divIcon({
      className: `risk-marker risk-${riskLevel.toLowerCase()}`,
      html: `<div style="background-color: ${colors[riskLevel]}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  };

  const hydrologyStyle = {
    color: '#1890ff',
    weight: 2,
    opacity: 0.8
  };

  const onEachEndpoint = (endpoint, layer) => {
    layer.bindPopup(`
      <strong>${endpoint.properties.endpoint_type.toUpperCase()}</strong><br/>
      ID: ${endpoint.properties.endpoint_id}<br/>
      Type: ${endpoint.properties.endpoint_type}
    `);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Loading map data..." />
      </div>
    );
  }

  return (
    <>
      {/* Coordinate Display */}
      <div className="coordinate-display">
        {cursorCoords.lat && cursorCoords.lng ? (
          `Lat: ${cursorCoords.lat}, Lng: ${cursorCoords.lng}`
        ) : (
          'Move cursor over map'
        )}
      </div>
      
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        whenReady={(map) => {
          if (onBoundsChange) {
            map.target.on('moveend', () => {
              const bounds = map.target.getBounds();
              onBoundsChange(bounds);
            });
          }
        }}
      >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Hydrology Network */}
      {hydrologyData.length > 0 && (
        <GeoJSON
          data={{
            type: 'FeatureCollection',
            features: hydrologyData.map(line => ({
              type: 'Feature',
              properties: {
                id: line.id,
                source: line.source,
                target: line.target,
                length_m: line.length_m
              },
              geometry: JSON.parse(line.geometry)
            }))
          }}
          style={hydrologyStyle}
        />
      )}
      
      {/* Endpoints */}
      {endpointsData.length > 0 && (
        <GeoJSON
          data={{
            type: 'FeatureCollection',
            features: endpointsData.map(endpoint => ({
              type: 'Feature',
              properties: {
                endpoint_id: endpoint.endpoint_id,
                endpoint_type: endpoint.endpoint_type,
                intake_id: endpoint.intake_id
              },
              geometry: JSON.parse(endpoint.geometry)
            }))
          }}
          pointToLayer={(feature, latlng) => {
            return new Marker(latlng, {
              icon: getEndpointIcon(feature.properties.endpoint_type)
            });
          }}
          onEachFeature={onEachEndpoint}
        />
      )}
      
      {/* Contamination Points */}
      {contaminationPoints.map((point, index) => (
        <Marker
          key={`contamination-${index}`}
          position={[point.lat, point.lng || point.lon]}
          icon={getContaminationIcon()}
        >
          <Popup>
            <strong>Contamination Point</strong><br/>
            Lat: {point.lat.toFixed(4)}<br/>
            Lng: {(point.lng || point.lon).toFixed(4)}
          </Popup>
        </Marker>
      ))}
      
      {/* Risk Results */}
      {analysisResults && analysisResults.results.map((result, index) => {
        const endpoint = endpointsData.find(e => e.endpoint_id === result.endpoint_id);
        if (!endpoint) return null;
        
        const coords = JSON.parse(endpoint.geometry).coordinates;
        return (
          <Marker
            key={`risk-${index}`}
            position={[coords[1], coords[0]]}
            icon={getRiskIcon(result.risk_level)}
          >
            <Popup>
              <strong>{result.endpoint_type.toUpperCase()} AT RISK</strong><br/>
              ID: {result.endpoint_id}<br/>
              Risk Level: {result.risk_level}<br/>
              Arrival Time: {result.arrival_hours.toFixed(1)} hours<br/>
              Distance: {result.distance_km.toFixed(2)} km
            </Popup>
          </Marker>
        );
      })}
      
      <MapEvents onContaminationAdd={onContaminationAdd} setCursorCoords={setCursorCoords} />
    </MapContainer>
    </>
  );
};

export default MapComponent;
