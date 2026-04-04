/**
 * SSRF Validation — blocks requests to private/internal networks.
 *
 * Validates webhook URLs and external requests to prevent
 * Server-Side Request Forgery (SSRF) attacks.
 *
 * Inspired by prompts.chat's SSRF validation pattern.
 */

export interface SSRFValidationResult {
  safe: boolean;
  reason?: string;
}

// Private & reserved IP ranges (RFC 1918, RFC 5737, RFC 6598, etc.)
const BLOCKED_IP_RANGES = [
  // Loopback
  /^127\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  // Private networks (RFC 1918)
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  // Link-local
  /^169\.254\./,
  /^fe80:/i,
  // Carrier-grade NAT (RFC 6598)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  // Documentation (RFC 5737)
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  // Benchmarking (RFC 2544)
  /^198\.1[89]\./,
  // Multicast & reserved
  /^2(2[4-9]|3\d)\./,
  /^2(4\d|5[0-5])\./,
  // IPv6 private
  /^fc/i,
  /^fd/i,
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254', // AWS/GCP metadata endpoint
  'metadata',
]);

// Blocked schemes
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * Validate a URL for SSRF safety.
 * Returns { safe: true } if the URL points to a public external host.
 */
export function validateURLForSSRF(url: string): SSRFValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  // Check scheme
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { safe: false, reason: `Blocked scheme: ${parsed.protocol}` };
  }

  // Check hostname
  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `Blocked hostname: ${hostname}` };
  }

  // Check if hostname is an IP address
  if (isIPAddress(hostname)) {
    const cleanIP = hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
    for (const range of BLOCKED_IP_RANGES) {
      if (range.test(cleanIP)) {
        return { safe: false, reason: `Blocked private IP: ${cleanIP}` };
      }
    }
  }

  // Check for DNS rebinding via numeric hostname tricks
  // e.g., 0x7f000001 = 127.0.0.1
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    return { safe: false, reason: 'Blocked numeric hostname (potential DNS rebinding)' };
  }

  // Check for localhost variants
  if (
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { safe: false, reason: `Blocked local domain: ${hostname}` };
  }

  // Block common cloud metadata endpoints
  if (hostname === '169.254.169.254' || hostname.includes('metadata')) {
    return { safe: false, reason: 'Blocked cloud metadata endpoint' };
  }

  // Check port — block common internal service ports
  const port = parsed.port ? Number.parseInt(parsed.port) : null;
  if (port !== null && (port === 0 || port > 65535)) {
    return { safe: false, reason: `Invalid port: ${port}` };
  }

  return { safe: true };
}

/**
 * Validate a webhook URL — stricter than general SSRF.
 * Requires HTTPS and a valid public hostname.
 */
export function validateWebhookURL(url: string): SSRFValidationResult {
  const base = validateURLForSSRF(url);
  if (!base.safe) return base;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }

  // Webhooks must be HTTPS
  if (parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Webhooks require HTTPS' };
  }

  // Must have a real domain (not just IP)
  if (isIPAddress(parsed.hostname)) {
    return { safe: false, reason: 'Webhooks must use domain names, not IP addresses' };
  }

  // Must have a TLD
  if (!parsed.hostname.includes('.')) {
    return { safe: false, reason: 'Webhooks require a fully qualified domain name' };
  }

  return { safe: true };
}

function isIPAddress(hostname: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  // IPv6 (with or without brackets)
  if (/^\[?[0-9a-f:]+\]?$/i.test(hostname)) return true;
  return false;
}
