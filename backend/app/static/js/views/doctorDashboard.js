import { api } from "../api.js?v=1";
import { getUser, getPortalId } from "../auth.js?v=1";
import { doctorSidebar, bindDoctorLogout } from "./doctorShared.js?v=1";

export function renderDoctorDashboard(container) {
  const user = getUser();
  const portalId = getPortalId(user);
  container.innerHTML = `
    <div class="app-shell">
      ${doctorSidebar("#/doctor-dashboard")}
      <main class="main">
        <header class="top-header">
          <div class="flex items-center gap-4">
            <div class="page-title">Dashboard</div>
            <span class="badge badge-emerald">Live Overview</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-muted">Auto-refresh every 10s</span>
            <span class="badge badge-blue" title="Your unique MediSense portal ID">ID: ${portalId}</span>
          </div>
        </header>
        <div class="content">
          <div id="dashboardStats" class="dashboard-grid">
            <div class="dash-card"><div class="dash-card-label">Loading...</div></div>
          </div>
          <div id="liveTokenContainer" class="live-token-container">
            <div class="text-muted" style="padding:1rem;">Loading current token...</div>
          </div>
        </div>
      </main>
    </div>
  `;

  bindDoctorLogout(container);

  loadDashboardStats();
  const interval = setInterval(loadDashboardStats, 10000);
  container.dataset.interval = interval;
}

async function loadDashboardStats() {
  const { data } = await api.get("/api/appointments/dashboard-stats");
  const statsEl = document.getElementById("dashboardStats");
  const liveEl = document.getElementById("liveTokenContainer");
  if (!statsEl || !liveEl) return;

  if (!data.ok) {
    statsEl.innerHTML = `<div class="text-muted">${data.error?.message || "Unable to load dashboard."}</div>`;
    return;
  }

  const s = data.data;

  const cards = [
    { label: "Total Appointments", value: s.total_appointments, icon: "📋", accent: "blue" },
    { label: "Today's Appointments", value: s.todays_appointments, icon: "📅", accent: "indigo" },
    { label: "Pending", value: s.pending, icon: "⏳", accent: "amber" },
    { label: "In Progress", value: s.in_progress, icon: "🩺", accent: "emerald" },
    { label: "Token Number", value: `#${s.token_number || "—"}`, icon: "🎫", accent: "rose" },
    { label: "Remaining", value: s.remaining, icon: "📊", accent: "blue" },
  ];

  statsEl.innerHTML = cards
    .map(
      (c) => `
    <div class="dash-card dash-card-${c.accent}">
      <div class="dash-card-icon">${c.icon}</div>
      <div class="dash-card-value">${c.value}</div>
      <div class="dash-card-label">${c.label}</div>
    </div>
  `
    )
    .join("");

  if (s.current_patient) {
    const p = s.current_patient;
    liveEl.innerHTML = `
      <div class="live-token-inner">
        <div class="live-token-left">
          <div class="live-token-badge">NOW SERVING</div>
          <div class="live-token-number">#${String(p.token_number).padStart(2, "0")}</div>
        </div>
        <div class="live-token-info">
          <div class="live-token-patient">${p.patient_name}</div>
          <div class="live-token-status">Consultation in progress</div>
        </div>
        <a href="#/queue" class="btn btn-blue live-token-btn">View More →</a>
      </div>
    `;
  } else {
    liveEl.innerHTML = `
      <div class="live-token-inner live-token-empty">
        <div class="live-token-left">
          <div class="live-token-badge" style="opacity:0.5;">NO ACTIVE TOKEN</div>
          <div class="live-token-number" style="color:var(--text-muted);">—</div>
        </div>
        <div class="live-token-info">
          <div class="live-token-patient" style="color:var(--text-muted);">No patient in consultation</div>
          <div class="live-token-status">Queue is idle</div>
        </div>
        <a href="#/queue" class="btn btn-slate live-token-btn">View Queue →</a>
      </div>
    `;
  }
}
