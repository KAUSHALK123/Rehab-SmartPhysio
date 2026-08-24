import apiClient from './auth';

export const getPatients = async () => {
  const response = await apiClient.get('/patients');
  return response.data;
};

export const getPatient = async (id) => {
  const response = await apiClient.get(`/patients/${id}`);
  return response.data;
};

export const createPatient = async (patientData) => {
  const response = await apiClient.post('/patients', patientData);
  return response.data;
};

export const updatePatient = async (id, patientData) => {
  const response = await apiClient.put(`/patients/${id}`, patientData);
  return response.data;
};

export const deletePatient = async (id) => {
  const response = await apiClient.delete(`/patients/${id}`);
  return response.data;
};

export const getRecommendedExercises = async (id) => {
  const response = await apiClient.get(`/patients/${id}/recommendations`);
  return response.data;
};

export const getBodyParts = async () => {
  const response = await apiClient.get('/body-parts');
  return response.data;
};

export const getConditions = async () => {
  const response = await apiClient.get('/conditions');
  return response.data;
};

export const getRehabilitationGoals = async () => {
  const response = await apiClient.get('/rehabilitation-goals');
  return response.data;
};

