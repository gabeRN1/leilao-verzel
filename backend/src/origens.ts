export const ORIGENS = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''));