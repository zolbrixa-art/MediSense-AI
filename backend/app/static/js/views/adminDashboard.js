import { api } from "../api.js?v=1";
import { adminSidebar, bindAdminLogout } from "./adminShared.js?v=1";

export function renderAdminDashboard(container) {
  container.innerHTML = `
    <div class="app-shell">
      ${adminSidebar("#/admin-dashboard")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Admin Dashboard</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Hospital capacity, queues and system overview.</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="badge badge-blue">Default ID</span>
          </div>
        </header>
        <div class="content">
          <div id="statsGrid" class="dashboard-grid admin-stats-grid">
            <div class="dash-card"><div class="dash-card-label">Loading...</div></div>
          </div>
          <div class="admin-two-col">
            <div class="admin-col-main">
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Recent System Activity</div>
                  <span class="badge badge-blue">Live</span>
                </div>
                <div id="activityTable" class="loading">Loading...</div>
              </div>
            </div>
            <div class="admin-col-side">
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Live Queue Snapshot</div>
                  <span class="badge badge-emerald">Real-time</span>
                </div>
                <div id="queuePanel" class="loading">Loading...</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>`;

  bindAdminLogout(container);
  loadAll();
  const interval = setInterval(loadAll, 10000);
  container.dataset.interval = interval;
}

async function loadAll() {
  loadStats();
  loadQueue();
  loadActivity();
}

async function loadStats() {
  const { data } = await api.get("/api/admin/stats");
  const grid = document.getElementById("statsGrid");
  if (!data.ok) { grid.innerHTML = `<div class="text-muted">Failed to load.</div>`; return; }
  const s = data.data;
  const cards = [
    { label: "Total Doctors", value: s.total_doctors, icon: "\uD83E\uDDD1\u200D\u2695\uFE0F", accent: "blue" },
    { label: "Total Patients", value: s.total_patients, icon: "\uD83D\uDC65", accent: "emerald" },
    { label: "Today's Appointments", value: s.todays_appointments, icon: "\uD83D\uDCC5", accent: "indigo" },
    { label: "Pending / Queue", value: s.pending, icon: "\u23F3", accent: "amber" },
    { label: "Scans Today", value: s.scans_today, icon: "\uD83D\uDCBE", accent: "blue" },
    { label: "Active Queues", value: s.active_queues, icon: "\uD83D\uDFE2", accent: "emerald" },
  ];
  grid.innerHTML = cards.map(c => `
    <div class="dash-card dash-card-${c.accent}">
      <div class="dash-card-icon">${c.icon}</div>
      <div class="dash-card-value">${c.value}</div>
      <div class="dash-card-label">${c.label}</div>
    </div>`).join("");
}

async function loadQueue() {
  const { data } = await api.get("/api/admin/queue-snapshot");
  const panel = document.getElementById("queuePanel");
  if (!data.ok || !data.data?.length) { panel.innerHTML = `<div class="text-muted">No doctors registered.</div>`; return; }
  panel.innerHTML = data.data.map(q => `
    <div class="admin-queue-card">
      <div class="flex items-center justify-between mb-2">
        <span style="font-weight:600;">${q.doctor_name}</span>
        <span class="badge ${q.is_active ? "badge-emerald" : "badge-rose"}">${q.is_active ? "Active" : "Inactive"}</span>
      </div>
      <div class="text-xs text-muted">${q.department} \u00b7 Serving #${q.current_serving_token || "\u2014"} \u00b7 ${q.waiting_count} waiting</div>
    </div>`).join("");
}

async function loadActivity() {
  const { data } = await api.get("/api/admin/audit-logs?limit=10");
  const panel = document.getElementById("activityTable");
  if (!data.ok || !data.data?.length) { panel.innerHTML = `<div class="text-muted">No activity recorded.</div>`; return; }
  const rows = data.data.map(a => {
    const d = new Date(a.timestamp);
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" });
    return `<tr>
      <td>${a.actor_name}</td>
      <td><span class="badge badge-blue">${a.actor_role}</span></td>
      <td>${a.action_type}</td>
      <td class="text-muted">${timeStr}</td>
    </tr>`;
  }).join("");
  panel.innerHTML = `<div class="table-scroll"><table class="table">
    <thead><tr><th>User</th><th>Role</th><th>Action</th><th>Time</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
