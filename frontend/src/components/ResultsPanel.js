import React, { useState } from 'react';
import { Card, Table, Tag, Button, Space, Typography, Statistic, Row, Col, Alert, Tooltip } from 'antd';
import { DownloadOutlined, InfoCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { exportToExcel } from '../services/export';

const { Title, Text } = Typography;

const ResultsPanel = ({ results, contaminationPoint }) => {
  const [exporting, setExporting] = useState(false);

  const getRiskColor = (riskLevel) => {
    const colors = {
      High: 'red',
      Moderate: 'orange',
      Low: 'gold'
    };
    return colors[riskLevel] || 'default';
  };

  const getEndpointIcon = (type) => {
    const icons = {
      hospital: '🏥',
      school: '🏫',
      farmland: '🌾',
      residential: '🏘️'
    };
    return icons[type] || '📍';
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
      render: (type) => (
        <Space>
          <span>{getEndpointIcon(type)}</span>
          <Text strong>{type.toUpperCase()}</Text>
        </Space>
      ),
      filters: [
        { text: 'Hospital', value: 'hospital' },
        { text: 'School', value: 'school' },
        { text: 'Farmland', value: 'farmland' },
        { text: 'Residential', value: 'residential' },
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
      render: (risk) => (
        <Tag color={getRiskColor(risk)}>
          {risk}
        </Tag>
      ),
      sorter: (a, b) => {
        const order = { High: 3, Moderate: 2, Low: 1 };
        return order[a.risk_level] - order[b.risk_level];
      },
    },
    {
      title: 'Arrival Time',
      dataIndex: 'arrival_hours',
      key: 'arrival_hours',
      width: 120,
      render: (hours) => (
        <Tooltip title={`Exact arrival: ${hours.toFixed(2)} hours`}>
          <Text strong>{hours.toFixed(1)} hrs</Text>
        </Tooltip>
      ),
      sorter: (a, b) => a.arrival_hours - b.arrival_hours,
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
    
    return highRisk.sort((a, b) => a.arrival_hours - b.arrival_hours)[0];
  };

  const mostCritical = getMostCritical();

  return (
    <div className="results-panel">
      <Card
        title={
          <Space>
            <ExclamationCircleOutlined />
            <span>Risk Analysis Results</span>
          </Space>
        }
        size="small"
        extra={
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exporting}
            size="small"
          >
            Export Excel
          </Button>
        }
      >
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
                <strong>{mostCritical.endpoint_id}</strong> will be contaminated in{' '}
                <strong>{mostCritical.arrival_hours.toFixed(1)} hours</strong> - Immediate action required!
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
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} endpoints`,
          }}
          scroll={{ y: 200 }}
        />
      </Card>
    </div>
  );
};

export default ResultsPanel;
