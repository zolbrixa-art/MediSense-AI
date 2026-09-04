import { api } from "../api.js?v=2";
import { validateLogin, setSession, getRoleDashboard } from "../auth.js?v=4";

const eyeOpen = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeClosed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

export function renderLogin(container) {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background-color:var(--bg-page);padding:1rem;">
      <div class="container">
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

        <section class="form-section">
          <div class="brand">
            <img class="brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
            <span class="brand-text">MediSense AI</span>
          </div>

          <div class="heading">
            <h1>Sign In</h1>
            <p>Welcome back. Please enter your credentials.</p>
          </div>

          <form id="loginForm" autocomplete="off" novalidate>
            <div class="form-row">
              <div class="form-group full-width">
                <label for="email">Email</label>
                <div class="input-wrapper">
                  <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <input type="email" id="email" name="email" placeholder="Enter your email" required>
                </div>
                <span class="field-error" id="emailError"></span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group full-width">
                <label for="password">Password</label>
                <div class="input-wrapper">
                  <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input type="password" id="password" name="password" class="with-toggle" placeholder="Enter your password" required>
                  <button type="button" class="toggle-password" aria-label="Toggle password visibility" data-target="password">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
                <span class="field-error" id="passwordError"></span>
              </div>
            </div>

            <button type="submit" class="btn-primary">Sign In</button>
            <div class="form-error" id="formError"></div>
          </form>

          <p class="footer-text">
            Don't have an account? <a href="#/signup">Sign Up</a>
          </p>
        </section>
      </div>
    </div>
  `;

  const toggleBtn = container.querySelector(".toggle-password");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const input = container.querySelector("#password");
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggleBtn.innerHTML = isPassword ? eyeClosed : eyeOpen;
    });
  }

  const form = container.querySelector("#loginForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      container.querySelector("#emailError").textContent = "";
      container.querySelector("#passwordError").textContent = "";
      container.querySelector("#formError").textContent = "";

      const payload = {
        email: container.querySelector("#email").value.trim(),
        password: container.querySelector("#password").value,
      };

      const errors = validateLogin(payload);
      if (Object.keys(errors).length > 0) {
        if (errors.email) container.querySelector("#emailError").textContent = errors.email;
        if (errors.password) container.querySelector("#passwordError").textContent = errors.password;
        return;
      }

      const { status, data } = await api.post("/api/auth/login", payload, false);

      if (data.ok) {
        setSession(data.data.access_token, data.data.user);
        window.location.href = `/index.html${getRoleDashboard(data.data.user.role)}`;
      } else {
        container.querySelector("#formError").textContent =
          data.error?.message || `Login failed (status ${status}).`;
      }
    });
  }
}
