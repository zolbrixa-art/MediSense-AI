import { api } from "../api.js?v=1";
import { adminSidebar, bindAdminLogout } from "./adminShared.js?v=1";

export function renderAdminQueue(container) {
  container.innerHTML = `
    <div class="app-shell">
      ${adminSidebar("#/admin-queue")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Live Queue Monitor</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Parallel queue board for all doctors.</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-muted">Auto-refresh 5s</span>
            <span class="badge badge-blue">Default ID</span>
          </div>
        </header>
        <div class="content">
          <div id="queueBoard" class="admin-queue-board">
            <div class="loading">Loading queues...</div>
          </div>
        </div>
      </main>
    </div>`;
  bindAdminLogout(container);
  loadQueueBoard();
  const interval = setInterval(loadQueueBoard, 5000);
  container.dataset.interval = interval;
}

async function loadQueueBoard() {
  const { data } = await api.get("/api/admin/queue-snapshot");
  const board = document.getElementById("queueBoard");
  if (!data.ok || !data.data?.length) { board.innerHTML = `<div class="text-muted">No doctors registered.</div>`; return; }

  board.innerHTML = data.data.map(q => {
    const currentText = q.current_patient
      ? `<div class="admin-q-current">#${String(q.current_patient.token_number).padStart(2, "0")} — ${q.current_patient.patient_name}</div>`
      : `<div class="admin-q-current text-muted">No patient</div>`;

    const nextHtml = q.next_tokens.length > 0
      ? q.next_tokens.map(t => `<span class="badge badge-amber">#${t.token_number}</span>`).join(" ")
      : `<span class="text-muted text-xs">Empty</span>`;

    return `
      <div class="admin-q-card ${q.is_active ? "" : "admin-q-inactive"}">
        <div class="flex items-center justify-between mb-2">
          <div style="font-weight:700;font-size:0.875rem;">${q.doctor_name}</div>
          <span class="badge ${q.is_active ? "badge-emerald" : "badge-rose"}">${q.is_active ? "Active" : "Break"}</span>
        </div>
        <div class="text-xs text-muted mb-3">${q.department}</div>
        <div class="text-xs text-muted mb-1">NOW SERVING</div>
        ${currentText}
        <div class="text-xs text-muted" style="margin-top:0.75rem;margin-bottom:0.375rem;">NEXT IN QUEUE</div>
        <div class="flex items-center gap-2">${nextHtml}</div>
        <div class="text-xs text-muted" style="margin-top:0.75rem;">${q.waiting_count} patient${q.waiting_count !== 1 ? "s" : ""} waiting</div>
      </div>`;
  }).join("");
}
