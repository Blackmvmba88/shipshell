const REDACTION = "[REDACTED]";
const SECRET_ASSIGNMENT = /\b([A-Z0-9_.-]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL|COOKIE|AUTHORIZATION)[A-Z0-9_.-]*)\s*([=:])\s*([^\s'";]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi;
const OPENAI_KEY = /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g;
const GITHUB_TOKEN = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g;
const NPM_TOKEN = /\bnpm_[A-Za-z0-9]{20,}\b/g;
const AWS_ACCESS_KEY = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const URL_USERINFO = /\b(https?:\/\/)([^/\s@]+)@/gi;
const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;

export function redactSensitiveText(value: string | undefined): string | undefined {
  if (!value) return value;
  return value
    .replace(PRIVATE_KEY_BLOCK, "[REDACTED PRIVATE KEY]")
    .replace(URL_USERINFO, `$1${REDACTION}@`)
    .replace(BEARER_TOKEN, `Bearer ${REDACTION}`)
    .replace(SECRET_ASSIGNMENT, (_match, name: string, separator: string) => `${name}${separator}${REDACTION}`)
    .replace(OPENAI_KEY, REDACTION)
    .replace(GITHUB_TOKEN, REDACTION)
    .replace(NPM_TOKEN, REDACTION)
    .replace(AWS_ACCESS_KEY, REDACTION)
    .replace(JWT, REDACTION);
}

export function containsRecognizedSecret(value: string): boolean {
  return redactSensitiveText(value) !== value;
}

export function redactSensitiveValue<T>(value: T): T {
  if (typeof value === "string") return redactSensitiveText(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValue(item)) as T;
  if (value && typeof value === "object") {
    const redacted = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactSensitiveValue(item)]),
    );
    return redacted as T;
  }
  return value;
}
