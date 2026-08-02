import apiClient from './auth';

export const getExercises = async () => {
  const response = await apiClient.get('/exercises');
  return response.data;
};

export const getExercise = async (id) => {
  const response = await apiClient.get(`/exercises/${id}`);
  return response.data;
};
