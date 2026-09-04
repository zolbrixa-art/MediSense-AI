import { api } from "../api.js?v=1";
import { getUser } from "../auth.js?v=3";
import { patientSidebar, patientPortalId, bindPatientLogout } from "./patientShared.js?v=2";

let patientTimer = null;

export function renderPatientDashboard(container) {
  // Purana interval agar chal raha ho to pehle clear karein
  if (patientTimer) {
    clearInterval(patientTimer);
    patientTimer = null;
  }

  const user = getUser();
  container.innerHTML = `
    <div class="app-shell">
      ${patientSidebar("#/patient-dashboard")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">My Health Dashboard</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Welcome back, ${user?.full_name || "Patient"}</div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              ${patientPortalId()}
            </div>
          </div>
        </header>
        <div class="content">
          <div id="statsGrid" class="dashboard-grid admin-stats-grid">
            <div class="dash-card"><div class="dash-card-label">Loading...</div></div>
          </div>
          <div class="admin-two-col" style="margin-top:1.25rem;">
            <div>
              <div class="card mb-3">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Live Token Queue</div>
                  <span class="badge badge-blue" id="queueRefreshBadge">Live</span>
                </div>
                <div id="queueBar">Loading queue...</div>
              </div>
              <div class="card">
                <div class="card-title" style="margin-bottom:0.75rem;">Quick Actions</div>
                <div class="pt-quick-actions">
                  <a href="#/patient-book" class="pt-quick-btn">
                    <div class="pt-quick-icon">📅</div>
                    <div class="pt-quick-label">Book Appointment</div>
                  </a>
                  <a href="#/patient-records" class="pt-quick-btn">
                    <div class="pt-quick-icon">💊</div>
                    <div class="pt-quick-label">View Latest Prescription</div>
                  </a>
                  <a href="#/patient-vitals" class="pt-quick-btn">
                    <div class="pt-quick-icon">💓</div>
                    <div class="pt-quick-label">Vitals Monitor</div>
                  </a>
                  <a href="#/patient-reports" class="pt-quick-btn">
                    <div class="pt-quick-icon">🔬</div>
                    <div class="pt-quick-label">Lab Reports</div>
                  </a>
                </div>
              </div>
            </div>
            <div class="admin-col-side">
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Active Reminders</div>
                  <span class="badge badge-amber" id="reminderBadge">–</span>
                </div>
                <div id="remindersPanel">Loading...</div>
              </div>
              <div class="card">
                <div class="flex items-center justify-between mb-2">
                  <div class="card-title" style="margin:0;">Latest Vitals</div>
                  <span id="vitalAlert" class="badge"></span>
                </div>
                <div id="vitalsPanel">Loading...</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>`;

  bindPatientLogout(container);
  
  loadStats();
  loadReminders();
  
  patientTimer = setInterval(loadStats, 15000);
}

// ─── Patient Stats Cards ───────────────────────────────────────

async function loadStats() {
  const statsGridEl = document.getElementById("statsGrid");

  // Agar user kisi doosre page par chala gaya ho to timer stop karein
  if (!statsGridEl) {
    if (patientTimer) {
      clearInterval(patientTimer);
      patientTimer = null;
    }
    return;
  }

  try {
    const { data } = await api.get("/api/patient/stats");
    
    const currentGrid = document.getElementById("statsGrid");
    if (!currentGrid) return;

    if (!data?.ok) return;
    const s = data.data || {};

    const cards = [
      { label: "Total Appointments", value: s.total_appointments ?? 0, icon: "📅", accent: "blue" },
      { label: "Upcoming Visits", value: s.upcoming_count ?? 0, icon: "🎫", accent: "amber" },
      { label: "Completed Visits", value: s.completed_count ?? 0, icon: "✅", accent: "emerald" },
      { label: "Prescriptions", value: s.rx_count ?? 0, icon: "💊", accent: "indigo" },
      { label: "Lab Scans", value: s.scan_count ?? 0, icon: "🔬", accent: "blue" },
      { 
        label: "Vitals Status", 
        value: s.latest_vitals?.alert_level || "Normal", 
        icon: "💓", 
        accent: s.latest_vitals?.alert_level === "CRITICAL" ? "rose" : s.latest_vitals?.alert_level === "WARNING" ? "amber" : "emerald" 
      },
    ];

    currentGrid.innerHTML = cards.map(c => `
      <div class="dash-card dash-card-${c.accent}">
        <div class="dash-card-icon">${c.icon}</div>
        <div class="dash-card-value">${c.value}</div>
        <div class="dash-card-label">${c.label}</div>
      </div>
    `).join("");

    // Queue bar update karein
    renderQueueBar(s);

    // Vitals panel update karein
    const v = s.latest_vitals;
    const vPanel = document.getElementById("vitalsPanel");
    const vBadge = document.getElementById("vitalAlert");
    if (vPanel) {
      if (v) {
        if (vBadge) {
          vBadge.style.display = "inline-block";
          vBadge.textContent = v.alert_level || "Normal";
          vBadge.className = `badge ${v.alert_level === "CRITICAL" ? "badge-rose" : v.alert_level === "WARNING" ? "badge-amber" : "badge-emerald"}`;
        }
        vPanel.innerHTML = `
          <div class="pt-vital-row"><span class="text-muted">Heart Rate</span><strong>${v.heart_rate ?? "–"} BPM</strong></div>
          <div class="pt-vital-row"><span class="text-muted">SpO2</span><strong>${v.spo2 ?? "–"}%</strong></div>
          <div class="pt-vital-row"><span class="text-muted">Temperature</span><strong>${v.temperature_f ?? "–"}°F</strong></div>`;
      } else {
        if (vBadge) vBadge.style.display = "none";
        vPanel.innerHTML = `<div class="text-muted text-sm">No vitals recorded.</div>`;
      }
    }
  } catch (err) {
    console.error("Error loading patient stats:", err);
  }
}

// ─── Live Queue Bar ────────────────────────────────────────────

function renderQueueBar(s) {
  const el = document.getElementById("queueBar");
  if (!el) return;

  const appt = s.active_token || s.next_appointment;
  if (!appt) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;padding:0.5rem 0;">
        <div class="text-muted text-sm">No active or upcoming appointment booked yet.</div>
        <a href="#/patient-book" class="btn btn-blue btn-sm" style="display:inline-flex;align-items:center;gap:0.35rem;font-weight:600;padding:0.5rem 1rem;background-color:#1d4ed8;color:#ffffff;border-radius:0.5rem;text-decoration:none;box-shadow:0 4px 6px -1px rgba(29,78,216,0.25);">
          <span></span> Book Appointment Now
        </a>
      </div>`;
    return;
  }

  const myToken = appt.token_number;
  const current = appt.current_serving || 0;
  const ahead = Math.max(0, myToken - current - 1);
  const pct = myToken > 0 ? Math.min(100, Math.round((current / myToken) * 100)) : 0;
  const statusLabel = s.active_token ? "IN CONSULTATION" : "PENDING";
  const statusColor = s.active_token ? "badge-amber" : "badge-blue";

  el.innerHTML = `
    <div class="pt-queue-info mb-3" style="display:flex;align-items:center;justify-content:space-between;">
      <div class="pt-queue-token">Token <span>#${String(myToken).padStart(2, "0")}</span></div>
      <div class="flex items-center gap-2">
        <span class="badge ${statusColor}">${statusLabel}</span>
        <a href="#/patient-book" class="btn btn-blue btn-xs" style="padding:0.3rem 0.65rem;background:#1d4ed8;color:#fff;border-radius:0.375rem;font-size:0.75rem;font-weight:600;text-decoration:none;">+ Book New</a>
      </div>
    </div>
    <div class="pt-queue-meta mb-3" style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;">
      <span class="text-muted text-xs">Doctor: <strong>${appt.doctor_name || "Doctor"}</strong></span>
      <span class="text-muted text-xs">Dept: <strong>${appt.department || "General"}</strong></span>
      <span class="text-muted text-xs">Now Serving: <strong>#${current || "–"}</strong></span>
      <span class="text-muted text-xs">~${ahead * 8} min wait</span>
    </div>
    <div class="pt-queue-bar-wrap" style="background:#0f172a;border-radius:9999px;height:8px;overflow:hidden;border:1px solid #334155;">
      <div class="pt-queue-bar-fill" style="width:${pct}%;background:linear-gradient(to right, #60a5fa, #1d4ed8);height:100%;transition:width 0.4s ease;"></div>
    </div>
    <div class="flex items-center justify-between" style="margin-top:0.375rem;">
      <span class="text-xs text-muted">Token #01</span>
      <span class="text-xs text-muted">${ahead} patient${ahead !== 1 ? "s" : ""} ahead</span>
      <span class="text-xs text-muted">Your Token #${String(myToken).padStart(2, "0")}</span>
    </div>`;
}

// ─── Reminders Panel ───────────────────────────────────────────

async function loadReminders() {
  const panel = document.getElementById("remindersPanel");
  const badge = document.getElementById("reminderBadge");
  if (!panel) return;

  try {
    const { data } = await api.get("/api/patient/reminders");
    
    const currentPanel = document.getElementById("remindersPanel");
    const currentBadge = document.getElementById("reminderBadge");
    if (!currentPanel) return;

    if (!data?.ok || !data.data?.length) {
      if (currentBadge) currentBadge.textContent = "0";
      currentPanel.innerHTML = `<div class="text-muted text-sm">No active reminders.</div>`;
      return;
    }

    if (currentBadge) currentBadge.textContent = data.data.length;
    currentPanel.innerHTML = data.data.slice(0, 4).map(r => `
      <div class="pt-reminder-item ${r.priority === "high" ? "pt-reminder-high" : ""}">
        <div class="pt-reminder-icon">${r.type === "appointment" ? "🏥" : "💊"}</div>
        <div>
          <div class="pt-reminder-title">${r.title}</div>
          <div class="pt-reminder-body">${r.body}</div>
        </div>
      </div>`).join("");
  } catch (err) {
    console.error("Error loading reminders:", err);
  }
}