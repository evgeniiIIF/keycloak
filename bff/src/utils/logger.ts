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
  ProxyService: SPRING,
  AdminEvents: GOLD,
  App: WHITE,
};

function timestamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export function log(service: string, level: LogLevel, message: string) {
  const ts = GRAY + timestamp() + RESET;
  const svc = (SERVICE_COLORS[service] || WHITE) + `[${service}]` + RESET;
  const lvl = LEVEL_COLORS[level] + `[${level}]` + RESET;
  console.log(`${ts} ${svc} ${lvl} ${message}`);
}

export function hl(text: string, color: string): string {
  return color + text + RESET;
}

export const Logger = {
  info: (service: string, msg: string) => log(service, 'INFO', msg),
  warn: (service: string, msg: string) => log(service, 'WARN', msg),
  error: (service: string, msg: string) => log(service, 'ERROR', msg),
  debug: (service: string, msg: string) => log(service, 'DEBUG', msg),
};
