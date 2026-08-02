import apiClient from './auth';

export const startSession = async (patientId, exerciseId) => {
  const response = await apiClient.post('/session/start', {
    patient_id: patientId,
    exercise_id: exerciseId
  });
  return response.data;
};

export const endSession = async (sessionData) => {
  const response = await apiClient.post('/session/end', sessionData);
  return response.data;
};

export const getSessionHistory = async () => {
  const response = await apiClient.get('/session/history');
  return response.data;
};

export const getSessionDetails = async (id) => {
  const response = await apiClient.get(`/session/${id}`);
  return response.data;
};
