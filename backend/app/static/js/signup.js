import { api } from "./api.js?v=2";
import { validateSignup } from "./auth.js?v=2";

const eyeOpen = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeClosed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

const roleSelect = document.getElementById("role");
const doctorDepartmentField = document.getElementById("doctorDepartmentField");
const doctorDepartmentInput = document.getElementById("doctorDepartment");

function toggleDoctorDepartment() {
  const show = roleSelect && roleSelect.value === "Doctor";
  if (doctorDepartmentField) doctorDepartmentField.style.display = show ? "block" : "none";
  if (show && doctorDepartmentInput) doctorDepartmentInput.focus();
}

roleSelect?.addEventListener("change", toggleDoctorDepartment);
toggleDoctorDepartment();

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.getAttribute("data-target");
    const input = document.getElementById(targetId);
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    button.innerHTML = isPassword ? eyeClosed : eyeOpen;
  });
});

const form = document.getElementById("signupForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  ["fullName", "email", "password", "confirmPassword", "role"].forEach((field) => {
    document.getElementById(`${field}Error`).textContent = "";
  });
  const formError = document.getElementById("formError");
  formError.style.color = "";
  formError.textContent = "";

  const payload = {
    full_name: document.getElementById("fullName").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value,
    confirmPassword: document.getElementById("confirmPassword").value,
    role: document.getElementById("role").value,
    department: document.getElementById("doctorDepartment")?.value.trim() || "",
  };

  const errors = validateSignup(payload);
  if (Object.keys(errors).length > 0) {
    Object.entries(errors).forEach(([field, message]) => {
      const el = document.getElementById(`${field}Error`);
      if (el) el.textContent = message;
    });
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Creating account…";

  const { status, data } = await api.post("/api/auth/signup", {
    full_name: payload.full_name,
    email: payload.email,
    password: payload.password,
    role: payload.role,
    department: payload.role === "Doctor" ? (payload.department || "General") : undefined,
  }, false);

  if (data.ok) {
    formError.style.color = "#34d399";
    const accountId = data.data?.user?.portal_id || "Unavailable";
    formError.textContent = `Signup successful! Your MediSense ID is ${accountId}.`;
    form.querySelectorAll("input, select, button").forEach(el => el.disabled = true);
    setTimeout(() => { window.location.href = "/login.html"; }, 4000);
  } else {
    btn.disabled = false;
    btn.textContent = "Create Account";
    const msg = data.error?.message || `Sign up failed (status ${status}).`;
    formError.textContent =
      status === 409 ? "An account with this email already exists. Please sign in." : msg;
  }
});
