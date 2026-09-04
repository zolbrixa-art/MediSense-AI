import { api } from "../api.js?v=1";
import { getUser } from "../auth.js?v=3";
import { patientSidebar, patientPortalId, bindPatientLogout } from "./patientShared.js?v=2";

export function renderPatientVitals(container) {
  const user = getUser();
  container.innerHTML = `
    <div class="app-shell">
      ${patientSidebar("#/patient-vitals")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Vitals Monitor</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Historical trends and real-time wearable data.</div>
          </div>
          <div class="flex items-center gap-3">
            <select id="daysFilter" class="admin-filter">
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
            ${patientPortalId()}
          </div>
        </header>
        <div class="content">
          <div id="vitalCards" class="dashboard-grid admin-stats-grid mb-4"></div>
          <div class="admin-two-col">
            <div>
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Heart Rate Trend</div>
                  <span class="badge badge-rose">BPM</span>
                </div>
                <div id="hrChart" class="pt-chart-wrap"></div>
              </div>
              <div class="card mt-3">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">SpO2 Trend</div>
                  <span class="badge badge-blue">%</span>
                </div>
                <div id="spo2Chart" class="pt-chart-wrap"></div>
              </div>
            </div>
            <div>
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Spike Alerts</div>
                  <span id="alertBadge" class="badge badge-rose">0</span>
                </div>
                <div id="alertsList">Loading...</div>
              </div>
              <div class="card mt-3">
                <div class="card-title mb-2" style="margin:0;">Wearable Status</div>
                <div class="pt-wearable-row">
                  <div class="pt-wearable-dot active"></div>
                  <div>
                    <div style="font-weight:600;font-size:0.875rem;">MediSense Telemetry</div>
                    <div class="text-xs text-muted">Streaming vitals via backend sensor API</div>
                  </div>
                  <span class="badge badge-emerald">Connected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>`;

  bindPatientLogout(container);
  const daysEl = document.getElementById("daysFilter");
  loadVitals(user.id, parseInt(daysEl.value));
  daysEl.addEventListener("change", () => loadVitals(user.id, parseInt(daysEl.value)));
}

async function loadVitals(patientId, days) {
  const { data } = await api.get(`/api/patient/vitals-trend?days=${days}`);
  if (!data.ok) return;
  const readings = data.data.readings;
  const alerts = data.data.alerts;

  // Latest reading for stat cards
  const latest = readings.length ? readings[readings.length - 1] : null;
  const cards = document.getElementById("vitalCards");
  if (latest) {
    const lvl = latest.alert_level;
    const accent = lvl === "CRITICAL" ? "rose" : lvl === "WARNING" ? "amber" : "emerald";
    cards.innerHTML = [
      { label: "Heart Rate", value: `${latest.heart_rate ?? "–"} BPM`, icon: "❤️", accent },
      { label: "SpO2", value: `${latest.spo2 ?? "–"}%`, icon: "🫁", accent: latest.spo2 < 92 ? "rose" : "emerald" },
      { label: "Temperature", value: `${latest.temperature_f ?? "–"}°F`, icon: "🌡️", accent: latest.temperature_f >= 100.4 ? "amber" : "emerald" },
      { label: "Alert Level", value: lvl, icon: "⚡", accent },
      { label: "Readings (${days}d)", value: readings.length, icon: "📊", accent: "blue" },
      { label: "Alerts", value: alerts.length, icon: "🚨", accent: alerts.length > 0 ? "rose" : "emerald" },
    ].map(c => `<div class="dash-card dash-card-${c.accent}">
      <div class="dash-card-icon">${c.icon}</div>
      <div class="dash-card-value">${c.value}</div>
      <div class="dash-card-label">${c.label}</div>
    </div>`).join("");
  }

  // Mini sparkline charts (SVG-based)
  renderSparkline("hrChart", readings.map(r => r.heart_rate), "#f43f5e", 40, 180, "No heart rate data");
  renderSparkline("spo2Chart", readings.map(r => r.spo2), "#2563eb", 80, 100, "No SpO2 data");

  // Alerts list
  const alertsEl = document.getElementById("alertsList");
  const alertBadge = document.getElementById("alertBadge");
  alertBadge.textContent = alerts.length;
  if (alerts.length) {
    alertsEl.innerHTML = alerts.map(a => {
      const d = new Date(a.recorded_at);
      const ds = d.toLocaleDateString("en-GB", { weekday:"short", day:"2-digit", month:"short", timeZone:"Asia/Karachi" });
      const ts = d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true, timeZone:"Asia/Karachi" });
      const reasons = (a.alert_reasons || []).join(", ") || "General alert";
      return `<div class="pt-alert-item ${a.alert_level === "CRITICAL" ? "pt-alert-critical" : "pt-alert-warning"}">
        <div class="pt-alert-icon">${a.alert_level === "CRITICAL" ? "🚨" : "⚠️"}</div>
        <div>
          <div class="pt-alert-title">${a.alert_level}: ${reasons}</div>
          <div class="text-xs text-muted">${ds} · ${ts}</div>
          <div class="text-xs text-muted">HR: ${a.heart_rate ?? "–"} · SpO2: ${a.spo2 ?? "–"}% · Temp: ${a.temperature_f ?? "–"}°F</div>
        </div>
      </div>`;
    }).join("");
  } else {
    alertsEl.innerHTML = `<div class="text-muted text-sm"> No abnormal readings in the last ${days} days.</div>`;
  }
}

function renderSparkline(id, values, color, yMin, yMax, emptyMsg) {
  const el = document.getElementById(id);
  if (!values.length || values.every(v => v == null)) {
    el.innerHTML = `<div class="text-muted text-sm" style="padding:1rem;">${emptyMsg}</div>`;
    return;
  }
  const valid = values.filter(v => v != null);
  const w = 400, h = 80, pad = 12;
  const range = yMax - yMin || 1;

  if (valid.length === 1) {
    const v = valid[0];
    const y = h - pad - Math.max(0, Math.min(1, (v - yMin) / range)) * (h - pad * 2);
    el.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:5rem;" preserveAspectRatio="none">
        <line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="${color}" stroke-width="3" stroke-dasharray="6,4"/>
        <circle cx="${w / 2}" cy="${y}" r="5" fill="${color}"/>
      </svg>
      <div class="flex items-center justify-between pt-chart-labels">
        <span class="text-xs text-muted">Latest Reading: ${v}</span>
      </div>`;
    return;
  }

  const xStep = (w - pad * 2) / (valid.length - 1);
  const pts = valid.map((v, i) => {
    const x = pad + i * xStep;
    const clampedV = Math.max(yMin, Math.min(yMax, v));
    const y = h - pad - ((clampedV - yMin) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");

  const firstPt = `${pad},${h}`;
  const lastPt = `${w - pad},${h}`;

  el.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:5rem;" preserveAspectRatio="none">
      <polyline points="${firstPt} ${pts} ${lastPt}" fill="${color}" fill-opacity="0.12" stroke="none"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
    <div class="flex items-center justify-between pt-chart-labels">
      <span class="text-xs text-muted">Min: ${Math.min(...valid)}</span>
      <span class="text-xs text-muted">Avg: ${Math.round(valid.reduce((a,b)=>a+b,0)/valid.length)}</span>
      <span class="text-xs text-muted">Max: ${Math.max(...valid)}</span>
    </div>`;
}
