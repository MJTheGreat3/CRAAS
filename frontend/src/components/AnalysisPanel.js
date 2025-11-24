import React, { useState } from 'react';
import { Card, Form, InputNumber, Select, Button, Space, Typography, Alert, Spin } from 'antd';
import { PlayCircleOutlined, ClearOutlined, ExperimentOutlined } from '@ant-design/icons';
import { analyzeContamination } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const AnalysisPanel = ({ contaminationPoint, onAnalysisComplete, onClear }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
        dispersion_rate_kmph: values.dispersion_rate_kmph,
        time_window_hours: values.time_window_hours,
        contaminant_type: values.contaminant_type
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
    <div className="analysis-panel">
      <Card 
        title={
          <Space>
            <ExperimentOutlined />
            <span>Contamination Analysis</span>
          </Space>
        }
        size="small"
        style={{ width: 380 }}
      >
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
            dispersion_rate_kmph: 2.0,
            time_window_hours: 24,
            contaminant_type: 'chemical'
          }}
        >
          <Form.Item
            label="Contaminant Type"
            name="contaminant_type"
            tooltip="Type of contaminant for analysis"
          >
            <Select>
              <Option value="chemical">Chemical</Option>
              <Option value="biological">Biological</Option>
              <Option value="thermal">Thermal</Option>
              <Option value="sediment">Sediment</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Dispersion Rate (km/h)"
            name="dispersion_rate_kmph"
            tooltip="Speed at which contaminant spreads through water"
            rules={[
              { required: true, message: 'Please enter dispersion rate' },
              { type: 'number', min: 0.1, max: 50, message: 'Rate must be between 0.1 and 50 km/h' }
            ]}
          >
            <InputNumber
              min={0.1}
              max={50}
              step={0.1}
              style={{ width: '100%' }}
              formatter={value => `${value} km/h`}
              parser={value => value.replace(' km/h', '')}
            />
          </Form.Item>

          <Form.Item
            label="Time Window (hours)"
            name="time_window_hours"
            tooltip="Analysis time horizon"
            rules={[
              { required: true, message: 'Please enter time window' },
              { type: 'number', min: 1, max: 168, message: 'Time must be between 1 and 168 hours' }
            ]}
          >
            <InputNumber
              min={1}
              max={168}
              step={1}
              style={{ width: '100%' }}
              formatter={value => `${value} hours`}
              parser={value => value.replace(' hours', '')}
            />
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
              <Text strong>High Risk:</Text> <Text style={{ marginLeft: 4 }}>Arrival &lt; 6 hours</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, backgroundColor: '#fa8c16', borderRadius: '50%', marginRight: 8 }}></div>
              <Text strong>Moderate Risk:</Text> <Text style={{ marginLeft: 4 }}>Arrival 6-24 hours</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, backgroundColor: '#fadb14', borderRadius: '50%', marginRight: 8 }}></div>
              <Text strong>Low Risk:</Text> <Text style={{ marginLeft: 4 }}>Arrival &gt; 24 hours</Text>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AnalysisPanel;
