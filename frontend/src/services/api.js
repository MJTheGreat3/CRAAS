import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cras_api_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('cras_api_token');
      window.location.href = '/login';
    }
    
    const errorMessage = error.response?.data?.detail || error.message || 'An error occurred';
    return Promise.reject(new Error(errorMessage));
  }
);

// Hydrology Network API
export const getHydrologyNetwork = async (bounds = null) => {
  try {
    const params = bounds ? { bounds } : {};
    const response = await api.get('/hydrology/network', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching hydrology network:', error);
    throw error;
  }
};

// Endpoints API
export const getEndpoints = async (endpointType = null, bounds = null) => {
  try {
    const params = {};
    if (endpointType) params.endpoint_type = endpointType;
    if (bounds) params.bounds = bounds;
    
    console.log('Making API call to /endpoints/', params);
    const response = await api.get('/endpoints/', { params });
    console.log('API response status:', response.status);
    console.log('API response data type:', typeof response.data);
    console.log('API response is array:', Array.isArray(response.data));
    console.log('API response length:', response.data.length);
    return response.data;
  } catch (error) {
    console.error('Error fetching endpoints:', error);
    throw error;
  }
};

export const getEndpointTypes = async () => {
  try {
    const response = await api.get('/endpoints/types');
    return response.data;
  } catch (error) {
    console.error('Error fetching endpoint types:', error);
    throw error;
  }
};

// Contamination Analysis API
export const analyzeContamination = async (analysisData) => {
  try {
    const response = await api.post('/contamination/analyze', analysisData);
    return response.data;
  } catch (error) {
    console.error('Error during contamination analysis:', error);
    throw error;
  }
};

export const getContaminationHistory = async (limit = 50) => {
  try {
    const response = await api.get('/contamination/history', { 
      params: { limit } 
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching contamination history:', error);
    throw error;
  }
};

export const getContaminationDetail = async (contaminationId) => {
  try {
    const response = await api.get(`/contamination/history/${contaminationId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contamination detail:', error);
    throw error;
  }
};

// Hydrology Utilities
export const snapToNetwork = async (lat, lon) => {
  try {
    const response = await api.post('/hydrology/snap-to-network', { lat, lon });
    return response.data;
  } catch (error) {
    console.error('Error snapping to network:', error);
    throw error;
  }
};

// Health Check
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

export default api;
