import { api } from "../api.js?v=1";
import { adminSidebar, bindAdminLogout } from "./adminShared.js?v=1";

export function renderAdminAudit(container) {
  container.innerHTML = `
    <div class="app-shell">
      ${adminSidebar("#/admin-audit")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Security & Audit Logs</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Access logs, system activity and AI engine metrics.</div>
          </div>
          <div class="flex items-center gap-3"><span class="badge badge-blue">Default ID</span></div>
        </header>
        <div class="content">
          <div class="card">
            <div class="flex items-center justify-between mb-3">
              <div class="card-title" style="margin:0;">Access Logs</div>
              <span class="badge badge-rose">HIPAA</span>
            </div>
            <div id="auditPanel" class="loading">Loading...</div>
          </div>
        </div>
      </main>
    </div>`;
  bindAdminLogout(container);
  loadAuditLogs();
}

async function loadAuditLogs() {
  const { data } = await api.get("/api/admin/audit-logs?limit=50");
  const panel = document.getElementById("auditPanel");
  if (!data.ok || !data.data?.length) { panel.innerHTML = `<div class="text-muted">No audit logs recorded.</div>`; return; }

  const rows = data.data.map(a => {
    const d = new Date(a.timestamp);
    const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Karachi" });

    const actionBadge = a.action_type.includes("UPLOAD") || a.action_type.includes("CREATE")
      ? "badge-emerald"
      : a.action_type.includes("READ") || a.action_type.includes("INSPECT")
        ? "badge-blue"
        : "badge-amber";

    return `<tr>
      <td class="text-muted">${dateStr}<br><span class="text-xs">${timeStr}</span></td>
      <td style="font-weight:600;">${a.actor_name}</td>
      <td><span class="badge badge-blue">${a.actor_role}</span></td>
      <td>${a.patient_name}</td>
      <td><span class="badge ${actionBadge}">${a.action_type}</span></td>
      <td class="text-muted text-xs">${a.ip_address}</td>
    </tr>`;
  }).join("");

  panel.innerHTML = `<div class="table-scroll"><table class="table">
    <thead><tr><th>Timestamp</th><th>User</th><th>Role</th><th>Patient</th><th>Action</th><th>IP</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
