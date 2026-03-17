import axios from "axios";
import { useAuthStore } from "../store/authStore";

let baseURLs = "";
if (import.meta.env.VITE_PC_RUNNING === "army_service_room") {
  baseURLs = "https://friendly-invention-v5vxr4q6j5rh6qj7-5000.app.github.dev/"
}
else {
  baseURLs = "http://localhost:5000"
}

const api = axios.create({
    baseURL: baseURLs,
  });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
