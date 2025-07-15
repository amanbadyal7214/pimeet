// src/api/classesApi.ts
import axiosInstance from '../../axiosInstance';

export const createClass = async (classData: any) => {
  const response = await axiosInstance.post('/Classes/CreateAClass', classData);
  return response.data;
};
