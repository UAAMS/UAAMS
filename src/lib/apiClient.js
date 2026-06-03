const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const AUTH_TOKEN_KEY = import.meta.env.TOKEN;

const getStoredToken = () => {
  try {
    return (
      localStorage.getItem(AUTH_TOKEN_KEY) ||
      sessionStorage.getItem(AUTH_TOKEN_KEY) ||
      ""
    );
  } catch {
    return "";
  }
};

const setStoredToken = (token, { rememberMe = true } = {}) => {
  try {
    if (token) {
      if (rememberMe) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
      } else {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

const parseResponse = async (response) => {
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const request = async (
  path,
  {
    method = "GET",
    body,
    token = getStoredToken(),
    headers = {},
  } = {},
) => {
  const requestHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (fetchError) {
    const error = new Error(
      `Unable to reach API at ${API_BASE_URL}. Make sure backend is running and CORS is configured.`,
    );
    error.cause = fetchError;
    throw error;
  }

  return parseResponse(response);
};

const requestBlob = async (
  path,
  {
    method = "GET",
    body,
    token = getStoredToken(),
    headers = {},
  } = {},
) => {
  const requestHeaders = {
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (fetchError) {
    const error = new Error(
      `Unable to reach API at ${API_BASE_URL}. Make sure backend is running and CORS is configured.`,
    );
    error.cause = fetchError;
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    const message = payload?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return response.blob();
};

const api = {
  get: (path, options) => request(path, { method: "GET", ...options }),
  post: (path, body, options) =>
    request(path, { method: "POST", body, ...options }),
  put: (path, body, options) =>
    request(path, { method: "PUT", body, ...options }),
  patch: (path, body, options) =>
    request(path, { method: "PATCH", body, ...options }),
  del: (path, options) => request(path, { method: "DELETE", ...options }),
  getBlob: (path, options) => requestBlob(path, { method: "GET", ...options }),
};

export {
  API_BASE_URL,
  AUTH_TOKEN_KEY,
  getStoredToken,
  setStoredToken,
  api,
};
