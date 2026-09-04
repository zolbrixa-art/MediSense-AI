import { api } from "../api.js?v=1";
import { getUser, getPortalId, logout } from "../auth.js?v=1";

let historyTimer = null;

function formatPatientMriId(scan) {
  const rawId = scan.patient_portal_id || scan.portal_id || scan.patient_id;
  const match = String(rawId || "").match(/^(?:MRI[-_ ]?)?(\d+)$/i);
  return match ? `MRI-${String(match[1]).padStart(3, "0")}` : "—";
}

export function renderLabHistory(container) {
  // Purana interval agar chal raha ho to pehle khatam karein
  if (historyTimer) {
    clearInterval(historyTimer);
    historyTimer = null;
  }

  const user = getUser();
  const portalId = getPortalId(user);
  container.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div>
          <div class="sidebar-brand">
            <img class="sidebar-brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
              <div>
                <div class="sidebar-brand-title">MediSense AI</div>
                <div class="sidebar-brand-subtitle">${user?.role === "Doctor" ? "Clinical Decision Support" : "Lab Technician"}</div>
              </div>
          </div>
          <nav class="sidebar-nav">
            ${user?.role === "Doctor" ? `
              <a href="#/doctor-dashboard">Dashboard</a>
              <a href="#/doctor">Console Overview</a>
              <a href="#/queue">OPD Live Queue</a>
              <a href="#/lab">Scan Uploads</a>
            ` : `
              <a href="#/lab-dashboard">Dashboard</a>
              <a href="#/lab-pending">Pending Orders</a>
              <a href="#/lab">Upload Scan</a>
              <a href="#/lab-overview">Scan Overview</a>
              <a href="#/lab-vitals">Vitals</a>
              <a href="#/lab-lookup">Patient Lookup</a>
              <a href="#/lab-history" class="active">Scan History</a>
              <a href="#/queue">Live Queue</a>
            `}
          </nav>
        </div>
        <div class="sidebar-footer">
          <div class="flex items-center gap-3">
            <div class="user-avatar">${user?.role === "Doctor" ? "DR" : "LT"}</div>
            <div>
              <div class="user-name">${user?.full_name || "User"}</div>
              <div class="user-role">${user?.role === "Doctor" ? "\u25cf OPD Online" : "\u25cf Lab Online"}</div>
            </div>
          </div>
          <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
        </div>
      </aside>
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Scan History</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">All uploaded scans and AI analysis results.</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="badge badge-blue" title="Your unique MediSense portal ID">ID: ${portalId}</span>
          </div>
        </header>
        <div class="content">
          <div class="card">
            <div class="flex items-center justify-between mb-3">
              <div class="card-title" style="margin:0;">Recent Uploads</div>
              <span class="badge badge-blue">Live Feed</span>
            </div>
            <div id="historyTable" class="loading">Loading...</div>
          </div>
        </div>
      </main>
    </div>
  `;

  container.querySelector("#logoutBtn")?.addEventListener("click", logout);

  loadHistory();
  historyTimer = setInterval(loadHistory, 15000);
}

async function loadHistory() {
  const panel = document.getElementById("historyTable");

  // Agar user kisi doosre page par chala gaya ho to interval band karein aur return karein
  if (!panel) {
    if (historyTimer) {
      clearInterval(historyTimer);
      historyTimer = null;
    }
    return;
  }

  try {
    const [{ data }, { data: appointmentsData }] = await Promise.all([
      api.get("/api/imaging/recent-scans?limit=50"),
      api.get("/api/appointments/my"),
    ]);

    // Network request poori hone ke baad dobara check karein ke element abhi bhi DOM mein mojood hai
    const currentPanel = document.getElementById("historyTable");
    if (!currentPanel) return;

    const scans = data?.ok ? data.data || [] : [];
    const appointments = appointmentsData?.ok ? appointmentsData.data || [] : [];
    const activeOrder = JSON.parse(localStorage.getItem("medisense_lab_order") || "null");
    const scannedPatients = new Set(scans.map((scan) => String(scan.patient_id)));
    const orders = appointments.filter((appointment) => appointment.suggested_test && !scannedPatients.has(String(appointment.patient_id)));

    if (!scans.length && !orders.length) {
      currentPanel.innerHTML = `<div class="text-muted">No scans uploaded yet.</div>`;
      return;
    }

    const scanRows = scans.map(s => {
      const d = s.uploaded_at ? new Date(s.uploaded_at) : null;
      const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "\u2014";
      const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "";

      const aiBadge = s.ai_status === "AI Flagged"
        ? `<span class="badge badge-rose">${s.ai_status}</span>`
        : s.ai_status === "AI Cleared"
          ? `<span class="badge badge-emerald">${s.ai_status}</span>`
          : `<span class="badge badge-amber">${s.ai_status || "Pending"}</span>`;

      return `
        <tr>
          <td><code style="color:#38bdf8;font-weight:600;">${formatPatientMriId(s)}</code></td>
          <td>${s.patient_name}</td>
          <td>${s.scan_type}</td>
          <td><span class="badge badge-emerald">Completed</span></td>
          <td>${s.confidence_score != null ? s.confidence_score + "%" : "\u2014"}</td>
          <td class="text-muted">${dateStr} \u00b7 ${timeStr}</td>
        </tr>`;
    }).join("");
    const orderRows = orders.map((order) => {
      const status = activeOrder?.appointmentId === String(order.id) ? "In Consultation" : "Pending";
      const date = order.created_at ? new Date(order.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }) : "—";
      return `
        <tr>
          <td>—</td>
          <td><code style="color:#38bdf8;font-weight:600;">MRI-${String(order.patient_id).padStart(3, "0")}</code></td>
          <td>${order.patient_name || "Unknown"}</td>
          <td>${order.suggested_test}</td>
          <td><span class="badge ${status === "In Consultation" ? "badge-blue" : "badge-amber"}">${status}</span></td>
          <td>—</td>
          <td class="text-muted">${date}</td>
        </tr>`;
    }).join("");
    const rows = orderRows + scanRows;

    currentPanel.innerHTML = `
      <div class="table-scroll">
        <table class="table">
          <thead><tr>
            <th>Record</th><th>Patient MRI ID</th><th>Patient</th><th>Type / Test</th><th>Lab Status</th><th>Conf.</th><th>Time</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

  } catch (err) {
    console.error("Error loading history:", err);
  }
}