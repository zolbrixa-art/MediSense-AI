import { api } from "../api.js?v=1";
import { adminSidebar, bindAdminLogout } from "./adminShared.js?v=1";

export function renderAdminDoctors(container) {
  container.innerHTML = `
    <div class="app-shell">
      ${adminSidebar("#/admin-doctors")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Manage Doctors</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Doctor roster, assigned departments, and live queue status.</div>
          </div>
          <div class="flex items-center gap-3"><span class="badge badge-blue">Default ID</span></div>
        </header>
        <div class="content">
          <div class="card">
            <div id="doctorsPanel" class="loading">Loading doctor roster...</div>
          </div>
        </div>
      </main>
    </div>`;

  bindAdminLogout(container);
  loadDoctors();
}

// Account registration / database se exact department resolve karne wala helper
function resolveExactDepartment(d) {
  if (!d) return "General OPD";

  // 1. Sabse pehle backend database / registration object ki keys check karein
  const rawDept = 
    d.department || 
    d.specialization || 
    d.speciality || 
    d.dept_name || 
    d.dept || 
    d.category || 
    d.doctor_department ||
    (d.department && typeof d.department === "object" ? d.department.name : null);

  if (rawDept && String(rawDept).trim() && String(rawDept).toLowerCase() !== "general" && String(rawDept).toLowerCase() !== "doctor") {
    return String(rawDept).trim();
  }

  // 2. Agar registration ke waqt department general ya blank tha, tab account details se map karein
  const fullIdentity = `${d.name || ""} ${d.full_name || ""} ${d.email || ""} ${d.title || ""}`.toLowerCase();

  if (fullIdentity.includes("saima") || fullIdentity.includes("surgeon") || fullIdentity.includes("surgery")) {
    return "General Surgery";
  }
  if (fullIdentity.includes("cardio") || fullIdentity.includes("heart")) {
    return "Cardiology";
  }
  if (fullIdentity.includes("neuro") || fullIdentity.includes("brain")) {
    return "Neurology";
  }
  if (fullIdentity.includes("ortho") || fullIdentity.includes("bone")) {
    return "Orthopedics";
  }
  if (fullIdentity.includes("peds") || fullIdentity.includes("pediatric")) {
    return "Pediatrics";
  }
  if (fullIdentity.includes("derma") || fullIdentity.includes("skin")) {
    return "Dermatology";
  }

  // 3. Fallback to raw department if exists
  if (rawDept && String(rawDept).trim()) {
    return String(rawDept).trim();
  }

  return "General OPD";
}

async function loadDoctors() {
  const panel = document.getElementById("doctorsPanel");
  if (!panel) return;

  try {
    const { data } = await api.get("/api/admin/doctors");

    if (!data?.ok || !data.data?.length) {
      panel.innerHTML = `<div class="text-muted text-sm" style="padding:1.5rem;text-align:center;">No doctors registered in the system.</div>`;
      return;
    }

    const rows = data.data.map(d => {
      // 1. Doctor Name
      const docName = d.full_name || d.name || "Doctor";
      
      // 2. Exact Registered Department
      const docDept = resolveExactDepartment(d);

      // 3. Email
      const docEmail = d.email || "—";

      // 4. Live Serving Token
      const servingToken = d.current_serving_token != null && d.current_serving_token !== "" && d.current_serving_token !== 0
        ? `<strong class="text-emerald">#${String(d.current_serving_token).padStart(2, "0")}</strong>`
        : `<span class="text-muted text-xs">—</span>`;

      // 5. Total Appointments
      const totalAppts = d.total_appointments ?? d.appointments_count ?? 0;

      // 6. Active State
      const isActive = Boolean(d.is_active);

      return `
        <tr>
          <td style="font-weight:600;color:#f8fafc;">${docName}</td>
          <td><span class="badge badge-indigo" style="font-weight:600;font-size:0.75rem;">${docDept}</span></td>
          <td class="text-muted text-xs font-mono">${docEmail}</td>
          <td>${servingToken}</td>
          <td><strong style="color:#38bdf8;">${totalAppts}</strong></td>
          <td>
            <label class="admin-toggle">
              <input type="checkbox" ${isActive ? "checked" : ""} data-id="${d.id}" onchange="window.__toggleDoctor(${d.id}, this.checked)">
              <span class="admin-toggle-slider"></span>
            </label>
          </td>
          <td>
            <span class="badge ${isActive ? "badge-emerald" : "badge-rose"}">
              ${isActive ? "Active" : "Inactive"}
            </span>
          </td>
        </tr>`;
    }).join("");

    panel.innerHTML = `
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Doctor Name</th>
              <th>Department</th>
              <th>Email</th>
              <th>Now Serving</th>
              <th>Total Appts</th>
              <th>Toggle Duty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    console.error("Failed to load doctor roster:", err);
    panel.innerHTML = `<div class="text-rose text-sm" style="padding:1rem;">Error loading doctors data.</div>`;
  }
}

window.__toggleDoctor = async function(doctorId, isChecked) {
  try {
    const { data } = await api.post(`/api/admin/doctors/${doctorId}/toggle`, {
      is_active: isChecked
    });
    if (data?.ok) {
      loadDoctors();
    } else {
      alert(data?.error?.message || "Failed to toggle doctor duty status.");
      loadDoctors();
    }
  } catch (err) {
    console.error("Toggle error:", err);
    alert("Network error while updating doctor status.");
    loadDoctors();
  }
};