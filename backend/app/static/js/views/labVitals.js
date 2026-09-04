import { api } from "../api.js?v=1";
import { getUser, getPortalId, logout } from "../auth.js?v=4";

let selectedPatientId = null;
let selectedPatientName = "";
let selectedPatientPortalId = "";
let allPatients = [];

export function renderLabVitals(container) {
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
              <div class="sidebar-brand-subtitle">Lab Technician</div>
            </div>
          </div>
          <nav class="sidebar-nav">
            <a href="#/lab-dashboard">Dashboard</a>
            <a href="#/lab-pending">Pending Orders</a>
            <a href="#/lab">Upload Scan</a>
            <a href="#/lab-overview">Scan Overview</a>
            <a href="#/lab-vitals" class="active">Vitals</a>
            <a href="#/lab-lookup">Patient Lookup</a>
            <a href="#/lab-history">Scan History</a>
            <a href="#/queue">Live Queue</a>
          </nav>
        </div>
        <div class="sidebar-footer">
          <div class="flex items-center gap-3">
            <div class="user-avatar">LT</div>
            <div>
              <div class="user-name">${user?.full_name || "Lab Tech"}</div>
              <div class="user-role">● Lab Technician</div>
            </div>
          </div>
          <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
        </div>
      </aside>
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Patient Vitals</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Record physical checkup vitals for patients.</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge-blue" title="Your unique MediSense portal ID">ID: ${portalId}</span>
          </div>
        </header>
        <div class="content">
          <div class="admin-two-col">
            <div>
              <div class="card mb-3">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Physical Checkup Form</div>
                  <span class="badge badge-indigo" style="cursor:default;">Checked by: ${user?.full_name || "Lab Tech"}</span>
                </div>
                <div class="mb-3">
                  <label class="text-xs text-muted mb-1" style="display:block;">Select Patient</label>
                  <input type="text" id="patientSearch" class="admin-filter" style="width:100%;" placeholder="Search patient name or portal ID (e.g. MRI-013)...">
                  <div id="patientList" class="lab-patient-select-list mt-2"></div>
                </div>
                <div class="lab-vitals-grid">
                  <div class="lab-vital-field">
                    <label class="lab-vital-label">BP Systolic (mmHg)</label>
                    <input type="number" id="bpSys" class="admin-filter" placeholder="120" min="60" max="250">
                  </div>
                  <div class="lab-vital-field">
                    <label class="lab-vital-label">BP Diastolic (mmHg)</label>
                    <input type="number" id="bpDia" class="admin-filter" placeholder="80" min="30" max="150">
                  </div>
                  <div class="lab-vital-field">
                    <label class="lab-vital-label">Heart Rate (BPM)</label>
                    <input type="number" id="heartRate" class="admin-filter" placeholder="72" min="30" max="220">
                  </div>
                  <div class="lab-vital-field">
                    <label class="lab-vital-label">SpO2 (%)</label>
                    <input type="number" id="spo2" class="admin-filter" placeholder="98" min="70" max="100">
                  </div>
                  <div class="lab-vital-field">
                    <label class="lab-vital-label">Temperature (°F)</label>
                    <input type="number" id="temperature" class="admin-filter" placeholder="98.6" step="0.1" min="95" max="110">
                  </div>
                </div>
                <div class="flex items-center gap-3 mt-4">
                  <button id="submitBtn" class="btn btn-emerald">Submit Vitals</button>
                  <span id="selectedBadge" class="text-xs text-muted">No patient selected</span>
                </div>
              </div>
            </div>
            <div>
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Recent Entries</div>
                  <span class="badge badge-blue" id="recentBadge">Last 24h</span>
                </div>
                <div id="recentVitals" class="loading">Loading...</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>`;

  container.querySelector("#logoutBtn").addEventListener("click", logout);
  loadPatients();
  loadRecentVitals();

  document.getElementById("patientSearch").addEventListener("input", (e) => {
    filterPatients(e.target.value);
  });

  document.getElementById("submitBtn").addEventListener("click", submitVitals);
}

// Patient object se accurate exact MRI portal ID resolve karne wala helper
function resolvePatientPortalId(p) {
  if (!p) return "—";

  // 1. Direct portal ID / MRI keys
  if (p.portal_id && String(p.portal_id).trim()) return String(p.portal_id).trim();
  if (p.portalId && String(p.portalId).trim()) return String(p.portalId).trim();
  if (p.patient_portal_id && String(p.patient_portal_id).trim()) return String(p.patient_portal_id).trim();
  if (p.mrn && String(p.mrn).trim()) return String(p.mrn).trim();
  if (p.mri_id && String(p.mri_id).trim()) return String(p.mri_id).trim();
  if (p.mri_number && String(p.mri_number).trim()) return String(p.mri_number).trim();

  // 2. Agar public string direct MRI se start hoti ho
  if (p.public_id && typeof p.public_id === "string" && p.public_id.toUpperCase().startsWith("MRI-")) {
    return p.public_id.toUpperCase();
  }

  // 3. Exact Patient Portal Format (MRI-013)
  const rawId = p.patient_id != null ? p.patient_id : p.id;
  if (rawId != null) {
    return `MRI-${String(rawId).padStart(3, "0")}`;
  }

  return "—";
}

async function loadPatients() {
  const { data } = await api.get("/api/patient/all-patients");
  if (!data?.ok || !Array.isArray(data.data)) return;
  allPatients = data.data.map(p => ({
    id: p.id,
    name: p.name || p.full_name || "Unknown Patient",
    portalId: resolvePatientPortalId(p)
  }));
  renderPatientList(allPatients);
}

function filterPatients(query) {
  const q = query.toLowerCase().trim();
  const filtered = q
    ? allPatients.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.portalId && p.portalId.toLowerCase().includes(q))
      )
    : allPatients;
  renderPatientList(filtered);
}

function renderPatientList(patients) {
  const el = document.getElementById("patientList");
  if (!patients.length) {
    el.innerHTML = `<div class="text-muted text-xs p-2">No patients found.</div>`;
    return;
  }
  el.innerHTML = patients.map(p => `
    <div class="lab-patient-select-row ${selectedPatientId === p.id ? "active" : ""}" data-id="${p.id}" data-name="${p.name}" data-portal-id="${p.portalId}">
      <div style="font-weight:600;font-size:0.875rem;">${p.name}</div>
      <div class="text-xs text-muted">Portal ID: <code style="color:#38bdf8;font-weight:600;">${p.portalId}</code></div>
    </div>`).join("");

  el.querySelectorAll(".lab-patient-select-row").forEach(row => {
    row.addEventListener("click", () => {
      selectedPatientId = parseInt(row.dataset.id);
      selectedPatientName = row.dataset.name;
      selectedPatientPortalId = row.dataset.portalId;
      el.querySelectorAll(".lab-patient-select-row").forEach(r => r.classList.remove("active"));
      row.classList.add("active");
      document.getElementById("selectedBadge").innerHTML = `Selected: <strong>${selectedPatientName}</strong> (<span style="color:#38bdf8;font-weight:600;">${selectedPatientPortalId}</span>)`;
      loadRecentVitals();
    });
  });
}

async function submitVitals() {
  if (!selectedPatientId) {
    alert("Please select a patient first.");
    return;
  }
  const bpSys = parseInt(document.getElementById("bpSys").value) || null;
  const bpDia = parseInt(document.getElementById("bpDia").value) || null;
  const hr = parseInt(document.getElementById("heartRate").value) || null;
  const spo2Val = parseInt(document.getElementById("spo2").value) || null;
  const temp = parseFloat(document.getElementById("temperature").value) || null;

  if (!bpSys && !bpDia && !hr && !spo2Val && !temp) {
    alert("Please enter at least one vital reading.");
    return;
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  const { data } = await api.post("/api/vitals/ingest", {
    patient_id: selectedPatientId,
    bp_systolic: bpSys,
    bp_diastolic: bpDia,
    heart_rate: hr,
    spo2: spo2Val,
    temperature_f: temp,
  });

  btn.disabled = false;
  btn.textContent = "Submit Vitals";

  if (data?.ok) {
    const r = data.data?.reading || {};
    alert(`Vitals recorded for ${selectedPatientName} (${selectedPatientPortalId}).\nAlert Level: ${r.alert_level || "NORMAL"}`);
    ["bpSys", "bpDia", "heartRate", "spo2", "temperature"].forEach(id => document.getElementById(id).value = "");
    loadRecentVitals();
  } else {
    alert(data?.error?.message || "Failed to submit vitals.");
  }
}

async function loadRecentVitals() {
  const el = document.getElementById("recentVitals");
  if (!el) return;

  if (!selectedPatientId) {
    el.innerHTML = `<div class="text-muted text-sm">Select a patient to see recent vitals.</div>`;
    return;
  }

  el.innerHTML = `<div class="loading text-xs">Loading vitals history...</div>`;

  try {
    const res = await api.get(`/api/vitals/patient/${selectedPatientId}/trend?hours=72`);
    const data = res?.data;

    if (!data || !data.ok) {
      el.innerHTML = `<div class="text-rose text-xs p-2">Error: ${data?.error?.message || "Failed to fetch vitals."}</div>`;
      return;
    }

    let readings = [];
    if (Array.isArray(data.data)) {
      readings = data.data;
    } else if (data.data && Array.isArray(data.data.readings)) {
      readings = data.data.readings;
    } else if (data.data && Array.isArray(data.data.trend)) {
      readings = data.data.trend;
    } else if (Array.isArray(data.readings)) {
      readings = data.readings;
    }

    if (!readings || readings.length === 0) {
      el.innerHTML = `<div class="text-muted text-sm">No recent vitals found for ${selectedPatientName} (${selectedPatientPortalId}).</div>`;
      return;
    }

    el.innerHTML = readings.slice().reverse().map(r => {
      const rawDate = r.recorded_at || r.created_at || r.timestamp;
      const d = rawDate ? new Date(rawDate) : null;
      const timeStr = d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "";
      const dateStr = d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Karachi" }) : "Recent";

      const bpStr = (r.bp_systolic != null && r.bp_diastolic != null) ? `${r.bp_systolic}/${r.bp_diastolic}` : "–";
      const checkedBy = r.checked_by_name || r.checked_by || "Lab Tech";
      const alertLvl = r.alert_level || "NORMAL";
      const alertClass = alertLvl === "CRITICAL" ? "badge-rose" : alertLvl === "WARNING" ? "badge-amber" : "badge-emerald";

      return `
        <div class="lab-vital-entry mb-2" style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.5rem;">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-muted">${dateStr} ${timeStr}</span>
            <span class="badge ${alertClass}">${alertLvl}</span>
          </div>
          <div class="lab-vital-vals text-xs flex gap-2 flex-wrap">
            <span>BP: <strong>${bpStr}</strong></span>
            <span>HR: <strong>${r.heart_rate ?? "–"}</strong></span>
            <span>SpO2: <strong>${r.spo2 ?? "–"}%</strong></span>
            <span>Temp: <strong>${r.temperature_f ?? "–"}°F</strong></span>
          </div>
          <div class="text-xs text-muted" style="margin-top:0.25rem;">Checked by: <strong>${checkedBy}</strong></div>
        </div>`;
    }).join("");

  } catch (err) {
    console.error("Vitals load error:", err);
    el.innerHTML = `<div class="text-rose text-xs">Failed to connect to vitals service.</div>`;
  }
}