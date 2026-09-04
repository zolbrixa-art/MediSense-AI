import { api } from "../api.js?v=1";
import { patientSidebar, patientPortalId, bindPatientLogout } from "./patientShared.js?v=2";

export function renderPatientAppointments(container) {
  container.innerHTML = `
    <div class="app-shell">
      ${patientSidebar("#/patient-appointments")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">My Appointments</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Upcoming visits, live token status and past history.</div>
          </div>
          <div class="flex items-center gap-2">
            ${patientPortalId()}
          </div>
        </header>
        <div class="content">
          <div class="admin-two-col">
            <div>
              <div class="card mb-3">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Upcoming Appointments</div>
                  <a href="#/patient-book" class="btn btn-blue btn-sm">+ Book New</a>
                </div>
                <div id="upcomingPanel" class="loading">Loading...</div>
              </div>
              <div class="card">
                <div class="card-title mb-3" style="margin:0;">Past Visit History</div>
                <div id="historyPanel" class="loading">Loading...</div>
              </div>
            </div>
            <div>
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Live Token Tracker</div>
                  <span class="badge badge-blue">Auto 10s</span>
                </div>
                <div id="tokenTracker">Loading...</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>`;

  bindPatientLogout(container);
  loadAppointments();
  const interval = setInterval(loadTokenTracker, 10000);
  container.dataset.interval = interval;
}

async function loadAppointments() {
  const { data } = await api.get("/api/appointments/my");
  if (!data.ok) return;

  const all = data.data;
  const upcoming = all.filter(a => a.status === "Pending" || a.status === "InConsultation");
  const past = all.filter(a => a.status === "Completed" || a.status === "Skipped");

  const statusBadge = s => {
    if (s === "InConsultation") return "badge-amber";
    if (s === "Completed") return "badge-emerald";
    if (s === "Skipped") return "badge-rose";
    return "badge-blue";
  };

  const fmt = iso => {
    if (!iso) return "–";
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-GB", {day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Karachi"})} · ${d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Karachi"})}`;
  };

  const upEl = document.getElementById("upcomingPanel");
  if (upcoming.length) {
    upEl.innerHTML = upcoming.map(a => `
      <div class="pt-appt-row">
        <div class="pt-appt-token">#${String(a.token_number).padStart(2,"0")}</div>
        <div class="pt-appt-details">
          <div class="text-sm" style="font-weight:600;">${fmt(a.scheduled_time)}</div>
          <div class="text-xs text-muted">Appointment #${a.id}</div>
        </div>
        <span class="badge ${statusBadge(a.status)}">${a.status}</span>
      </div>`).join("");
  } else {
    upEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;padding:0.75rem 0;">
        <span class="text-muted text-sm">No upcoming appointments found.</span>
        <a href="#/patient-book" class="btn btn-blue btn-sm" style="display:inline-flex;align-items:center;gap:0.35rem;font-weight:600;padding:0.4rem 0.85rem;background-color:#1d4ed8;color:#ffffff;border-radius:0.375rem;text-decoration:none;font-size:0.8rem;box-shadow:0 2px 4px rgba(29,78,216,0.25);">
          Book Appointment 
        </a>
      </div>`;
  }

  const histEl = document.getElementById("historyPanel");
  if (past.length) {
    histEl.innerHTML = `<div class="table-scroll"><table class="table">
      <thead><tr><th>Token</th><th>Status</th><th>Completed</th></tr></thead>
      <tbody>${past.map(a => `<tr>
        <td>#${a.token_number}</td>
        <td><span class="badge ${statusBadge(a.status)}">${a.status}</span></td>
        <td class="text-muted">${fmt(a.completed_at || a.scheduled_time)}</td>
      </tr>`).join("")}</tbody></table></div>`;
  } else {
    histEl.innerHTML = `<div class="text-muted text-sm">No past visits yet.</div>`;
  }

  // Load token tracker for first upcoming appointment
  if (upcoming.length) {
    loadTokenTracker(upcoming[0].id);
  } else {
    document.getElementById("tokenTracker").innerHTML = `<div class="text-muted text-sm">No active appointment to track.</div>`;
  }
}

async function loadTokenTracker(appointmentId) {
  if (!appointmentId) return;
  const { data } = await api.get(`/api/patient/token-position/${appointmentId}`);
  const el = document.getElementById("tokenTracker");
  if (!el) return;
  if (!data.ok) { el.innerHTML = `<div class="text-muted text-sm">Unable to load queue position.</div>`; return; }
  const q = data.data;
  const pct = q.token_number > 0 ? Math.min(100, Math.round(((q.token_number - q.patients_ahead) / q.token_number) * 100)) : 0;

  el.innerHTML = `
    <div class="pt-queue-info mb-3">
      <div class="pt-queue-token">Token <span>#${String(q.token_number).padStart(2,"0")}</span></div>
      <span class="badge ${q.status === "InConsultation" ? "badge-amber" : "badge-blue"}">${q.status}</span>
    </div>
    <div class="pt-queue-meta mb-3">
      <span class="text-xs text-muted">Now Serving: <strong>#${q.current_serving || "–"}</strong></span>
      <span class="text-xs text-muted">Ahead: <strong>${q.patients_ahead}</strong></span>
      <span class="text-xs text-muted">Est. Wait: <strong>~${q.estimated_wait_min} min</strong></span>
    </div>
    <div class="pt-queue-bar-wrap">
      <div class="pt-queue-bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="text-xs text-muted mt-2 text-center">${q.patients_ahead === 0 ? "🟢 You are next!" : `${q.patients_ahead} patient${q.patients_ahead !== 1 ? "s" : ""} before you`}</div>`;
}
