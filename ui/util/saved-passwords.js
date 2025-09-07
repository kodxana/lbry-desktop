const { DOMAIN } = require('../../config.js');
const AUTH_TOKEN = 'auth_token';
const SAVED_PASSWORD = 'saved_password';
const domain =
  typeof window === 'object' && window.location.hostname && window.location.hostname.includes('localhost')
    ? window.location.hostname
    : DOMAIN;
const isProduction = process.env.NODE_ENV === 'production';
let sessionPassword;

function setCookie(name, value, expirationDaysOnWeb) {
  const parts = [];
  parts.push(`${name}=${value || ''}`);
  parts.push('path=/');

  // Persist cookies across app restarts.
  // - On web: honor provided days (if any); otherwise default to 365 days.
  // - On desktop (dev): use a long Max-Age as well since there's no server-controlled expiry.
  const maxAgeSeconds = (expirationDaysOnWeb ? expirationDaysOnWeb : 365) * 24 * 60 * 60;
  parts.push(`Max-Age=${maxAgeSeconds}`);

  // Determine context: https vs http vs file (Electron)
  let protocol = '';
  try {
    protocol = typeof window !== 'undefined' && window.location ? window.location.protocol : '';
  } catch (e) {}
  const isHttps = protocol === 'https:';

  if (isHttps) {
    // Over https, allow cross-site when needed
    parts.push('SameSite=None');
    parts.push('Secure');
    if (domain) parts.push(`domain=${domain}`);
  } else {
    // For http or file:// (Electron), avoid Secure and use Lax. Skip domain for host-only/file origins.
    parts.push('SameSite=Lax');
  }

  document.cookie = parts.join('; ');
}

function getCookie(name) {
  const nameEQ = name + '=';
  const cookies = document.cookie.split(';');

  for (var i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1, cookie.length);
    }

    if (cookie.indexOf(nameEQ) === 0) {
      return cookie.substring(nameEQ.length, cookie.length);
    }
  }
  return null;
}

function deleteCookie(name) {
  // Try deleting host-only cookie
  document.cookie = `${name}=; Max-Age=0; path=/;`;
  // And domain cookies, if any
  if (domain) {
    document.cookie = `${name}=; Max-Age=0; domain=${domain}; path=/;`;
    document.cookie = `${name}=; Max-Age=0; domain=.${domain}; path=/;`;
  }
}

function setSavedPassword(value, saveToDisk) {
  return new Promise((resolve) => {
    const password = value === undefined || value === null ? '' : value;
    sessionPassword = password;

    if (saveToDisk) {
      if (password) {
        // Persist via cookie (web) and localStorage (app/file://, dev http).
        try {
          setCookie(SAVED_PASSWORD, password, 14);
        } catch (e) {}
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(SAVED_PASSWORD, password);
          }
        } catch (e) {}
      } else {
        deleteSavedPassword();
      }
    }
    resolve();
  });
}

function getSavedPassword() {
  return new Promise((resolve) => {
    if (sessionPassword) {
      resolve(sessionPassword);
    }

    return getPasswordFromCookie().then((p) => resolve(p));
  });
}

function getPasswordFromCookie() {
  return new Promise((resolve) => {
    let password = null;
    try {
      password = getCookie(SAVED_PASSWORD);
    } catch (e) {}
    if (!password) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          password = window.localStorage.getItem(SAVED_PASSWORD);
        }
      } catch (e) {}
    }
    resolve(password);
  });
}

function deleteSavedPassword() {
  return new Promise((resolve) => {
    try {
      deleteCookie(SAVED_PASSWORD);
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(SAVED_PASSWORD);
      }
    } catch (e) {}
    resolve();
  });
}

function getAuthToken() {
  // Prefer cookie; fall back to localStorage for Electron/file:// contexts
  const fromCookie = getCookie(AUTH_TOKEN);
  if (fromCookie) return fromCookie;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(AUTH_TOKEN);
    }
  } catch (e) {}
  return null;
}

function setAuthToken(value) {
  // Store in cookie and localStorage so it persists reliably in Electron
  try {
    setCookie(AUTH_TOKEN, value, 365);
  } catch (e) {}
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (value) {
        window.localStorage.setItem(AUTH_TOKEN, value);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN);
      }
    }
  } catch (e) {}
  return value;
}

function deleteAuthToken() {
  return new Promise((resolve) => {
    deleteCookie(AUTH_TOKEN);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(AUTH_TOKEN);
      }
    } catch (e) {}
    resolve();
  });
}

function doSignOutCleanup() {
  return new Promise((resolve) => {
    deleteAuthToken();
    deleteSavedPassword();
    resolve();
  });
}

function doAuthTokenRefresh() {
  const authToken = getAuthToken();
  if (authToken) {
    deleteAuthToken();
    setAuthToken(authToken);
  }
}

module.exports = {
  setSavedPassword,
  getSavedPassword,
  getPasswordFromCookie,
  deleteSavedPassword,
  getAuthToken,
  setAuthToken,
  deleteAuthToken,
  doSignOutCleanup,
  doAuthTokenRefresh,
};
