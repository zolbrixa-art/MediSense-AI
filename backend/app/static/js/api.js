const API_BASE = "";

async function request(method, path, body = null, requiresAuth = true) {
  const headers = { "Content-Type": "application/json" };
  if (requiresAuth) {
    const token = localStorage.getItem("access_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.replace("/login.html");
    }
  }

  return { status: response.status, data };
}

export const api = {
  get: (path, auth = true) => request("GET", path, null, auth),
  post: (path, body, auth = true) => request("POST", path, body, auth),
  put: (path, body, auth = true) => request("PUT", path, body, auth),
  delete: (path, auth = true) => request("DELETE", path, null, auth),
};
