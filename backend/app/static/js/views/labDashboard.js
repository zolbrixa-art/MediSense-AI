import { api } from "../api.js?v=1";
import { getUser, getPortalId, logout } from "../auth.js?v=1";

let dashboardTimer = null;

function formatPatientMriId(scan) {
  const rawId = scan.patient_portal_id || scan.portal_id || scan.patient_id;
  const match = String(rawId || "").match(/^(?:MRI[-_ ]?)?(\d+)$/i);
  return match ? `MRI-${String(match[1]).padStart(3, "0")}` : "—";
}

export function renderLabDashboard(container) {
  // Purana koi interval chal raha ho to pehle clear karein
  if (dashboardTimer) {
    clearInterval(dashboardTimer);
    dashboardTimer = null;
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
                <div class="sidebar-brand-subtitle">Lab Technician</div>
              </div>
          </div>
          <nav class="sidebar-nav">
            <a href="#/lab-dashboard" class="active">Dashboard</a>
            <a href="#/lab-pending">Pending Orders</a>
            <a href="#/lab">Upload Scan</a>
            <a href="#/lab-overview">Scan Overview</a>
            <a href="#/lab-vitals">Vitals</a>
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
                <div class="user-role">\u25cf Lab Online</div>
            </div>
          </div>
          <button id="logoutBtn" class="sidebar-logout-btn">Logout</button>
        </div>
      </aside>
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Lab Technician Dashboard</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Manage tests, scans and AI-assisted laboratory analysis.</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-muted">Auto-refresh every 15s</span>
            <span class="badge badge-blue" title="Your unique MediSense portal ID">ID: ${portalId}</span>
          </div>
        </header>
        <div class="content">

          <!-- 6 Stat Cards -->
          <div id="labStatsGrid" class="dashboard-grid lab-stats-grid">
            <div class="dash-card"><div class="dash-card-label">Loading...</div></div>
          </div>

          <!-- Quick Actions -->
          <div class="lab-section">
            <div class="lab-section-title">Quick Actions</div>
            <div class="lab-quick-actions">
              <a href="#/lab" class="lab-qa-card lab-qa-primary">
                <div class="lab-qa-icon">\u2B06\uFE0F</div>
                <div class="lab-qa-label">Upload New Scan</div>
              </a>
              <a href="#/lab-pending" class="lab-qa-card">
                <div class="lab-qa-icon">\uD83D\uDCCB</div>
                <div class="lab-qa-label">Pending Orders</div>
              </a>
              <a href="#/lab-lookup" class="lab-qa-card">
                <div class="lab-qa-icon">\uD83D\uDD0D</div>
                <div class="lab-qa-label">Patient Lookup</div>
              </a>
              <a href="#/lab-history" class="lab-qa-card">
                <div class="lab-qa-icon">\uD83D\uDCC1</div>
                <div class="lab-qa-label">Scan History</div>
              </a>
            </div>
          </div>

          <!-- Recent Scans Table + AI Overview side by side -->
          <div class="lab-two-col">
            <div class="lab-col-main">
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Recent Test Orders</div>
                  <span class="badge badge-blue">Live Feed</span>
                </div>
                <div id="recentScansTable" class="loading">Loading recent scans...</div>
              </div>
            </div>
            <div class="lab-col-side">
              <!-- AI Analysis Overview -->
              <div class="card">
                <div class="flex items-center gap-2 mb-3">
                  <div class="card-title" style="margin:0;">AI Analysis Today</div>
                  <span class="badge badge-indigo">AI-Assisted</span>
                </div>
                <div id="aiOverviewPanel" class="loading">Loading...</div>
              </div>

              <!-- Urgent Cases -->
              <div class="card lab-urgent-card">
                <div class="flex items-center gap-2 mb-3">
                  <div class="card-title" style="margin:0;">Urgent Attention Required</div>
                  <span class="badge badge-rose">STAT</span>
                </div>
                <div id="urgentCasesPanel" class="loading">Loading...</div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  `;

  container.querySelector("#logoutBtn")?.addEventListener("click", logout);

  loadAll();
  dashboardTimer = setInterval(loadAll, 15000);
}

async function loadAll() {
  // Agar user kisi doosre page par chala jaye to auto-refresh band ho jaye
  const grid = document.getElementById("labStatsGrid");
  if (!grid) {
    if (dashboardTimer) {
      clearInterval(dashboardTimer);
      dashboardTimer = null;
    }
    return;
  }

  loadStats();
  loadRecentScans();
}

// ─── Stat Cards ────────────────────────────────────────────────

async function loadStats() {
  const grid = document.getElementById("labStatsGrid");
  if (!grid) return; // ✅ Safe Check

  const { data } = await api.get("/api/imaging/lab-stats");
  if (!data?.ok) {
    if (grid) grid.innerHTML = `<div class="text-muted">${data?.error?.message || "Unable to load stats."}</div>`;
    return;
  }
  const s = data.data || {};

  const cards = [
    { label: "Pending Test Orders", value: s.pending_orders ?? 0, sub: "Awaiting specimen/scan collection", icon: "\uD83E\uDDEA", accent: "amber" },
    { label: "Emergency / STAT Orders", value: String(s.stat_orders ?? 0).padStart(2, "0"), sub: "High-priority immediate processing", icon: "\u26A0\uFE0F", accent: "rose" },
    { label: "Scans Processed Today", value: s.scans_today ?? 0, sub: "Uploaded & finalized today", icon: "\uD83D\uDCBE", accent: "blue" },
    { label: "AI Flagged Anomalies", value: String(s.ai_flagged ?? 0).padStart(2, "0"), sub: "AI detected suspicious regions", icon: "\uD83E\uDDE0", accent: "indigo" },
    { label: "AI Cleared / Normal", value: s.ai_cleared ?? 0, sub: "No suspicious findings detected", icon: "\u2705", accent: "emerald" },
    { label: "Avg. Turnaround Time", value: s.avg_turnaround_min > 0 ? `${s.avg_turnaround_min} min` : "—", sub: "Order-to-doctor transmission speed", icon: "\u23F1\uFE0F", accent: "blue" },
  ];

  if (grid) {
    grid.innerHTML = cards.map(c => `
      <div class="dash-card dash-card-${c.accent}">
        <div class="dash-card-icon">${c.icon}</div>
        <div class="dash-card-value">${c.value}</div>
        <div class="dash-card-label">${c.label}</div>
        <div class="dash-card-sub">${c.sub}</div>
      </div>
    `).join("");
  }

  updateAiOverview(s);
  updateUrgentCases(s);
}

// ─── Recent Scans Table ────────────────────────────────────────

async function loadRecentScans() {
  const panel = document.getElementById("recentScansTable");
  if (!panel) return; // ✅ Safe Check

  const { data } = await api.get("/api/imaging/recent-scans?limit=15");
  if (!panel) return;

  if (!data?.ok || !data.data?.length) {
    panel.innerHTML = `<div class="text-muted">No scans uploaded yet.</div>`;
    return;
  }

  const rows = data.data.map(s => {
    const d = new Date(s.uploaded_at);
    const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" });

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
        <td>${aiBadge}</td>
        <td>${s.confidence_score != null ? s.confidence_score + "%" : "\u2014"}</td>
        <td class="text-muted">${dateStr} \u00b7 ${timeStr}</td>
      </tr>`;
  }).join("");

  panel.innerHTML = `
    <div class="table-scroll">
      <table class="table">
        <thead><tr>
          <th>Patient MRI ID</th><th>Patient</th><th>Type</th><th>AI Status</th><th>Conf.</th><th>Uploaded</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── AI Analysis Overview Panel ────────────────────────────────

function updateAiOverview(s) {
  const panel = document.getElementById("aiOverviewPanel");
  if (!panel) return; // ✅ Safe Check

  const total = s.scans_today || 0;
  const flagged = s.ai_flagged || 0;
  const cleared = s.ai_cleared || 0;
  const awaiting = s.awaiting_analysis || 0;

  const pctFlagged = total > 0 ? Math.round((flagged / total) * 100) : 0;
  const pctCleared = total > 0 ? Math.round((cleared / total) * 100) : 0;

  panel.innerHTML = `
    <div class="lab-ai-stats">
      <div class="lab-ai-stat">
        <div class="lab-ai-stat-value">${total}</div>
        <div class="lab-ai-stat-label">Total Analyzed</div>
      </div>
      <div class="lab-ai-stat">
        <div class="lab-ai-stat-value text-rose">${String(flagged).padStart(2, "0")}</div>
        <div class="lab-ai-stat-label">Flagged</div>
      </div>
      <div class="lab-ai-stat">
        <div class="lab-ai-stat-value text-emerald">${cleared}</div>
        <div class="lab-ai-stat-label">Normal</div>
      </div>
      <div class="lab-ai-stat">
        <div class="lab-ai-stat-value text-amber">${awaiting}</div>
        <div class="lab-ai-stat-label">Awaiting</div>
      </div>
    </div>
    ${total > 0 ? `
    <div class="lab-ai-bar-wrapper">
      <div class="lab-ai-bar">
        <div class="lab-ai-bar-flagged" style="width:${pctFlagged}%"></div>
        <div class="lab-ai-bar-cleared" style="width:${pctCleared}%"></div>
      </div>
      <div class="flex justify-between text-xs text-muted" style="margin-top:0.375rem;">
        <span>Flagged ${pctFlagged}%</span>
        <span>Cleared ${pctCleared}%</span>
      </div>
    </div>
    <p class="text-xs text-muted" style="margin-top:0.75rem;font-style:italic;">
      * AI analysis is for clinical decision support only. All findings require physician validation.
    </p>` : `<div class="text-muted text-sm" style="margin-top:0.5rem;">No scans processed today yet.</div>`}
  `;
}

// ─── Urgent Cases Panel ────────────────────────────────────────

function updateUrgentCases(s) {
  const panel = document.getElementById("urgentCasesPanel");
  if (!panel) return; // ✅ Safe Check

  if (!s.stat_orders || s.stat_orders === 0) {
    panel.innerHTML = `
      <div class="lab-urgent-empty">
        <div style="font-size:1.25rem;margin-bottom:0.25rem;">\u2705</div>
        <div class="text-sm">No urgent cases at the moment.</div>
        <div class="text-xs text-muted">All STAT orders have been processed.</div>
      </div>`;
    return;
  }
  panel.innerHTML = `
    <div class="lab-urgent-item">
      <div class="flex items-center justify-between mb-2">
        <span class="badge badge-rose">STAT Priority</span>
        <span class="text-xs text-muted">${s.stat_orders} active</span>
      </div>
      <div class="text-sm">Active consultation(s) requiring scan processing.</div>
      <div style="margin-top:1.25rem;"><a href="#/lab" class="btn btn-blue btn-sm" style="text-decoration:none;">Process Now</a></div>
    </div>`;
}