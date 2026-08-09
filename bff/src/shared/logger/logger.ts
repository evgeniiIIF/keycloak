import { config } from '../../config/config';

const RESET = '\x1b[0m';
const GRAY = '\x1b[90m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const FIELD = '\x1b[38;5;250m';

const LEVEL_COLOR: Record<string, string> = {
  INFO: GREEN,
  WARN: YELLOW,
  ERROR: RED,
  DEBUG: GRAY,
};

type LogField = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogField>;

function timestamp(): string {
  return new Date().toISOString();
}

function maskPII(fields?: LogFields): LogFields | undefined {
  if (!fields) return undefined;
  const masked = { ...fields };
  for (const key of Object.keys(masked)) {
    if (['email', 'preferred_username', 'user', 'accessToken', 'refreshToken', 'client_secret', 'code', 'state', 'password'].includes(key) && typeof masked[key] === 'string') {
      masked[key] = '***';
    }
  }
  return masked;
}

function formatFields(fields?: LogFields): string {
  if (!fields) return '';
  return ' ' + Object.entries(fields).map(([k, v]) => `${FIELD}${k}=${v}${RESET}`).join(' ');
}

function log(service: string, level: string, message: string, fields?: LogFields) {
  const output = level === 'ERROR' ? console.error : console.log;
  const masked = maskPII(fields);

  if (config.isProduction) {
    const entry: { timestamp: string; level: string; service: string; message: string; fields?: LogFields } = {
      timestamp: timestamp(), level, service, message,
    };
    if (masked) entry.fields = masked;
    output(JSON.stringify(entry));
  } else {
    const ts = GRAY + timestamp() + RESET;
    const lvl = (LEVEL_COLOR[level] || RESET) + `[${level}]` + RESET;
    output(`${ts} [${service}] ${lvl} ${message}${formatFields(masked)}`);
  }
}

export const Logger = {
  info: (svc: string, msg: string, f?: LogFields) => log(svc, 'INFO', msg, f),
  warn: (svc: string, msg: string, f?: LogFields) => log(svc, 'WARN', msg, f),
  error: (svc: string, msg: string, f?: LogFields) => log(svc, 'ERROR', msg, f),
};
