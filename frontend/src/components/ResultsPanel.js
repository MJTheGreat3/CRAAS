import React, { useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, Statistic, Row, Col, Alert } from 'antd';
import { 
  DownloadOutlined, 
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CloseOutlined, 
  ExpandOutlined, 
  CompressOutlined, 
  PlusOutlined, 
  MinusOutlined,
  MedicineBoxOutlined,
  BookOutlined,
  FieldTimeOutlined,
  HomeOutlined,
  BuildOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { exportToExcel } from '../services/export';

const { Text } = Typography;

const ResultsPanel = ({ results, contaminationPoint, onClose }) => {
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [minimized, setMinimized] = useState(false);



  const getEndpointIcon = (type) => {
    const iconConfig = {
      hospital: { icon: <MedicineBoxOutlined />, color: '#ff4d4f' },
      school: { icon: <BookOutlined />, color: '#1890ff' },
      farmland: { icon: <FieldTimeOutlined />, color: '#52c41a' },
      residential: { icon: <HomeOutlined />, color: '#fa8c16' },
      industrial: { icon: <BuildOutlined />, color: '#666666' },
      other: { icon: <EnvironmentOutlined />, color: '#999999' }
    };
    return iconConfig[type] || iconConfig.other;
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportToExcel(results, contaminationPoint);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      title: 'Type',
      dataIndex: 'endpoint_type',
      key: 'endpoint_type',
      width: 100,
      render: (type) => {
        const iconConfig = getEndpointIcon(type);
        return (
          <Space>
            <span style={{ color: iconConfig.color }}>{iconConfig.icon}</span>
            <Text strong>{type.toUpperCase()}</Text>
          </Space>
        );
      },
      filters: [
        { text: 'Hospital', value: 'hospital' },
        { text: 'School', value: 'school' },
        { text: 'Residential', value: 'residential' },
        { text: 'Industrial', value: 'industrial' },
        { text: 'Farmland', value: 'farmland' },
        { text: 'Other', value: 'other' },
      ],
      onFilter: (value, record) => record.endpoint_type === value,
    },
    {
      title: 'Endpoint ID',
      dataIndex: 'endpoint_id',
      key: 'endpoint_id',
      width: 120,
      render: (id) => <Text code>{id}</Text>,
    },
    {
      title: 'Risk Level',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (risk) => {
        const riskColors = {
          High: 'red',
          Moderate: 'gold',
          Low: 'green'
        };
        return (
          <Tag color={riskColors[risk]}>
            {risk}
          </Tag>
        );
      },
      sorter: (a, b) => {
        const order = { High: 3, Moderate: 2, Low: 1 };
        return order[a.risk_level] - order[b.risk_level];
      },
    },
    {
      title: 'Concentration',
      dataIndex: 'concentration',
      key: 'concentration',
      width: 100,
      render: (conc) => (
        <span>
          {conc ? conc.toFixed(1) + '%' : 'N/A'}
        </span>
      ),
      sorter: (a, b) => (a.concentration || 0) - (b.concentration || 0),
    },
    {
      title: 'Distance',
      dataIndex: 'distance_km',
      key: 'distance_km',
      width: 100,
      render: (km) => <Text>{km.toFixed(2)} km</Text>,
      sorter: (a, b) => a.distance_km - b.distance_km,
    },
  ];

  const riskStats = {
    High: results.results.filter(r => r.risk_level === 'High').length,
    Moderate: results.results.filter(r => r.risk_level === 'Moderate').length,
    Low: results.results.filter(r => r.risk_level === 'Low').length,
  };

  const getMostCritical = () => {
    const highRisk = results.results.filter(r => r.risk_level === 'High');
    if (highRisk.length === 0) return null;
    
    return highRisk.sort((a, b) => (b.concentration || 0) - (a.concentration || 0))[0];
  };

  const mostCritical = getMostCritical();

  return (
    <div className={`results-panel ${fullscreen ? 'fullscreen' : ''} ${minimized ? 'minimized' : ''}`}>
      <Card
        title={
          <Space>
            <ExclamationCircleOutlined />
            <span>Risk Analysis Results</span>
          </Space>
        }
        size="small"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={exporting}
              size="small"
            >
              Export Excel
            </Button>
            <Button
              type="default"
              icon={fullscreen ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={() => setFullscreen(!fullscreen)}
              size="small"
              title={fullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
            >
              {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </Button>
            <Button
              type="default"
              icon={minimized ? <PlusOutlined /> : <MinusOutlined />}
              onClick={() => setMinimized(!minimized)}
              size="small"
              title={minimized ? "Expand panel" : "Minimize panel"}
            >
              {minimized ? "Expand" : "Minimize"}
            </Button>
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={onClose}
              size="small"
              title="Close results and clear analysis"
            >
              Close
            </Button>
          </Space>
        }
      >
        {!minimized && (
          <>
            {/* Summary Statistics */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic
                  title="Total at Risk"
                  value={results.total_at_risk}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="High Risk"
                  value={riskStats.High}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Moderate Risk"
                  value={riskStats.Moderate}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Low Risk"
                  value={riskStats.Low}
                  valueStyle={{ color: '#fadb14' }}
                />
              </Col>
            </Row>

            {/* Critical Alert */}
            {mostCritical && (
              <Alert
                message="Critical Alert"
                description={
                  <span>
                    <strong>{mostCritical.endpoint_type.toUpperCase()}</strong> at location{' '}
                    <strong>{mostCritical.endpoint_id}</strong> has{' '}
                    <strong>{(mostCritical.concentration || 0).toFixed(1)}% concentration</strong> - Immediate action required!
                  </span>
                }
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Analysis Info */}
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f0f2f5', borderRadius: 4 }}>
              <Space split={<span>|</span>}>
                <Text type="secondary">
                  <InfoCircleOutlined /> Analysis Time: {results.analysis_time_seconds.toFixed(2)}s
                </Text>
                <Text type="secondary">
                  Contamination ID: #{results.contamination_id}
                </Text>
                <Text type="secondary">
                  Source: ({contaminationPoint.lat.toFixed(4)}, {(contaminationPoint.lng || contaminationPoint.lon).toFixed(4)})
                </Text>
              </Space>
            </div>

            {/* Results Table */}
            <Table
              columns={columns}
              dataSource={results.results}
              rowKey="endpoint_id"
              size="small"
              pagination={{
                pageSize: fullscreen ? 20 : 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} endpoints`,
              }}
              scroll={{ y: fullscreen ? 400 : 200 }}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default ResultsPanel;
