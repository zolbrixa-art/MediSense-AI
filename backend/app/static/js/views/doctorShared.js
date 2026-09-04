import { getUser, logout } from "../auth.js?v=1";

export function doctorSidebar(activeRoute) {
  const user = getUser() || {};
  const links = [
    { href: "#/doctor-dashboard", label: "Dashboard" },
    { href: "#/doctor", label: "Console Overview" },
    { href: "#/lab", label: "Upload Scan" },
    { href: "#/queue", label: "OPD Live Queue" },
  ];

  return `
    <aside class="sidebar">
      <div>
        <div class="sidebar-brand">
          <img class="sidebar-brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
          <div>
            <div class="sidebar-brand-title">MediSense AI</div>
            <div class="sidebar-brand-subtitle">Clinical Decision Support</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${links.map((link) => `<a href="${link.href}"${link.href === activeRoute ? ' class="active"' : ""}>${link.label}</a>`).join("")}
        </nav>
      </div>
      <div class="sidebar-footer">
        <div class="flex items-center gap-3">
          <div class="user-avatar">DR</div>
          <div>
            <div class="user-name">${user.full_name || "Doctor"}</div>
            <div class="user-role">● OPD Online</div>
          </div>
        </div>
        <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
      </div>
    </aside>
  `;
}

export function bindDoctorLogout(container) {
  container.querySelector("#logoutBtn")?.addEventListener("click", logout);
}
