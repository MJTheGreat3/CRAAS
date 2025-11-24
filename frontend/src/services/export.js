import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const exportToExcel = async (results, contaminationPoint) => {
  try {
    // Prepare data for export
    const exportData = results.results.map(result => ({
      'Endpoint ID': result.endpoint_id,
      'Endpoint Type': result.endpoint_type,
      'Risk Level': result.risk_level,
      'Arrival Time (hours)': result.arrival_hours.toFixed(2),
      'Distance (km)': result.distance_km.toFixed(2),
      'Arrival Time (HH:MM)': formatHoursToTime(result.arrival_hours),
      'Priority': getPriority(result.risk_level),
      'Recommended Action': getRecommendedAction(result.risk_level, result.arrival_hours)
    }));

    // Create summary data
    const summaryData = [
      { 'Analysis Summary': 'Contamination Risk Analysis Report' },
      { 'Contamination ID': `#${results.contamination_id}` },
      { 'Analysis Date': new Date().toLocaleString() },
      { 'Source Latitude': contaminationPoint.lat.toFixed(6) },
      { 'Source Longitude': (contaminationPoint.lng || contaminationPoint.lon).toFixed(6) },
      { 'Total Endpoints at Risk': results.total_at_risk },
      { 'Analysis Time (seconds)': results.analysis_time_seconds.toFixed(2) },
      {},
      { 'Risk Breakdown': '' },
      { 'High Risk': results.results.filter(r => r.risk_level === 'High').length },
      { 'Moderate Risk': results.results.filter(r => r.risk_level === 'Moderate').length },
      { 'Low Risk': results.results.filter(r => r.risk_level === 'Low').length }
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add summary sheet
    const wsSummary = XLSX.utils.json_to_sheet(summaryData, { skipHeader: true });
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Add detailed results sheet
    const wsResults = XLSX.utils.json_to_sheet(exportData);
    
    // Set column widths
    const colWidths = [
      { wch: 15 }, // Endpoint ID
      { wch: 15 }, // Endpoint Type
      { wch: 12 }, // Risk Level
      { wch: 18 }, // Arrival Time (hours)
      { wch: 12 }, // Distance (km)
      { wch: 15 }, // Arrival Time (HH:MM)
      { wch: 10 }, // Priority
      { wch: 25 }  // Recommended Action
    ];
    wsResults['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, wsResults, 'Detailed Results');

    // Add emergency contacts sheet if high risk exists
    const highRiskEndpoints = results.results.filter(r => r.risk_level === 'High');
    if (highRiskEndpoints.length > 0) {
      const emergencyData = highRiskEndpoints.map(result => ({
        'Endpoint ID': result.endpoint_id,
        'Endpoint Type': result.endpoint_type,
        'Arrival Time': `${result.arrival_hours.toFixed(1)} hours`,
        'Contact': getEmergencyContact(result.endpoint_type),
        'Urgency': 'IMMEDIATE ACTION REQUIRED'
      }));

      const wsEmergency = XLSX.utils.json_to_sheet(emergencyData);
      wsEmergency['!cols'] = [
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 25 }
      ];
      XLSX.utils.book_append_sheet(wb, wsEmergency, 'Emergency Contacts');
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `CRAS_Analysis_Report_${timestamp}.xlsx`;

    // Write and save file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);

  } catch (error) {
    console.error('Export failed:', error);
    throw new Error('Failed to export results to Excel');
  }
};

// Helper functions
const formatHoursToTime = (hours) => {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${wholeHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const getPriority = (riskLevel) => {
  const priorities = {
    'High': 'P1 - Critical',
    'Moderate': 'P2 - High',
    'Low': 'P3 - Medium'
  };
  return priorities[riskLevel] || 'P4 - Low';
};

const getRecommendedAction = (riskLevel, arrivalHours) => {
  if (riskLevel === 'High') {
    return 'Immediate evacuation and containment required';
  } else if (riskLevel === 'Moderate') {
    return 'Prepare emergency response within 6 hours';
  } else {
    return 'Monitor situation, prepare contingency plans';
  }
};

const getEmergencyContact = (endpointType) => {
  const contacts = {
    'hospital': 'Hospital Emergency Coordinator',
    'school': 'School District Emergency Office',
    'farmland': 'Agricultural Department',
    'residential': 'Local Emergency Management'
  };
  return contacts[endpointType] || 'Local Emergency Services';
};

// Export to PDF (placeholder for future implementation)
export const exportToPDF = async (results, contaminationPoint) => {
  // This would require a PDF library like jsPDF or react-to-pdf
  // Implementation would be similar to exportToExcel but for PDF format
  throw new Error('PDF export not implemented yet');
};

// Export to CSV (simplified version)
export const exportToCSV = async (results, contaminationPoint) => {
  try {
    const csvData = results.results.map(result => ({
      endpoint_id: result.endpoint_id,
      endpoint_type: result.endpoint_type,
      risk_level: result.risk_level,
      arrival_hours: result.arrival_hours.toFixed(2),
      distance_km: result.distance_km.toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `CRAS_Analysis_${timestamp}.csv`;
    
    saveAs(blob, filename);
  } catch (error) {
    console.error('CSV export failed:', error);
    throw new Error('Failed to export results to CSV');
  }
};
