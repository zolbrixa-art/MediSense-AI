const EMAIL_REGEX = /^[\w\.-]+@[\w\.-]+\.\w+$/;

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

export function getPortalId(user = getUser()) {
  if (user?.portal_id) return user.portal_id;
  if (!user?.id) return "";
  const prefix = user.role === "Patient" ? "MRI" : user.role === "Doctor" ? "DOC" : user.role === "LabTech" ? "LAB" : "USR";
  return `${prefix}-${String(user.id).padStart(3, "0")}`;
}

export function getToken() {
  return localStorage.getItem("access_token");
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function setSession(token, user) {
  localStorage.setItem("access_token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

export function getRoleDashboard(role) {
  switch (role) {
    case "Doctor": return "#/doctor-dashboard";
    case "Patient": return "#/patient-dashboard";
    case "LabTech": return "#/lab-dashboard";
    case "Admin": return "#/admin-dashboard";
    default: return "#/login";
  }
}

export function logout() {
  clearSession();
  window.location.href = "/login.html";
}

export function validateSignup({ full_name, email, password, confirmPassword, role }) {
  const errors = {};
  if (!full_name || full_name.trim().length < 2) errors.full_name = "Full name is required.";
  if (!email || !EMAIL_REGEX.test(email)) errors.email = "A valid email is required.";
  if (!password || password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = "Password must contain at least one letter and one digit.";
  }
  if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
  const validRoles = ["Patient", "Doctor", "Admin", "LabTech"];
  if (!validRoles.includes(role)) errors.role = "Please select a valid role.";
  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email || !EMAIL_REGEX.test(email)) errors.email = "A valid email is required.";
  if (!password) errors.password = "Password is required.";
  return errors;
}

export function requireRole(...roles) {
  const user = getUser();
  if (!user || !roles.includes(user.role)) {
    window.location.hash = "#/login";
    return false;
  }
  return true;
}
