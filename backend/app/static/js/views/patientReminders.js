import { api } from "../api.js?v=1";
import { patientSidebar, patientPortalId, bindPatientLogout } from "./patientShared.js?v=2";

export function renderPatientReminders(container) {
  container.innerHTML = `
    <div class="app-shell">
      ${patientSidebar("#/patient-reminders")}
      <main class="main">
        <header class="top-header">
          <div>
            <div class="page-title">Reminders & Alerts</div>
            <div class="text-xs text-muted" style="margin-top:0.25rem;">Medicine schedule, appointment alerts and hospital notifications.</div>
          </div>
          <div class="flex items-center gap-2">
            ${patientPortalId()}
          </div>
        </header>
        <div class="content">
          <div class="admin-two-col">
            <div>
              <div class="card mb-3">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Medicine Schedule</div>
                  <span class="badge badge-indigo" id="rxReminderBadge">–</span>
                </div>
                <div id="medicinePanel">Loading...</div>
              </div>
              <div class="card">
                <div class="flex items-center justify-between mb-3">
                  <div class="card-title" style="margin:0;">Hospital Arrival Alerts</div>
                  <span class="badge badge-amber" id="apptReminderBadge">–</span>
                </div>
                <div id="arrivalPanel">Loading...</div>
              </div>
            </div>
            <div>
              <div class="card">
                <div class="card-title" style="margin:0 0 1.25rem 0;">Daily Medicine Times</div>
                <div class="pt-medicine-schedule" style="margin-top:1rem; display:flex; flex-direction:column; gap:1rem;">
                  <div class="pt-medicine-time">
                    <div class="pt-medicine-time-label"> Morning</div>
                    <div class="text-xs text-muted">08:00 AM</div>
                    <div id="morningMeds" class="pt-medicine-list">–</div>
                  </div>
                  <div class="pt-medicine-time">
                    <div class="pt-medicine-time-label"> Afternoon</div>
                    <div class="text-xs text-muted">02:00 PM</div>
                    <div id="afternoonMeds" class="pt-medicine-list">–</div>
                  </div>
                  <div class="pt-medicine-time">
                    <div class="pt-medicine-time-label"> Night</div>
                    <div class="text-xs text-muted">09:00 PM</div>
                    <div id="nightMeds" class="pt-medicine-list">–</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>`;

  bindPatientLogout(container);
  loadReminders();
}

async function loadReminders() {
  const { data } = await api.get("/api/patient/reminders");
  if (!data?.ok) return;

  const all = data.data || [];
  const meds = all.filter(r => r.type === "medicine");
  const appts = all.filter(r => r.type === "appointment");

  const rxBadge = document.getElementById("rxReminderBadge");
  const apptBadge = document.getElementById("apptReminderBadge");
  if (rxBadge) rxBadge.textContent = meds.length;
  if (apptBadge) apptBadge.textContent = appts.length;

  // Medicine reminders
  const medEl = document.getElementById("medicinePanel");
  if (medEl) {
    medEl.innerHTML = meds.length
      ? meds.map(r => `
          <div class="pt-reminder-item">
            <div class="pt-reminder-icon">💊</div>
            <div>
              <div class="pt-reminder-title">${r.title}</div>
              <div class="pt-reminder-body">${r.body}</div>
            </div>
          </div>`).join("")
      : `<div class="text-muted text-sm">No active medicine reminders.</div>`;
  }

  // Arrival reminders
  const arrEl = document.getElementById("arrivalPanel");
  if (arrEl) {
    arrEl.innerHTML = appts.length
      ? appts.map(r => {
          const d = r.scheduled_time ? new Date(r.scheduled_time) : null;
          const ds = d ? d.toLocaleDateString("en-GB", { weekday:"long", day:"2-digit", month:"short", timeZone:"Asia/Karachi" }) : "–";
          const ts = d ? d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true, timeZone:"Asia/Karachi" }) : "";
          return `
            <div class="pt-reminder-item pt-reminder-high">
              <div class="pt-reminder-icon"></div>
              <div>
                <div class="pt-reminder-title">${r.title}</div>
                <div class="pt-reminder-body">${r.body}</div>
                <div class="text-xs text-muted mt-1">${ds}${ts ? " · " + ts : ""}</div>
              </div>
            </div>`;
        }).join("")
      : `<div class="text-muted text-sm">No upcoming appointments.</div>`;
  }

  // Slot medicines into morning / afternoon / night based on frequency keyword
  const morning = [], afternoon = [], night = [];
  meds.forEach(r => {
    const freq = (r.body || "").toLowerCase();
    if (freq.includes("morning") || freq.includes("every 6") || freq.includes("3 times") || freq.includes("tid")) morning.push(r);
    if (freq.includes("afternoon") || freq.includes("every 6") || freq.includes("3 times") || freq.includes("tid") || freq.includes("twice") || freq.includes("bid")) afternoon.push(r);
    if (freq.includes("night") || freq.includes("bedtime") || freq.includes("every 6") || freq.includes("3 times") || freq.includes("tid") || freq.includes("once daily") || freq.includes("od")) night.push(r);
    if (!morning.length && !afternoon.length && !night.length) morning.push(r);
  });

  const renderSlot = (slot) => slot.length
    ? slot.map(r => `<div class="pt-med-pill">💊 ${r.title.replace("Take ", "")}</div>`).join("")
    : `<div class="text-muted text-xs">None</div>`;

  const mEl = document.getElementById("morningMeds");
  const aEl = document.getElementById("afternoonMeds");
  const nEl = document.getElementById("nightMeds");

  if (mEl) mEl.innerHTML = renderSlot(morning);
  if (aEl) aEl.innerHTML = renderSlot(afternoon);
  if (nEl) nEl.innerHTML = renderSlot(night);
}