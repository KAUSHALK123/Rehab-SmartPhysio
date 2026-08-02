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
