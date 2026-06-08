/* TEMP — audit subscription/entitlement state across companies. Delete after QA. */
import './_loadenv';
import { db } from '../lib/db';

async function main() {
  const now = Date.now();
  const companies = await db.company.findMany({
    select: { id: true, companyName: true, status: true, plan: true, subscriptionExpiry: true, subscriptionUntil: true, featureFlags: true },
  });

  let active = 0, expiredUntil = 0, nullUntil = 0, notActiveStatus = 0;
  const samples: string[] = [];
  for (const c of companies) {
    const statusActive = c.status === 'active';
    const untilOk = !c.subscriptionUntil || c.subscriptionUntil.getTime() > now;
    const featuresOn = statusActive && untilOk;
    if (!statusActive) notActiveStatus++;
    if (c.subscriptionUntil === null) nullUntil++;
    else if (c.subscriptionUntil.getTime() <= now) expiredUntil++;
    if (featuresOn) active++;
    if (samples.length < 12) {
      samples.push(
        `${(c.companyName||'').slice(0,18).padEnd(18)} status=${c.status?.padEnd(9)} plan=${(c.plan||'?').padEnd(10)} ` +
        `until=${c.subscriptionUntil ? c.subscriptionUntil.toISOString().slice(0,10) : 'null'} ` +
        `expiry=${c.subscriptionExpiry ? c.subscriptionExpiry.toISOString().slice(0,10) : 'null'} ` +
        `→ featuresOn=${featuresOn}`
      );
    }
  }

  console.log(`total companies: ${companies.length}`);
  console.log(`features ENABLED (active+not expired): ${active}`);
  console.log(`features DISABLED total: ${companies.length - active}`);
  console.log(`  • status != active: ${notActiveStatus}`);
  console.log(`  • subscriptionUntil in PAST: ${expiredUntil}`);
  console.log(`  • subscriptionUntil null (legacy, stays active): ${nullUntil}`);
  console.log(`now = ${new Date(now).toISOString()}`);
  console.log('\nsample:');
  samples.forEach((s) => console.log('  ' + s));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
