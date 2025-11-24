import React, { useState, useEffect } from 'react';
import { Layout, Card, Row, Col, Typography, notification } from 'antd';
import MapComponent from './components/MapComponent';
import AnalysisPanel from './components/AnalysisPanel';
import ResultsPanel from './components/ResultsPanel';
import { getHydrologyNetwork, getEndpoints } from './services/api';
import './styles/index.css';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  const [hydrologyData, setHydrologyData] = useState([]);
  const [endpointsData, setEndpointsData] = useState([]);
  const [contaminationPoints, setContaminationPoints] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [hydrology, endpoints] = await Promise.all([
        getHydrologyNetwork(),
        getEndpoints()
      ]);
      setHydrologyData(hydrology);
      setEndpointsData(endpoints);
    } catch (error) {
      notification.error({
        message: 'Data Loading Error',
        description: 'Failed to load initial data. Please check your connection.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContaminationAdd = (point) => {
    setContaminationPoints([point]); // Only allow one contamination point at a time
  };

  const handleAnalysisComplete = (results) => {
    setAnalysisResults(results);
  };

  const handleClearAnalysis = () => {
    setContaminationPoints([]);
    setAnalysisResults(null);
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', margin: '14px 0' }}>
          🌊 Contamination Risk Analysis & Alert System (CRAS)
        </Title>
      </Header>
      
      <Content style={{ position: 'relative', padding: 0 }}>
        <MapComponent
          hydrologyData={hydrologyData}
          endpointsData={endpointsData}
          contaminationPoints={contaminationPoints}
          analysisResults={analysisResults}
          onContaminationAdd={handleContaminationAdd}
          onBoundsChange={setMapBounds}
          loading={loading}
        />
        
        <AnalysisPanel
          contaminationPoint={contaminationPoints[0]}
          onAnalysisComplete={handleAnalysisComplete}
          onClear={handleClearAnalysis}
        />
        
        {analysisResults && (
          <ResultsPanel
            results={analysisResults}
            contaminationPoint={contaminationPoints[0]}
          />
        )}
      </Content>
    </Layout>
  );
}

export default App;
