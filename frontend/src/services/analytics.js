import apiClient from './auth';

export const getDashboardAnalytics = async (patientId = null) => {
  const url = patientId ? `/analytics/dashboard?patient_id=${patientId}` : '/analytics/dashboard';
  const response = await apiClient.get(url);
  return response.data;
};

export const getPatientAnalytics = async (id) => {
  const response = await apiClient.get(`/analytics/patient/${id}`);
  return response.data;
};
