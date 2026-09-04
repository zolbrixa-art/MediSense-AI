import { api } from "../api.js?v=1";
import { adminSidebar, bindAdminLogout } from "./adminShared.js?v=1";

export function renderAdminAppointments(container) {
  container.innerHTML = `
    <div class="app-shell">
      ${adminSidebar("#/admin-appointments")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">All Appointments</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Complete hospital appointment records.</div>
          </div>
          <div class="flex items-center gap-3"><span class="badge badge-blue">Default ID</span></div>
        </header>
        <div class="content">
          <div class="card">
            <div class="flex items-center gap-3 mb-3">
              <select id="statusFilter" class="admin-filter">
                <option value="">All Status</option>
                <option value="Pending">Pending</option>
                <option value="InConsultation">In Consultation</option>
                <option value="Completed">Completed</option>
                <option value="Skipped">Skipped</option>
              </select>
              <button id="filterBtn" class="btn btn-blue btn-sm">Filter</button>
            </div>
            <div id="apptPanel" class="loading">Loading...</div>
          </div>
        </div>
      </main>
    </div>`;
  bindAdminLogout(container);
  container.querySelector("#filterBtn").addEventListener("click", () => loadAppointments());
  loadAppointments();
}

async function loadAppointments() {
  const status = document.getElementById("statusFilter").value;
  const url = status ? `/api/admin/appointments?status=${status}&limit=50` : "/api/admin/appointments?limit=50";
  const { data } = await api.get(url);
  const panel = document.getElementById("apptPanel");
  if (!data.ok || !data.data?.length) { panel.innerHTML = `<div class="text-muted">No appointments found.</div>`; return; }

  const statusBadge = (s) => {
    if (s === "Pending") return "badge-amber";
    if (s === "InConsultation") return "badge-blue";
    if (s === "Completed") return "badge-emerald";
    return "badge-rose";
  };

  const rows = data.data.map(a => {
    const d = a.created_at ? new Date(a.created_at) : null;
    const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "\u2014";
    const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "";
    return `<tr>
      <td>#${a.token_number}</td>
      <td>${a.patient_name}</td>
      <td>${a.doctor_name}</td>
      <td><span class="badge ${statusBadge(a.status)}">${a.status}</span></td>
      <td class="text-muted">${dateStr} \u00b7 ${timeStr}</td>
    </tr>`;
  }).join("");

  panel.innerHTML = `<div class="table-scroll"><table class="table">
    <thead><tr><th>Token</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Created</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
