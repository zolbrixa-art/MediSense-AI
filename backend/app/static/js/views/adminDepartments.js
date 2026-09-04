import { api } from "../api.js?v=1";
import { adminSidebar, bindAdminLogout } from "./adminShared.js?v=1";

export function renderAdminDepartments(container) {
  container.innerHTML = `
    <div class="app-shell">
      ${adminSidebar("#/admin-departments")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Departments</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Hospital department overview and capacity.</div>
          </div>
          <div class="flex items-center gap-3"><span class="badge badge-blue">Default ID</span></div>
        </header>
        <div class="content">
          <div id="deptGrid" class="dashboard-grid admin-stats-grid">
            <div class="dash-card"><div class="dash-card-label">Loading...</div></div>
          </div>
        </div>
      </main>
    </div>`;
  bindAdminLogout(container);
  loadDepartments();
}

async function loadDepartments() {
  const { data } = await api.get("/api/admin/departments");
  const grid = document.getElementById("deptGrid");
  if (!data.ok || !data.data?.length) { grid.innerHTML = `<div class="text-muted">No departments found.</div>`; return; }

  const accents = ["blue", "emerald", "indigo", "amber", "rose"];
  grid.innerHTML = data.data.map((d, i) => `
    <div class="dash-card dash-card-${accents[i % accents.length]}">
      <div class="dash-card-icon">\uD83C\uDFE5</div>
      <div class="dash-card-value">${d.doctor_count}</div>
      <div class="dash-card-label">${d.name}</div>
      <div class="dash-card-sub">${d.active_doctors} active \u00b7 ${d.total_tokens_today} tokens today</div>
    </div>`).join("");
}
