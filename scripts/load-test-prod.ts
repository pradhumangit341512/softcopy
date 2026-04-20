#!/usr/bin/env tsx
/**
 * Production Load Test — 100 users × 5 minutes against Vercel deployment.
 */

const BASE = 'https://softcopy-bno8l067e-pradhuman-singhs-projects-f70305c7.vercel.app';
const DURATION_SEC = 300;
const CONCURRENT = 100;
const REPORT_INTERVAL = 30;

interface Stats { name: string; requests: number; errors: number; latencies: number[]; statusCodes: Record<number, number> }

const endpoints: Stats[] = [
  { name: 'GET / (landing)', requests: 0, errors: 0, latencies: [], statusCodes: {} },
  { name: 'GET /login', requests: 0, errors: 0, latencies: [], statusCodes: {} },
  { name: 'GET /api/auth/me', requests: 0, errors: 0, latencies: [], statusCodes: {} },
  { name: 'GET /api/clients', requests: 0, errors: 0, latencies: [], statusCodes: {} },
  { name: 'GET /api/properties', requests: 0, errors: 0, latencies: [], statusCodes: {} },
  { name: 'GET /api/team-performance', requests: 0, errors: 0, latencies: [], statusCodes: {} },
  { name: 'GET /api/analytics', requests: 0, errors: 0, latencies: [], statusCodes: {} },
  { name: 'GET /api/commissions', requests: 0, errors: 0, latencies: [], statusCodes: {} },
];

const urls = [
  `${BASE}/`,
  `${BASE}/login`,
  `${BASE}/api/auth/me`,
  `${BASE}/api/clients?page=1&limit=10`,
  `${BASE}/api/properties?page=1&limit=10`,
  `${BASE}/api/team-performance`,
  `${BASE}/api/analytics`,
  `${BASE}/api/commissions?page=1&limit=10`,
];

let totalReqs = 0, totalErrs = 0;
const allLat: number[] = [];
const startTime = Date.now();

async function hit(idx: number) {
  const ep = endpoints[idx];
  const t0 = performance.now();
  try {
    const res = await fetch(urls[idx], { signal: AbortSignal.timeout(15000) });
    const lat = Math.round(performance.now() - t0);
    ep.requests++; ep.latencies.push(lat); totalReqs++; allLat.push(lat);
    ep.statusCodes[res.status] = (ep.statusCodes[res.status] ?? 0) + 1;
    // 401/402 are expected (no auth cookie) — not errors
    if (!res.ok && res.status !== 401 && res.status !== 402 && res.status !== 307 && res.status !== 302) {
      ep.errors++; totalErrs++;
    }
  } catch {
    const lat = Math.round(performance.now() - t0);
    ep.requests++; ep.errors++; ep.latencies.push(lat); totalReqs++; totalErrs++; allLat.push(lat);
  }
}

function pct(arr: number[], p: number) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(s.length * p / 100) - 1)];
}

function report(final = false) {
  const el = Math.round((Date.now() - startTime) / 1000);
  const rps = el > 0 ? Math.round(totalReqs / el) : 0;
  console.log(final ? '\n═══ FINAL PRODUCTION REPORT ═══' : `\n── ${el}s ──`);
  console.log(`Requests: ${totalReqs} | Errors: ${totalErrs} (${(totalErrs/Math.max(1,totalReqs)*100).toFixed(1)}%) | ${rps} req/sec`);
  console.log(`Latency: p50=${pct(allLat,50)}ms | p95=${pct(allLat,95)}ms | p99=${pct(allLat,99)}ms | max=${Math.max(0,...allLat)}ms`);

  if (final) {
    console.log('\n── Per-Endpoint ──');
    console.log('Endpoint'.padEnd(28) + 'Reqs'.padStart(7) + 'Errs'.padStart(7) + 'p50'.padStart(8) + 'p95'.padStart(8) + 'p99'.padStart(8) + '  Status Codes');
    console.log('─'.repeat(90));
    for (const ep of endpoints) {
      if (!ep.requests) continue;
      const codes = Object.entries(ep.statusCodes).map(([c,n]) => `${c}:${n}`).join(' ');
      console.log(
        ep.name.padEnd(28) +
        String(ep.requests).padStart(7) +
        String(ep.errors).padStart(7) +
        `${pct(ep.latencies,50)}ms`.padStart(8) +
        `${pct(ep.latencies,95)}ms`.padStart(8) +
        `${pct(ep.latencies,99)}ms`.padStart(8) +
        `  ${codes}`
      );
    }

    const p95 = pct(allLat, 95);
    const errRate = totalErrs / Math.max(1, totalReqs) * 100;
    console.log('\n── GRADE ──');
    if (p95 < 300 && errRate < 1) console.log('🟢 EXCELLENT — Production ready for 100+ concurrent users.');
    else if (p95 < 500 && errRate < 3) console.log('🟢 GOOD — Handles 100 users well. Minor optimization possible.');
    else if (p95 < 1000 && errRate < 5) console.log('🟡 FAIR — Works at 100 users but some requests slow.');
    else if (p95 < 2000 && errRate < 10) console.log('🟠 NEEDS WORK — Noticeable lag. Add caching + optimize queries.');
    else console.log('🔴 POOR — Struggles at 100 users. Major optimization needed.');

    console.log('\n── COMPARISON: Dev vs Production ──');
    console.log('Metric'.padEnd(20) + 'Dev (localhost)'.padStart(18) + 'Production (Vercel)'.padStart(22));
    console.log('─'.repeat(60));
    console.log('p50 latency'.padEnd(20) + '320ms'.padStart(18) + `${pct(allLat,50)}ms`.padStart(22));
    console.log('p95 latency'.padEnd(20) + '2,891ms'.padStart(18) + `${pct(allLat,95)}ms`.padStart(22));
    console.log('Throughput'.padEnd(20) + '96 req/sec'.padStart(18) + `${rps} req/sec`.padStart(22));
    console.log('Error rate'.padEnd(20) + '1.5%'.padStart(18) + `${errRate.toFixed(1)}%`.padStart(22));
  }
}

async function worker(id: number, endAt: number) {
  while (Date.now() < endAt) {
    await hit(id % endpoints.length);
    await new Promise(r => setTimeout(r, 100 + Math.random() * 400));
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  PRODUCTION LOAD TEST — 100 Users × 5 Minutes    ║');
  console.log(`║  Target: Vercel deployment                        ║`);
  console.log('╚═══════════════════════════════════════════════════╝\n');

  // Health check
  try {
    const r = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(10000) });
    console.log(`Health check: HTTP ${r.status} (${r.ok || r.status === 401 ? 'OK' : 'WARN'})\n`);
  } catch (e) {
    console.error('❌ Cannot reach Vercel deployment:', e);
    process.exit(1);
  }

  const endAt = Date.now() + DURATION_SEC * 1000;
  console.log(`Starting ${CONCURRENT} workers for ${DURATION_SEC}s...\n`);

  const timer = setInterval(() => report(), REPORT_INTERVAL * 1000);
  await Promise.all(Array.from({ length: CONCURRENT }, (_, i) => worker(i, endAt)));
  clearInterval(timer);
  report(true);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
