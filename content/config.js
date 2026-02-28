// ── Hooked? — Shared Config ───────────────────────────────────────────────────
// Injected before content.js so its globals are available there.

const HOOKED_CONFIG = {
  urgencyKeywords: [
    'urgent', 'immediately', 'act now', 'limited time', 'expires today',
    'verify now', 'confirm now', 'account suspended', 'account locked',
    'unauthorized access', 'suspicious activity', 'security alert',
    'immediate action required', 'respond immediately', 'your account will be',
    'failure to verify', 'click here now',
  ],

  financialKeywords: [
    'password', 'credit card', 'social security', 'bank account',
    'verify your account', 'update your information', 'billing information',
    'payment required', 'invoice attached', 'claim your prize',
    'you have won', 'congratulations', 'ssn', 'cvv', 'pin number',
    'login credentials', 'sign in to verify',
  ],

  knownBrands: [
    'amazon.com', 'paypal.com', 'apple.com', 'google.com',
    'microsoft.com', 'bankofamerica.com',
  ],

  majorDomains: [
    'google.com', 'gmail.com', 'youtube.com', 'facebook.com', 'twitter.com',
    'x.com', 'instagram.com', 'linkedin.com', 'github.com', 'microsoft.com',
    'apple.com', 'amazon.com', 'paypal.com', 'reddit.com', 'wikipedia.org',
  ],

  scoring: {
    urgencyPerHit:       10,
    urgencyCap:          30,
    financialPerHit:     15,
    financialCap:        30,
    linkMismatchPerHit:  20,
    linkMismatchCap:     40,
    passwordForm:        25,
    brandImpersonation:  30,
  },

  thresholds: {
    suspicious: 30,
    phishing:   70,
  },
};
