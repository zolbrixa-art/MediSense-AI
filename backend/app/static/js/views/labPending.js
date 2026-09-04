import { api } from "../api.js?v=1";
import { getUser, getPortalId, logout } from "../auth.js?v=1";

let pendingTimer = null;

export function renderLabPending(container) {
  // Purana interval agar chal raha ho to pehle khatam karein
  if (pendingTimer) {
    clearInterval(pendingTimer);
    pendingTimer = null;
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
              <a href="#/lab-pending" class="active">Pending Orders</a>
              <a href="#/lab">Upload Scan</a>
              <a href="#/lab-overview">Scan Overview</a>
              <a href="#/lab-vitals">Vitals</a>
              <a href="#/lab-lookup">Patient Lookup</a>
              <a href="#/lab-history">Scan History</a>
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
            <div class="page-title">Pending Test Orders</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Patients awaiting scan / lab processing.</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="badge badge-blue" title="Your unique MediSense portal ID">ID: ${portalId}</span>
          </div>
        </header>
        <div class="content">
          <div id="pendingGrid" class="lab-pending-grid">
            <div class="loading">Loading pending patients...</div>
          </div>
        </div>
      </main>
    </div>
  `;

  container.querySelector("#logoutBtn")?.addEventListener("click", logout);

  loadPending();
  pendingTimer = setInterval(loadPending, 10000);
}

async function loadPending() {
  const grid = document.getElementById("pendingGrid");

  // Agar user kisi doosre page par chala gaya ho to interval band kar ke return karein
  if (!grid) {
    if (pendingTimer) {
      clearInterval(pendingTimer);
      pendingTimer = null;
    }
    return;
  }

  try {
    const { data } = await api.get("/api/appointments/pending");

    // Network delay ke baad dobara check karein ke element abhi bhi DOM mein mojood hai
    const currentGrid = document.getElementById("pendingGrid");
    if (!currentGrid) return;

    if (!data?.ok) {
      currentGrid.innerHTML = `<div class="text-muted">${data?.error?.message || "Unable to load pending orders."}</div>`;
      return;
    }

    const patients = data.data || [];
    if (patients.length === 0) {
      currentGrid.innerHTML = `
        <div class="lab-pending-empty">
          <div style="font-size:2rem;margin-bottom:0.5rem;">\u2705</div>
          <div class="text-secondary" style="font-weight:600;">No pending patients</div>
          <div class="text-muted text-sm">All orders have been processed.</div>
        </div>`;
      return;
    }

    currentGrid.innerHTML = patients.map(p => {
      const d = p.created_at ? new Date(p.created_at) : null;
      const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }) : "";
      const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "";
      const testText = p.suggested_test || " Diagnostic Test";

      return `
        <div class="lab-patient-card">
          <div class="lab-patient-name">${p.patient_name}</div>
          <div class="lab-patient-detail">Patient MRI ID: <code style="color:#0284c7;font-weight:700;">MRI-${String(p.patient_id).padStart(3, "0")}</code></div>
          <div class="lab-patient-detail" style="font-weight:700;font-size:1rem;color:#1e293b;margin-top:0.25rem;">Token #${String(p.token_number).padStart(2, "0")}</div>
          <div class="lab-patient-detail">Doctor: ${p.doctor_name}</div>
          <div class="lab-patient-detail">${dateStr}${timeStr ? " \u00b7 " + timeStr : ""}</div>
          <div class="lab-suggested-card-box" style="margin-top:0.75rem;padding:0.5rem 0.75rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:0.375rem;color:#0284c7;font-weight:600;font-size:0.875rem;">
            \ud83e\uddea ${testText}
          </div>
          <button type="button" class="btn btn-blue diagnostic-btn" data-appointment-id="${p.id}" data-patient-id="${p.patient_id}" style="margin-top:0.75rem;width:100%;">Diagnostic</button>
        </div>`;
    }).join("");

    currentGrid.querySelectorAll(".diagnostic-btn").forEach((button) => {
      button.addEventListener("click", () => {
        localStorage.setItem("medisense_lab_order", JSON.stringify({
          appointmentId: button.dataset.appointmentId,
          patientId: button.dataset.patientId,
        }));
        window.location.hash = "#/lab";
      });
    });

  } catch (err) {
    console.error("Error loading pending orders:", err);
  }
}