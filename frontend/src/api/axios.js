import axios from "axios";

let baseURLs = "";
baseURLs = "https://api.mycineshelf.com";

// if (import.meta.env.VITE_DEPLOYMENT_TYPE === "local") {
//   baseURLs = "http://localhost:5000/";
// }

const api = axios.create({
    baseURL: baseURLs,
  });


function getStoredToken() {
  const directToken = localStorage.getItem("token");

  if (directToken && directToken !== "undefined" && directToken !== "null") {
    return directToken;
  }

  // Fallback for older persisted state shape.
  const persistedAuth = localStorage.getItem("auth-storage");
  if (!persistedAuth) return null;

  try {
    const parsed = JSON.parse(persistedAuth);
    const storeToken = parsed?.state?.token;

    if (storeToken && storeToken !== "undefined" && storeToken !== "null") {
      return storeToken;
    }
  } catch {
    return null;
  }

  return null;
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";
    const isAuthEndpoint = requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register") || requestUrl.includes("/auth/forgot-password") || requestUrl.includes("/auth/reset-password");

    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem("token");
      localStorage.removeItem("auth-storage");

      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);


export default api;
