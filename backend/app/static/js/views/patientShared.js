import { getUser, logout } from "../auth.js?v=3";

export function patientSidebar(activeRoute) {
  const user = getUser();
  const portalId = user?.portal_id || (user?.id ? `MRI-${String(user.id).padStart(3, "0")}` : "Unavailable");
  const nav = [
    { href: "#/patient-dashboard", label: "My Dashboard" },
    { href: "#/patient-book", label: "Book Appointment" },
    { href: "#/patient-appointments", label: "My Appointments" },
    { href: "#/patient-reports", label: "Lab Reports" },
    { href: "#/patient-vitals", label: "Vitals Monitor" },
    { href: "#/patient-reminders", label: "Reminders" },
    { href: "#/patient-queue", label: "Live Queue" },
  ];

  return `
    <aside class="sidebar">
      <div>
        <div class="sidebar-brand">
          <img class="sidebar-brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
          <div>
            <div class="sidebar-brand-title">MediSense AI</div>
            <div class="sidebar-brand-subtitle">Patient Portal</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${nav.map(n => `<a href="${n.href}" class="${n.href === activeRoute ? "active" : ""}">${n.label}</a>`).join("")}
        </nav>
      </div>
      <div class="sidebar-footer">
        <div class="flex items-center gap-3">
          <div class="user-avatar">PT</div>
          <div>
            <div class="user-name">${user?.full_name || "Patient"}</div>
            <div class="user-role">\u25cf Patient</div>
          </div>
        </div>
        <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
      </div>
    </aside>`;
}

export function patientPortalId() {
  const user = getUser();
  const portalId = user?.portal_id || (user?.id ? `MRI-${String(user.id).padStart(3, "0")}` : "");
  return portalId ? `<span class="badge badge-blue patient-portal-id" title="Your unique MediSense portal ID">ID: ${portalId}</span>` : "";
}

export function bindPatientLogout(container) {
  container.querySelector("#logoutBtn").addEventListener("click", logout);
}
