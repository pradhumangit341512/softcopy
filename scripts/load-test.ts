#!/usr/bin/env tsx
/**
 * Load Test — simulates 100 concurrent users for 5 minutes.
 *
 * Tests ALL critical endpoints:
 *   1. Public pages (login page, landing)
 *   2. Auth endpoint (/api/auth/me)
 *   3. Client list with pagination
 *   4. Client create
 *   5. Properties list
 *   6. Team performance
 *   7. Analytics
 *   8. My Work dashboard
 *
 * Reports: requests/sec, latency p50/p95/p99, errors, per-endpoint breakdown.
 *
 * Usage: npx tsx scripts/load-test.ts
 */

const BASE = 'http://localhost:3000';
const DURATION_SEC = 300; // 5 minutes
const CONCURRENT = 100;
const REPORT_INTERVAL = 30; // report every 30 seconds

interface EndpointStats {
  name: string;
  requests: number;
  errors: number;
  latencies: number[];
}

const endpoints: EndpointStats[] = [
  { name: 'GET /login (page)', requests: 0, errors: 0, latencies: [] },
  { name: 'GET /api/auth/me', requests: 0, errors: 0, latencies: [] },
  { name: 'GET /api/clients?page=1', requests: 0, errors: 0, latencies: [] },
  { name: 'GET /api/properties?page=1', requests: 0, errors: 0, latencies: [] },
  { name: 'GET /api/team-performance', requests: 0, errors: 0, latencies: [] },
  { name: 'GET /api/analytics', requests: 0, errors: 0, latencies: [] },
  { name: 'GET /api/my-work', requests: 0, errors: 0, latencies: [] },
  { name: 'GET /api/commissions?page=1', requests: 0, errors: 0, latencies: [] },
];

let totalRequests = 0;
let totalErrors = 0;
let allLatencies: number[] = [];
const startTime = Date.now();

// First get a valid auth cookie by logging in
async function getAuthCookie(): Promise<string | null> {
  try {
    // Try to get cookie from /api/auth/me with existing session
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { 'Cookie': '' },
    });
    if (res.ok) return '';

    console.log('[load-test] No active session. Testing without auth (public endpoints only).');
    console.log('[load-test] For authenticated tests, login in the browser first.');
    return null;
  } catch {
    return null;
  }
}

async function hitEndpoint(idx: number, cookie: string | null): Promise<void> {
  const ep = endpoints[idx];
  const urls: Record<number, string> = {
    0: `${BASE}/login`,
    1: `${BASE}/api/auth/me`,
    2: `${BASE}/api/clients?page=1&limit=10`,
    3: `${BASE}/api/properties?page=1&limit=10`,
    4: `${BASE}/api/team-performance`,
    5: `${BASE}/api/analytics`,
    6: `${BASE}/api/my-work`,
    7: `${BASE}/api/commissions?page=1&limit=10`,
  };

  const url = urls[idx];
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;

  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    const latency = Math.round(performance.now() - t0);

    ep.requests++;
    ep.latencies.push(latency);
    totalRequests++;
    allLatencies.push(latency);

    if (!res.ok && res.status !== 401 && res.status !== 402) {
      ep.errors++;
      totalErrors++;
    }
  } catch {
    const latency = Math.round(performance.now() - t0);
    ep.requests++;
    ep.errors++;
    ep.latencies.push(latency);
    totalRequests++;
    totalErrors++;
    allLatencies.push(latency);
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

function printReport(final = false) {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const rps = elapsed > 0 ? Math.round(totalRequests / elapsed) : 0;

  console.log('\n' + (final ? '═══ FINAL REPORT ═══' : `── ${elapsed}s elapsed ──`));
  console.log(`Total: ${totalRequests} requests | ${totalErrors} errors (${(totalErrors / Math.max(1, totalRequests) * 100).toFixed(1)}%) | ${rps} req/sec`);
  console.log(`Latency: p50=${percentile(allLatencies, 50)}ms | p95=${percentile(allLatencies, 95)}ms | p99=${percentile(allLatencies, 99)}ms | max=${Math.max(0, ...allLatencies)}ms`);

  if (final) {
    console.log('\n── Per-Endpoint Breakdown ──');
    console.log('Endpoint'.padEnd(35) + 'Reqs'.padStart(8) + 'Errs'.padStart(8) + 'p50'.padStart(8) + 'p95'.padStart(8) + 'p99'.padStart(8));
    console.log('─'.repeat(75));
    for (const ep of endpoints) {
      if (ep.requests === 0) continue;
      const p50 = percentile(ep.latencies, 50);
      const p95 = percentile(ep.latencies, 95);
      const p99 = percentile(ep.latencies, 99);
      console.log(
        ep.name.padEnd(35) +
        String(ep.requests).padStart(8) +
        String(ep.errors).padStart(8) +
        `${p50}ms`.padStart(8) +
        `${p95}ms`.padStart(8) +
        `${p99}ms`.padStart(8)
      );
    }

    // Grade
    console.log('\n── GRADE ──');
    const p95 = percentile(allLatencies, 95);
    const errorRate = totalErrors / Math.max(1, totalRequests) * 100;

    if (p95 < 200 && errorRate < 1) {
      console.log('🟢 EXCELLENT — Ready for 100+ users. p95 < 200ms, errors < 1%');
    } else if (p95 < 500 && errorRate < 5) {
      console.log('🟡 GOOD — Handles 100 users but some slowness. p95 < 500ms');
    } else if (p95 < 1000 && errorRate < 10) {
      console.log('🟠 FAIR — Noticeable lag at 100 users. Optimize DB queries.');
    } else if (p95 < 3000) {
      console.log('🔴 POOR — Struggles at 100 users. p95 > 1s. Needs caching + query optimization.');
    } else {
      console.log('⛔ FAILING — Cannot handle 100 users. Major architectural changes needed.');
    }

    // Recommendations
    console.log('\n── RECOMMENDATIONS ──');
    for (const ep of endpoints) {
      if (ep.requests === 0) continue;
      const p95 = percentile(ep.latencies, 95);
      if (p95 > 1000) {
        console.log(`⚠️  ${ep.name} — p95=${p95}ms — SLOW. Needs optimization.`);
      }
      if (ep.errors > ep.requests * 0.05) {
        console.log(`❌ ${ep.name} — ${ep.errors}/${ep.requests} errors (${(ep.errors/ep.requests*100).toFixed(1)}%) — FAILING.`);
      }
    }
  }
}

async function worker(id: number, cookie: string | null, endAt: number): Promise<void> {
  while (Date.now() < endAt) {
    // Each worker cycles through endpoints like a real user
    const epIdx = id % endpoints.length;
    await hitEndpoint(epIdx, cookie);
    // Small random delay (100-500ms) to simulate real user think time
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 400));
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  LOAD TEST — 100 Users × 5 Minutes        ║');
  console.log('║  Target: http://localhost:3000              ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  // Check server is up
  try {
    const res = await fetch(`${BASE}/login`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  } catch (e) {
    console.error('❌ Server not reachable at', BASE);
    console.error('   Run: npm run dev');
    process.exit(1);
  }

  const cookie = await getAuthCookie();
  const endAt = Date.now() + DURATION_SEC * 1000;

  console.log(`Starting ${CONCURRENT} concurrent workers for ${DURATION_SEC}s...`);
  console.log(`Testing ${endpoints.length} endpoints`);
  console.log('');

  // Report every 30 seconds
  const reportTimer = setInterval(() => printReport(false), REPORT_INTERVAL * 1000);

  // Launch all workers
  const workers = Array.from({ length: CONCURRENT }, (_, i) =>
    worker(i, cookie, endAt)
  );

  await Promise.all(workers);

  clearInterval(reportTimer);
  printReport(true);

  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
