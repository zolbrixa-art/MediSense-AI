import { api } from "../api.js?v=1";
import { getUser } from "../auth.js?v=4";
import { patientSidebar, patientPortalId, bindPatientLogout } from "./patientShared.js?v=2";

export function renderPatientQueue(container) {
  const user = getUser();
  container.innerHTML = `
    <div class="app-shell">
      ${patientSidebar("#/patient-queue")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Live OPD Queue</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Track your doctor's queue in real-time.</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-muted">Auto-refresh 5s</span>
            ${patientPortalId()}
          </div>
        </header>
        <div class="content">
          <div class="card mb-3">
            <div class="flex items-center gap-3 flex-wrap">
              <label class="pt-book-label">Select Doctor</label>
              <select id="doctorSelect" class="admin-filter" style="width:auto;min-width:12rem;">
                <option value="">Loading doctors...</option>
              </select>
            </div>
          </div>
          <div id="queuePanel" class="card">
            <div class="text-muted">Select a doctor to view their queue.</div>
          </div>
        </div>
      </main>
    </div>`;

  bindPatientLogout(container);
  loadDoctors();
  const interval = setInterval(() => {
    const docId = document.getElementById("doctorSelect").value;
    if (docId) loadQueue(docId);
  }, 5000);
  container.dataset.interval = interval;
}

async function loadDoctors() {
  const { data } = await api.get("/api/appointments/doctors");
  const select = document.getElementById("doctorSelect");
  if (!data.ok || !data.data?.length) {
    select.innerHTML = `<option value="">No doctors available</option>`;
    return;
  }
  select.innerHTML = `<option value="">-- Select Doctor --</option>` +
    data.data.map(d => `<option value="${d.id}">${d.full_name} (${d.department})</option>`).join("");

  select.addEventListener("change", () => {
    const docId = select.value;
    if (docId) loadQueue(docId);
    else document.getElementById("queuePanel").innerHTML = `<div class="text-muted">Select a doctor to view their queue.</div>`;
  });
}

async function loadQueue(doctorId) {
  const { data } = await api.get(`/api/appointments/queue/${doctorId}`);
  const panel = document.getElementById("queuePanel");
  if (!data.ok) {
    panel.innerHTML = `<div class="text-muted">${data.error?.message}</div>`;
    return;
  }
  const q = data.data;
  panel.innerHTML = `
    <div class="pt-queue-stats">
      <div class="pt-queue-stat-card">
        <div class="pt-queue-stat-label">Now Serving</div>
        <div class="pt-queue-stat-value">#${String(q.current_serving_token).padStart(2, "0")}</div>
      </div>
      <div class="pt-queue-stat-card">
        <div class="pt-queue-stat-label">Last Token Issued</div>
        <div class="pt-queue-stat-value">#${String(q.last_allocated_token).padStart(2, "0")}</div>
      </div>
      <div class="pt-queue-stat-card">
        <div class="pt-queue-stat-label">Est. Wait Time</div>
        <div class="pt-queue-stat-value">${q.estimated_wait_minutes} min</div>
      </div>
      <div class="pt-queue-stat-card">
        <div class="pt-queue-stat-label">Patients Waiting</div>
        <div class="pt-queue-stat-value">${q.waiting.length}</div>
      </div>
    </div>
    ${q.waiting.length > 0 ? `
      <div class="table-scroll mt-3"><table class="table">
        <thead><tr><th>Token</th><th>Status</th><th>Scheduled</th></tr></thead>
        <tbody>${q.waiting.map(a => {
          const d = a.scheduled_time ? new Date(a.scheduled_time) : null;
          const dateStr = d ? d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric", timeZone:"Asia/Karachi" }) : "–";
          const timeStr = d ? d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true, timeZone:"Asia/Karachi" }) : "";
          return `<tr>
            <td><strong>#${String(a.token_number).padStart(2, "0")}</strong></td>
            <td><span class="badge badge-blue">${a.status}</span></td>
            <td class="text-muted">${dateStr} · ${timeStr}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>` : `<div class="text-muted mt-3">No patients waiting. Queue is clear.</div>`}
  `;
}
