import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3001/api',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default client;
