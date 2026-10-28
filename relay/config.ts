// Relay settings from the environment, with defaults (constitution VIII: limits live in configuration).
export const DEFAULTS = { port: 8787, roomSize: 12, maxMessage: 8192, rate: 40, perAddress: 8, maxRooms: 500, pingMs: 30000, logMs: 60000, maxBuffer: 65_536, listRate: 5 };
export type Config = typeof DEFAULTS;

export const KEYS: Record<keyof Config, string> = {
  port: 'RELAY_PORT', roomSize: 'RELAY_ROOM_SIZE', maxMessage: 'RELAY_MAX_MESSAGE', rate: 'RELAY_RATE',
  perAddress: 'RELAY_PER_ADDRESS', maxRooms: 'RELAY_MAX_ROOMS', pingMs: 'RELAY_PING_MS', logMs: 'RELAY_LOG_MS', maxBuffer: 'RELAY_MAX_BUFFER',
  listRate: 'RELAY_LIST_RATE',
};

export function loadConfig(env: Record<string, string | undefined>): Config {
  const config = { ...DEFAULTS };
  for (const key of Object.keys(KEYS) as (keyof Config)[]) {
    const raw = env[KEYS[key]];
    if (raw === undefined || !/^\d+$/.test(raw)) continue;
    const n = Number(raw);
    if (n > 0 || (key === 'port' && n === 0)) config[key] = n; // port 0 = any free port (tests)
  }
  return config;
}
