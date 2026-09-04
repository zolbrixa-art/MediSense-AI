import { api } from "./api.js?v=2";
import { validateLogin, setSession, getRoleDashboard } from "./auth.js?v=4";

const eyeOpen = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeClosed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById("password");
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    button.innerHTML = isPassword ? eyeClosed : eyeOpen;
  });
});

const form = document.getElementById("loginForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  document.getElementById("emailError").textContent = "";
  document.getElementById("passwordError").textContent = "";
  document.getElementById("formError").textContent = "";

  const payload = {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
  };

  const errors = validateLogin(payload);
  if (Object.keys(errors).length > 0) {
    document.getElementById("emailError").textContent = errors.email || "";
    document.getElementById("passwordError").textContent = errors.password || "";
    return;
  }

  const { status, data } = await api.post("/api/auth/login", payload, false);

  if (data.ok) {
    setSession(data.data.access_token, data.data.user);
    window.location.assign(`/index.html${getRoleDashboard(data.data.user.role)}`);
  } else {
    document.getElementById("formError").textContent =
      data.error?.message || `Login failed (status ${status}).`;
  }
});
