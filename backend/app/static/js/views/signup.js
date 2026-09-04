import { api } from "../api.js?v=2";
import { validateSignup } from "../auth.js?v=4";

const eyeOpen = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeClosed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

export function renderSignup(container) {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background-color:var(--bg-page);padding:1rem;">
      <div class="container">
        <section class="form-section">
          <div class="brand">
            <img class="brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
            <span class="brand-text">MediSense AI</span>
          </div>

          <div class="heading">
            <h1>Sign Up</h1>
            <p>Create your account to get started.</p>
          </div>

          <form id="signupForm" autocomplete="off" novalidate>
            <div class="form-row">
              <div class="form-group">
                <label for="fullName">Full Name</label>
                <div class="input-wrapper">
                  <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input type="text" id="fullName" name="fullName" placeholder="Enter your full name">
                </div>
                <span class="field-error" id="fullNameError"></span>
              </div>

              <div class="form-group">
                <label for="email">Email</label>
                <div class="input-wrapper">
                  <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <input type="email" id="email" name="email" placeholder="Enter your email">
                </div>
                <span class="field-error" id="emailError"></span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="password">Password</label>
                <div class="input-wrapper">
                  <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input type="password" id="password" name="password" class="with-toggle" placeholder="Create a password">
                  <button type="button" class="toggle-password" aria-label="Toggle password visibility" data-target="password">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
                <span class="field-error" id="passwordError"></span>
              </div>

              <div class="form-group">
                <label for="confirmPassword">Confirm Password</label>
                <div class="input-wrapper">
                  <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input type="password" id="confirmPassword" name="confirmPassword" class="with-toggle" placeholder="Confirm your password">
                  <button type="button" class="toggle-password" aria-label="Toggle confirm password visibility" data-target="confirmPassword">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
                <span class="field-error" id="confirmPasswordError"></span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group full-width">
                <label for="role">Role</label>
                <div class="input-wrapper">
                  <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <select id="role" name="role">
                    <option value="Patient" selected>Patient</option>
                    <option value="Doctor">Doctor</option>
                    <option value="Admin">Admin</option>
                    <option value="LabTech">Lab Tech</option>
                  </select>
                </div>
                <div id="doctorDepartmentField" class="doctor-specialty-field" style="display:none;">
                  <label for="doctorDepartment">Your major</label>
                  <div class="input-wrapper">
                    <input type="text" id="doctorDepartment" name="doctorDepartment" placeholder="e.g. Surgeon">
                  </div>
                </div>
                <span class="field-error" id="roleError"></span>
              </div>
            </div>

            <button type="submit" class="btn-primary">Create Account</button>
            <div class="form-error" id="formError"></div>
          </form>

          <p class="footer-text">
            Already have an account? <a href="#/login">Sign In</a>
          </p>
        </section>

        <section class="hero-section">
          <div class="hero-image" role="img" aria-label="Female doctor in a white coat with a stethoscope"></div>
          <div class="hero-banner">
            <div class="brand">
              <img class="brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
              <span class="brand-text">MediSense AI</span>
            </div>
            <h2>Welcome to <span>MEDISENSE AI</span></h2>
            <p>Transforming Healthcare with Intelligence — seamless patient journeys, live OPD intelligence, real-time telemetry, and AI-driven diagnostics.</p>
          </div>
        </section>
      </div>
    </div>
  `;

  const roleSelect = container.querySelector("#role");
  const doctorDepartmentField = container.querySelector("#doctorDepartmentField");
  const doctorDepartmentInput = container.querySelector("#doctorDepartment");

  const toggleDoctorDepartment = () => {
    const show = roleSelect && roleSelect.value === "Doctor";
    if (doctorDepartmentField) doctorDepartmentField.style.display = show ? "block" : "none";
    if (show && doctorDepartmentInput) doctorDepartmentInput.focus();
  };

  roleSelect?.addEventListener("change", toggleDoctorDepartment);
  toggleDoctorDepartment();

  container.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      const input = container.querySelector(`#${targetId}`);
      if (input) {
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        button.innerHTML = isPassword ? eyeClosed : eyeOpen;
      }
    });
  });

  const form = container.querySelector("#signupForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      ["fullName", "email", "password", "confirmPassword", "role"].forEach((field) => {
        const errEl = container.querySelector(`#${field}Error`);
        if (errEl) errEl.textContent = "";
      });
      const formError = container.querySelector("#formError");
      formError.style.color = "";
      formError.textContent = "";

      const payload = {
        full_name: container.querySelector("#fullName").value.trim(),
        email: container.querySelector("#email").value.trim(),
        password: container.querySelector("#password").value,
        confirmPassword: container.querySelector("#confirmPassword").value,
        role: container.querySelector("#role").value,
        department: container.querySelector("#doctorDepartment")?.value.trim() || "",
      };

      const errors = validateSignup(payload);
      if (Object.keys(errors).length > 0) {
        Object.entries(errors).forEach(([field, message]) => {
          const el = container.querySelector(`#${field}Error`);
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
        setTimeout(() => { window.location.hash = "#/login"; }, 4000);
      } else {
        btn.disabled = false;
        btn.textContent = "Create Account";
        const msg = data.error?.message || `Sign up failed (status ${status}).`;
        formError.textContent =
          status === 409 ? "An account with this email already exists. Please sign in." : msg;
      }
    });
  }
}
