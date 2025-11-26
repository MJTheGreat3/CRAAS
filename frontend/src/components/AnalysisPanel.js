import React, { useState } from 'react';
import { Card, Form, InputNumber, Button, Space, Typography, Alert, Row, Col } from 'antd';
import { PlayCircleOutlined, ClearOutlined, ExperimentOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { analyzeContamination } from '../services/api';

const { Title, Text } = Typography;

const AnalysisPanel = ({ contaminationPoint, onAnalysisComplete, onClear }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [minimized, setMinimized] = useState(false);



  const handleAnalyze = async (values) => {
    if (!contaminationPoint) {
      setError('Please click on the map to add a contamination point first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const analysisData = {
        lat: contaminationPoint.lat,
        lon: contaminationPoint.lng || contaminationPoint.lon,
        dispersion_rate: values.dispersion_rate,
        analysis_radius: values.analysis_radius,
        high_threshold: values.high_threshold,
        moderate_threshold: values.moderate_threshold,
        low_threshold: values.low_threshold
      };

      const result = await analyzeContamination(analysisData);
      onAnalysisComplete(result);
      
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    form.resetFields();
    setError(null);
    onClear();
  };

  return (
    <div className={`analysis-panel ${minimized ? 'minimized' : ''}`}>
      <Card
        title={
          <Space>
            <ExperimentOutlined />
            <span>Contamination Analysis</span>
          </Space>
        }
        size="small"
        style={{ 
          width: 320,
          height: minimized ? 'auto' : '75vh',
          overflow: 'hidden'
        }}
        bodyStyle={{
          height: minimized ? 'auto' : 'calc(75vh - 57px)',
          overflowY: 'auto',
          padding: '10px'
        }}
        extra={
          <Button
            type="text"
            size="small"
            icon={minimized ? <PlusOutlined /> : <MinusOutlined />}
            onClick={() => setMinimized(!minimized)}
            title={minimized ? "Expand panel" : "Minimize panel"}
          />
        }
      >
        {!minimized && (
          <>
            {contaminationPoint ? (
          <Alert
            message="Contamination Point Set"
            description={`Lat: ${contaminationPoint.lat.toFixed(4)}, Lng: ${(contaminationPoint.lng || contaminationPoint.lon).toFixed(4)}`}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : (
          <Alert
            message="No Contamination Point"
            description="Click on the map to add a contamination point"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleAnalyze}
          initialValues={{
            dispersion_rate: 0.15,
            analysis_radius: 10.0,
            high_threshold: 10.0,
            moderate_threshold: 5.0,
            low_threshold: 1.0
          }}
          size="small"
        >

          <Row gutter={8}>
            <Col span={12}>
              <Form.Item
                label="Analysis Radius"
                name="analysis_radius"
                tooltip="Maximum distance to search for at-risk endpoints (in kilometers)"
                rules={[
                  { required: true, message: 'Please enter analysis radius' },
                  { type: 'number', min: 1, max: 50, message: 'Radius must be between 1km and 50km' }
                ]}
              >
                <InputNumber
                  min={1}
                  max={50}
                  step={1}
                  size="small"
                  style={{ width: '100%' }}
                  formatter={value => `${value} km`}
                  parser={value => parseFloat(value.replace(' km', ''))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Dispersion Rate"
                name="dispersion_rate"
                tooltip="Compound decay rate per kilometer (e.g., 0.15 = 15% compound reduction per km)"
                rules={[
                  { required: true, message: 'Please enter dispersion rate' },
                  { type: 'number', min: 0.01, max: 0.5, message: 'Rate must be between 1% and 50%' }
                ]}
              >
                <InputNumber
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  size="small"
                  style={{ width: '100%' }}
                  formatter={value => `${(value * 100).toFixed(1)}%`}
                  parser={value => (parseFloat(value.replace('%', '')) / 100)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item 
            label="Risk Thresholds (%)"
            style={{ marginBottom: '8px' }}
          >
            <Row gutter={4}>
              <Col span={8}>
                <Form.Item
                  name="high_threshold"
                  label="High"
                  rules={[{ required: true, message: 'Required' }]}
                  style={{ marginBottom: '4px' }}
                >
                  <InputNumber
                    min={0.1}
                    max={100}
                    step={0.1}
                    size="small"
                    style={{ width: '100%' }}
                    formatter={value => `≥ ${value}%`}
                    parser={value => parseFloat(value.replace('≥ ', '').replace('%', ''))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="moderate_threshold"
                  label="Med"
                  rules={[{ required: true, message: 'Required' }]}
                  style={{ marginBottom: '4px' }}
                >
                  <InputNumber
                    min={0.1}
                    max={100}
                    step={0.1}
                    size="small"
                    style={{ width: '100%' }}
                    formatter={value => `≥ ${value}%`}
                    parser={value => parseFloat(value.replace('≥ ', '').replace('%', ''))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="low_threshold"
                  label="Low"
                  rules={[{ required: true, message: 'Required' }]}
                  style={{ marginBottom: '4px' }}
                >
                  <InputNumber
                    min={0.1}
                    max={100}
                    step={0.1}
                    size="small"
                    style={{ width: '100%' }}
                    formatter={value => `≥ ${value}%`}
                    parser={value => parseFloat(value.replace('≥ ', '').replace('%', ''))}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Safe: Below Low Risk threshold
            </Text>
          </Form.Item>

          {error && (
            <Alert
              message="Analysis Error"
              description={error}
              type="error"
              showIcon
            style={{ marginBottom: 12 }}
            />
          )}

          <Form.Item style={{ marginBottom: '6px' }}>
            <Space.Compact style={{ width: '100%' }}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<PlayCircleOutlined />}
                loading={loading}
                disabled={!contaminationPoint}
                style={{ width: '60%' }}
                title={
                  !contaminationPoint 
                    ? "Click on the map to add a contamination point" 
                    : "Run contamination analysis"
                }
              >
                {loading ? 'Analyzing...' : 'Run'}
              </Button>
              
              <Button
                icon={<ClearOutlined />}
                onClick={handleClear}
                style={{ width: '40%' }}
              >
                Reset
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>


          </>
        )}
      </Card>
    </div>
  );
};

export default AnalysisPanel;
