# Angular Frontend Migration Notes

## Why a vanilla SPA was used

Node.js / npm are not installed in the current environment, so an Angular workspace could not be created, installed, built, or verified. To deliver a runnable full-stack integration in one session, the existing Angular cockpit template was ported to a vanilla ES-module SPA served directly by Flask.

## What was ported

The markup and styling from `docs/04-cockpit-template-reference.html` (originally `gemini-code-1787986262529.html`) were translated into:

- `backend/app/static/css/cockpit.css` — CSS-variable design system matching the slate-950 / slate-900 dark clinical theme.
- `backend/app/static/js/views/doctorCockpit.js` — dynamic vitals tiles, scan canvas, and Qwen summary card.

The standalone signup/login pages (`signup.html`, `login.html`) reuse the same split-screen CSS and connect to the Flask backend.

## Migration checklist to Angular 17+

1. **Scaffold workspace:**
   ```bash
   npm install -g @angular/cli
   ng new medisense-frontend --routing --style=scss
   ```

2. **Install dependencies:**
   - Tailwind CSS
   - Angular JWT helper (e.g., `@auth0/angular-jwt` or a custom interceptor)
   - Reactive Forms

3. **Component mapping (1:1 with current SPA views):**
   | Current file | Angular component |
   |---|---|
   | `js/views/signup.js` | `SignupComponent` |
   | `js/views/login.js` | `LoginComponent` |
   | `js/views/doctorCockpit.js` | `DoctorCockpitComponent` |
   | `js/views/patientPortal.js` | `PatientPortalComponent` |
   | `js/views/queueBoard.js` | `QueueBoardComponent` |
   | `js/views/labTech.js` | `LabTechComponent` |

4. **Services to create:**
   - `AuthService` — wraps `/api/auth/*`, JWT storage, role guards.
   - `AppointmentsService` — wraps `/api/appointments/*`.
   - `EmrService` — wraps `/api/emr/*`.
   - `ImagingService` — wraps `/api/imaging/*`.
   - `VitalsService` — wraps `/api/vitals/*`.
   - `AiEngineService` — wraps `/api/ai/*`.

5. **Routing:**
   - `/login` → `LoginComponent`
   - `/signup` → `SignupComponent`
   - `/doctor` → `DoctorCockpitComponent` (Doctor guard)
   - `/patient` → `PatientPortalComponent` (Patient guard)
   - `/queue` → `QueueBoardComponent` (Patient/Doctor/Admin guard)
   - `/lab` → `LabTechComponent` (LabTech/Doctor/Admin guard)

6. **Tailwind config:** port the CSS variables from `cockpit.css` into `tailwind.config.js` colors.

7. **Backend CORS:** Flask-CORS is already enabled for `/api/*`; no changes required.
