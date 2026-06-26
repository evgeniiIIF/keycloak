const RESET = '\x1b[0m';
const GRAY = '\x1b[90m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[37m';
const ORANGE = '\x1b[38;5;208m';
const SPRING = '\x1b[38;5;46m';
const GOLD = '\x1b[38;5;220m';
const FIELD_COLOR = '\x1b[38;5;250m';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: GREEN,
  WARN: YELLOW,
  ERROR: RED,
  DEBUG: GRAY,
};

const SERVICE_COLORS: Record<string, string> = {
  AuthService: CYAN,
  AuthController: BLUE,
  SessionService: MAGENTA,
  SessionGuard: ORANGE,
  HttpClient: SPRING,
  AdminEvents: GOLD,
  RequestLogger: '\x1b[38;5;117m',
  App: WHITE,
};

function timestamp(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toLocaleTimeString('en-GB', { hour12: false });
  return `${date} ${time}`;
}

function formatFields(fields?: Record<string, string>): string {
  if (!fields) return '';
  const parts = Object.entries(fields).map(
    ([k, v]) => `${FIELD_COLOR}${k}=${v}${RESET}`
  );
  return ' ' + parts.join(' ');
}

export function log(service: string, level: LogLevel, message: string, fields?: Record<string, string>) {
  const ts = GRAY + timestamp() + RESET;
  const svc = (SERVICE_COLORS[service] || WHITE) + `[${service}]` + RESET;
  const lvl = LEVEL_COLORS[level] + `[${level}]` + RESET;
  console.log(`${ts} ${svc} ${lvl} ${message}${formatFields(fields)}`);
}

export function hl(text: string, color: string): string {
  return color + text + RESET;
}

export const Logger = {
  info: (service: string, msg: string, fields?: Record<string, string>) => log(service, 'INFO', msg, fields),
  warn: (service: string, msg: string, fields?: Record<string, string>) => log(service, 'WARN', msg, fields),
  error: (service: string, msg: string, fields?: Record<string, string>) => log(service, 'ERROR', msg, fields),
  debug: (service: string, msg: string, fields?: Record<string, string>) => log(service, 'DEBUG', msg, fields),
};
