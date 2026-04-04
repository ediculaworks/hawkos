/**
 * Secret Redactor — 51+ regex patterns to strip API keys, tokens, and secrets
 * from text before sending to LLM context.
 *
 * Inspired by Hermes Agent's 51-pattern redaction system.
 * Prevents accidental leakage of credentials in LLM conversations.
 */

const REDACTED = '[REDACTED]';

interface RedactionPattern {
  name: string;
  pattern: RegExp;
}

// ── Pattern Definitions ──────────────────────────────────────────────────────

const PATTERNS: RedactionPattern[] = [
  // ── API Keys & Tokens ───────────────────────────────────────────────
  { name: 'openai_api_key', pattern: /sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}/g },
  { name: 'openai_api_key_v2', pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{40,}/g },
  { name: 'anthropic_api_key', pattern: /sk-ant-[A-Za-z0-9_-]{40,}/g },
  { name: 'openrouter_api_key', pattern: /sk-or-v1-[A-Za-z0-9]{48,}/g },
  { name: 'google_api_key', pattern: /AIza[A-Za-z0-9_-]{35}/g },
  { name: 'google_oauth_token', pattern: /ya29\.[A-Za-z0-9_-]{50,}/g },
  { name: 'github_pat', pattern: /ghp_[A-Za-z0-9]{36,}/g },
  { name: 'github_oauth', pattern: /gho_[A-Za-z0-9]{36,}/g },
  { name: 'github_app_token', pattern: /(?:ghu|ghs|ghr)_[A-Za-z0-9]{36,}/g },
  { name: 'gitlab_pat', pattern: /glpat-[A-Za-z0-9_-]{20,}/g },
  { name: 'gitlab_runner', pattern: /GR1348941[A-Za-z0-9_-]{20,}/g },

  // ── Cloud Providers ─────────────────────────────────────────────────
  { name: 'aws_access_key', pattern: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g },
  {
    name: 'aws_secret_key',
    pattern: /(?:aws_secret_access_key|aws_secret)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi,
  },
  {
    name: 'aws_session_token',
    pattern: /(?:aws_session_token)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{100,}['"]?/gi,
  },
  {
    name: 'azure_storage_key',
    pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}/g,
  },
  { name: 'azure_ad_token', pattern: /eyJ0eXAiOiJKV1QiLCJhbGciOi[A-Za-z0-9_-]{100,}/g },
  {
    name: 'gcp_service_account',
    pattern: /"private_key"\s*:\s*"-----BEGIN (?:RSA )?PRIVATE KEY-----[^"]+"/g,
  },

  // ── Database & Storage ──────────────────────────────────────────────
  { name: 'postgres_uri', pattern: /postgres(?:ql)?:\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/g },
  { name: 'mysql_uri', pattern: /mysql:\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/g },
  { name: 'mongodb_uri', pattern: /mongodb(?:\+srv)?:\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/g },
  { name: 'redis_uri', pattern: /redis(?:s)?:\/\/[^\s'"]*:[^\s'"]+@[^\s'"]+/g },
  {
    name: 'supabase_key',
    pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,}/g,
  },

  // ── Messaging & Communication ───────────────────────────────────────
  { name: 'slack_token', pattern: /xox[bpors]-[A-Za-z0-9-]{10,}/g },
  {
    name: 'slack_webhook',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g,
  },
  { name: 'discord_token', pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27,}/g },
  {
    name: 'discord_webhook',
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g,
  },
  { name: 'telegram_token', pattern: /\d{8,10}:[A-Za-z0-9_-]{35}/g },
  { name: 'twilio_sid', pattern: /AC[a-f0-9]{32}/g },
  {
    name: 'twilio_auth',
    pattern: /(?:twilio_auth_token|TWILIO_AUTH)\s*[=:]\s*['"]?[a-f0-9]{32}['"]?/gi,
  },

  // ── Payment Providers ───────────────────────────────────────────────
  { name: 'stripe_secret', pattern: /sk_(?:live|test)_[A-Za-z0-9]{24,}/g },
  { name: 'stripe_publishable', pattern: /pk_(?:live|test)_[A-Za-z0-9]{24,}/g },
  { name: 'stripe_webhook', pattern: /whsec_[A-Za-z0-9]{24,}/g },
  {
    name: 'paypal_secret',
    pattern: /(?:paypal_secret|PAYPAL_CLIENT_SECRET)\s*[=:]\s*['"]?[A-Za-z0-9_-]{40,}['"]?/gi,
  },

  // ── Email & Auth Providers ──────────────────────────────────────────
  { name: 'sendgrid_key', pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g },
  { name: 'mailgun_key', pattern: /key-[A-Za-z0-9]{32}/g },
  {
    name: 'auth0_secret',
    pattern: /(?:AUTH0_CLIENT_SECRET)\s*[=:]\s*['"]?[A-Za-z0-9_-]{40,}['"]?/gi,
  },

  // ── Version Control & CI ────────────────────────────────────────────
  { name: 'npm_token', pattern: /npm_[A-Za-z0-9]{36}/g },
  { name: 'pypi_token', pattern: /pypi-[A-Za-z0-9_-]{50,}/g },
  { name: 'docker_hub_token', pattern: /dckr_pat_[A-Za-z0-9_-]{20,}/g },
  {
    name: 'circleci_token',
    pattern: /(?:CIRCLE_TOKEN|circleci_token)\s*[=:]\s*['"]?[A-Za-z0-9]{40}['"]?/gi,
  },
  { name: 'travis_token', pattern: /(?:TRAVIS_TOKEN)\s*[=:]\s*['"]?[A-Za-z0-9]{20,}['"]?/gi },

  // ── Monitoring & Analytics ──────────────────────────────────────────
  { name: 'sentry_dsn', pattern: /https:\/\/[a-f0-9]{32}@[a-z0-9]+\.ingest\.sentry\.io\/\d+/g },
  {
    name: 'datadog_api_key',
    pattern: /(?:DD_API_KEY|datadog_api_key)\s*[=:]\s*['"]?[a-f0-9]{32}['"]?/gi,
  },
  { name: 'newrelic_key', pattern: /NRAK-[A-Z0-9]{27}/g },

  // ── Generic Patterns ────────────────────────────────────────────────
  {
    name: 'private_key_pem',
    pattern:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: 'generic_secret_assignment',
    pattern:
      /(?:secret|password|passwd|token|api_key|apikey|access_key|auth_token|credentials)\s*[=:]\s*['"][A-Za-z0-9+/=_-]{16,}['"]/gi,
  },
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  },
  { name: 'basic_auth', pattern: /Basic\s+[A-Za-z0-9+/=]{20,}/g },
  {
    name: 'ssh_private_key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g,
  },

  // ── Cloudflare ──────────────────────────────────────────────────────
  {
    name: 'cloudflare_api_token',
    pattern: /(?:CF_API_TOKEN|CLOUDFLARE_API_TOKEN)\s*[=:]\s*['"]?[A-Za-z0-9_-]{40}['"]?/gi,
  },
  {
    name: 'cloudflare_r2_key',
    pattern: /(?:R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{20,}['"]?/gi,
  },

  // ── Vercel / Netlify ────────────────────────────────────────────────
  { name: 'vercel_token', pattern: /(?:VERCEL_TOKEN)\s*[=:]\s*['"]?[A-Za-z0-9]{24,}['"]?/gi },
  {
    name: 'netlify_token',
    pattern: /(?:NETLIFY_AUTH_TOKEN)\s*[=:]\s*['"]?[A-Za-z0-9_-]{40,}['"]?/gi,
  },
];

// ── Public API ───────────────────────────────────────────────────────────────

export interface RedactionResult {
  text: string;
  redactedCount: number;
  redactedPatterns: string[];
}

/**
 * Redact all secrets from text. Returns cleaned text + stats.
 * Use before sending user messages or context to LLM.
 */
export function redactSecrets(text: string): RedactionResult {
  if (!text) return { text, redactedCount: 0, redactedPatterns: [] };

  let result = text;
  let totalRedacted = 0;
  const patternsFound: string[] = [];

  for (const { name, pattern } of PATTERNS) {
    // Reset regex state (global flag)
    pattern.lastIndex = 0;
    const matches = result.match(pattern);
    if (matches) {
      totalRedacted += matches.length;
      patternsFound.push(name);
      result = result.replace(pattern, REDACTED);
    }
  }

  return {
    text: result,
    redactedCount: totalRedacted,
    redactedPatterns: patternsFound,
  };
}

/**
 * Check if text contains any secrets (without redacting).
 * Useful for pre-flight checks before DB writes.
 */
export function containsSecrets(text: string): boolean {
  if (!text) return false;
  for (const { pattern } of PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }
  return false;
}

/**
 * Get count of registered redaction patterns.
 */
export function getPatternCount(): number {
  return PATTERNS.length;
}
