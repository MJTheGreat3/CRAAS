import React, { useState } from 'react';
import { Card, Form, InputNumber, Button, Space, Typography, Alert, Select, Row, Col } from 'antd';
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
        contaminant_type: values.contaminant_type,
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
        style={{ width: 380 }}
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
            contaminant_type: 'chemical',
            analysis_radius: 10.0,
            high_threshold: 10.0,
            moderate_threshold: 5.0,
            low_threshold: 1.0
          }}
        >

          <Form.Item
            label="Contaminant Type"
            name="contaminant_type"
            rules={[{ required: true, message: 'Please select contaminant type' }]}
          >
            <Select placeholder="Select contaminant type">
              <Select.Option value="chemical">Chemical</Select.Option>
              <Select.Option value="biological">Biological</Select.Option>
              <Select.Option value="radiological">Radiological</Select.Option>
              <Select.Option value="thermal">Thermal</Select.Option>
            </Select>
          </Form.Item>

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
              style={{ width: '100%' }}
              formatter={value => `${value} km`}
              parser={value => parseFloat(value.replace(' km', ''))}
            />
          </Form.Item>

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
              style={{ width: '100%' }}
              formatter={value => `${(value * 100).toFixed(1)}% per km`}
              parser={value => (parseFloat(value.replace('% per km', '')) / 100)}
            />
          </Form.Item>

          <Form.Item label="Risk Thresholds (%)">
            <Row gutter={8}>
              <Col span={8}>
                <Form.Item
                  name="high_threshold"
                  label="High Risk ≥"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber
                    min={0.1}
                    max={100}
                    step={0.1}
                    style={{ width: '100%' }}
                    formatter={value => `${value}%`}
                    parser={value => parseFloat(value.replace('%', ''))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="moderate_threshold"
                  label="Moderate ≥"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber
                    min={0.1}
                    max={100}
                    step={0.1}
                    style={{ width: '100%' }}
                    formatter={value => `${value}%`}
                    parser={value => parseFloat(value.replace('%', ''))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="low_threshold"
                  label="Low ≥"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber
                    min={0.1}
                    max={100}
                    step={0.1}
                    style={{ width: '100%' }}
                    formatter={value => `${value}%`}
                    parser={value => parseFloat(value.replace('%', ''))}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Safe: Below Low Risk threshold<br/>
              <strong>Compound Decay:</strong> 15% × 15% × 15%... per km
            </Text>
          </Form.Item>

          {error && (
            <Alert
              message="Analysis Error"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item>
            <Space style={{ width: '100%' }} direction="vertical">
              <Button
                type="primary"
                htmlType="submit"
                icon={<PlayCircleOutlined />}
                loading={loading}
                disabled={!contaminationPoint}
                style={{ width: '100%' }}
                title={
                  !contaminationPoint 
                    ? "Click on the map to add a contamination point" 
                    : "Run contamination analysis"
                }
              >
                {loading ? 'Analyzing...' : 'Run Analysis'}
              </Button>
              
              <Button
                icon={<ClearOutlined />}
                onClick={handleClear}
                style={{ width: '100%' }}
              >
                Clear & Reset
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16, padding: '12px', background: '#f5f5f5', borderRadius: 4 }}>
          <Title level={5}>Risk Level Colors:</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, backgroundColor: '#ff4d4f', borderRadius: '50%', marginRight: 8 }}></div>
              <Text strong>High Risk:</Text> <Text style={{ marginLeft: 4 }}>≥ 10% concentration</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, backgroundColor: '#fadb14', borderRadius: '50%', marginRight: 8 }}></div>
              <Text strong>Moderate Risk:</Text> <Text style={{ marginLeft: 4 }}>5-10% concentration</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, backgroundColor: '#52c41a', borderRadius: '50%', marginRight: 8 }}></div>
              <Text strong>Low Risk:</Text> <Text style={{ marginLeft: 4 }}>1-5% concentration</Text>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
            <Text strong>Risk Thresholds (Chemical):</Text><br/>
            High Risk: ≥10% concentration<br/>
            Moderate Risk: 5-10% concentration<br/>
            Low Risk: 1-5% concentration<br/>
            Safe: &lt;1% concentration<br/><br/>
            <Text strong style={{ color: '#1890ff' }}>🌊 Downstream Flow Analysis</Text><br/>
            Uses elevation data to calculate only downstream contamination flow
          </div>
        </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default AnalysisPanel;
