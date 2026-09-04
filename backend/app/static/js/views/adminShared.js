import { getUser, logout } from "../auth.js?v=1";

export function adminSidebar(activeRoute) {
  const user = getUser();
  const nav = [
    { href: "#/admin-dashboard", label: "Dashboard" },
    { href: "#/admin-doctors", label: "Manage Doctors" },
    { href: "#/admin-queue", label: "Live Queue Monitor" },
    { href: "#/admin-appointments", label: "All Appointments" },
    { href: "#/admin-departments", label: "Departments" },
    { href: "#/admin-audit", label: "Audit Logs" },
  ];

  return `
    <aside class="sidebar">
      <div>
        <div class="sidebar-brand">
          <img class="sidebar-brand-icon" src="/assets/medisense-mark.png" alt="MediSense AI">
          <div>
            <div class="sidebar-brand-title">MediSense AI</div>
            <div class="sidebar-brand-subtitle">Hospital Administration</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${nav.map(n => `<a href="${n.href}" class="${n.href === activeRoute ? "active" : ""}">${n.label}</a>`).join("")}
        </nav>
      </div>
      <div class="sidebar-footer">
        <div class="flex items-center gap-3">
          <div class="user-avatar">AD</div>
          <div>
            <div class="user-name">${user?.full_name || "Admin"}</div>
            <div class="user-role">\u25cf Admin Online</div>
          </div>
        </div>
        <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
      </div>
    </aside>`;
}

export function bindAdminLogout(container) {
  container.querySelector("#logoutBtn").addEventListener("click", logout);
}
