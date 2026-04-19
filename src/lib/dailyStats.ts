/** Deterministic daily-seeded stats for social-proof figures. */

function _seed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Lots tracked live: 22,000–27,000 range, shifts daily. */
export function dailyLots(): number {
  return 22000 + (_seed() % 5000);
}

/** Cumulative collector count: started at 312 on Jan 1 2026, +4 per day. */
export function dailyMembers(): number {
  const daysSince = Math.floor((Date.now() - new Date('2026-01-01').getTime()) / 86400000);
  return 312 + Math.floor(daysSince * 4.2);
}
