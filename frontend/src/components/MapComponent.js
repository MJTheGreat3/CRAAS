import React, { useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Icon, divIcon, marker as leafletMarker } from 'leaflet';
import { Spin, message } from 'antd';
import { 
  MedicineBoxOutlined, 
  BookOutlined, 
  FieldTimeOutlined, 
  HomeOutlined, 
  BuildOutlined, 
  EnvironmentOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
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
      hospital: '#ff4d4f',
      school: '#1890ff',
      farmland: '#52c41a',
      residential: '#fa8c16',
      industrial: '#666666',
      other: '#999999'
    };

    const icons = {
      hospital: 'H',
      school: 'S',
      farmland: 'F',
      residential: 'R',
      industrial: 'I',
      other: '•'
    };
    
    return divIcon({
      className: `endpoint-marker endpoint-${type}`,
      html: `
        <div style="
          background-color: ${colors[type] || '#999'}; 
          width: 24px; 
          height: 24px; 
          border-radius: 50%; 
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${icons[type] || '📍'}
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  };

  const getContaminationIcon = () => {
    return divIcon({
      className: 'contamination-marker',
      html: '<div style="background-color: #000000; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      zIndex: 10000
    });
  };

  const getRiskIcon = (riskLevel, endpointType) => {
    const colors = {
      High: '#ff4d4f',
      Moderate: '#fadb14',
      Low: '#52c41a'
    };

    const endpointIcons = {
      hospital: 'H',
      school: 'S',
      farmland: 'F',
      residential: 'R',
      industrial: 'I',
      other: '•'
    };
    
    return divIcon({
      className: `risk-marker risk-${riskLevel.toLowerCase()}`,
      html: `
        <div style="
          background-color: ${colors[riskLevel]}; 
          width: 22px; 
          height: 22px; 
          border-radius: 50%; 
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          box-sizing: border-box;
          margin: 3px;
        ">
          ${endpointIcons[endpointType] || '•'}
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
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
      
      {/* Endpoints - HIDDEN by default, only show risk points */}
      {false && endpointsData.length > 0 && (
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
             return leafletMarker(latlng, {
               icon: getEndpointIcon(feature.properties.endpoint_type)
             });
           }}
          onEachFeature={onEachEndpoint}
        />
      )}
      
      {/* Risk Results - Only show endangered endpoints */}
      {analysisResults && analysisResults.results.map((result, index) => {
        const endpoint = endpointsData.find(e => e.endpoint_id === result.endpoint_id);
        if (!endpoint) {
          console.log('Endpoint not found for result:', result.endpoint_id);
          return null;
        }
        
        try {
          const coords = JSON.parse(endpoint.geometry).coordinates;
          const endpointLat = coords[1];
          const endpointLng = coords[0];
          
          // Check if this endpoint is at the same location as any contamination point
          const isAtContaminationPoint = contaminationPoints.some(cp => 
            Math.abs(cp.lat - endpointLat) < 0.0001 && 
            Math.abs((cp.lng || cp.lon) - endpointLng) < 0.0001
          );
          
          // Don't render risk marker if it's at the same location as contamination point
          if (isAtContaminationPoint) {
            return null;
          }
          
          return (
            <Marker
              key={`risk-${index}`}
              position={[endpointLat, endpointLng]}
              icon={getRiskIcon(result.risk_level, result.endpoint_type)}
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
        } catch (error) {
          console.error('Error parsing geometry for endpoint:', result.endpoint_id, error);
          return null;
        }
      })}
      
      {/* Contamination Points - Rendered last to appear on top */}
      {contaminationPoints.map((point, index) => (
        <Marker
          key={`contamination-${index}`}
          position={[point.lat, point.lng || point.lon]}
          icon={getContaminationIcon()}
          zIndex={10000}
        >
          <Popup>
            <strong>Contamination Point</strong><br/>
            Lat: {point.lat.toFixed(4)}<br/>
            Lng: {(point.lng || point.lon).toFixed(4)}
          </Popup>
        </Marker>
      ))}
      
      <MapEvents onContaminationAdd={onContaminationAdd} setCursorCoords={setCursorCoords} />
    </MapContainer>
    </>
  );
};

export default MapComponent;
