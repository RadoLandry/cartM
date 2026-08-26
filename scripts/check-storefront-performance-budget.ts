/**
 * Checks storefront bundle sizes against the performance budget defined in the
 * CartMind constitution: max 50 KB gzip for the initial widget payload and
 * max 100 KB gzip for the full lazy widget footprint.
 *
 * Usage:  npx tsx scripts/check-storefront-performance-budget.ts
 * Exit 0 = all budgets pass. Exit 1 = one or more budgets exceeded.
 */

import { existsSync, statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import zlib from "node:zlib";

interface BudgetEntry {
  label: string;
  path: string;
  /** Maximum allowed gzip size in bytes */
  maxGzipBytes: number;
  required: boolean;
}

const BUDGETS: BudgetEntry[] = [
  {
    label: "Storefront chat app bundle (cartmind-chat-app.js)",
    path: "public/storefront/cartmind-chat-app.js",
    maxGzipBytes: 50 * 1024, // 50 KB gzip — initial widget payload cap
    required: false, // may not exist if the widget build step has not run yet
  },
  {
    label: "Cart drawer block runtime (cartmind-chat-block-runtime.js)",
    path: "public/storefront/cartmind-chat-block-runtime.js",
    maxGzipBytes: 100 * 1024, // 100 KB gzip — full lazy widget footprint cap
    required: true,
  },
];

function gzipSize(filePath: string): number {
  const raw = readFileSync(filePath);
  return zlib.gzipSync(raw, { level: 9 }).length;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

let failed = false;

console.log("\n=== CartMind Storefront Performance Budget Check ===\n");

for (const budget of BUDGETS) {
  const abs = resolve(process.cwd(), budget.path);

  if (!existsSync(abs)) {
    if (budget.required) {
      console.error(`[FAIL] ${budget.label}`);
      console.error(`       File not found: ${budget.path}`);
      console.error(`       Run 'npm run build' or the storefront-widget build step first.\n`);
      failed = true;
    } else {
      console.warn(`[SKIP] ${budget.label}`);
      console.warn(`       File not found (optional): ${budget.path}\n`);
    }
    continue;
  }

  const rawBytes = statSync(abs).size;
  const gzBytes = gzipSize(abs);

  const pass = gzBytes <= budget.maxGzipBytes;
  const status = pass ? "[PASS]" : "[FAIL]";

  console.log(`${status} ${budget.label}`);
  console.log(`       Raw: ${formatKb(rawBytes)}  |  Gzip: ${formatKb(gzBytes)}  |  Budget: ${formatKb(budget.maxGzipBytes)}`);

  if (!pass) {
    const overBy = gzBytes - budget.maxGzipBytes;
    console.error(`       OVER BUDGET by ${formatKb(overBy)}. Split or lazy-load dependencies to reduce the footprint.\n`);
    failed = true;
  } else {
    const headroom = budget.maxGzipBytes - gzBytes;
    console.log(`       Headroom: ${formatKb(headroom)}\n`);
  }
}

console.log("=== p95 cart-load target: <= 300 ms ===");
console.log("  Automated measurement requires a running Shopify dev store.");
console.log("  For local verification, use browser DevTools Performance panel");
console.log("  with Network throttling set to 'Fast 3G' and confirm CartMind");
console.log("  guidance appears within 300 ms of cart drawer open.\n");

if (failed) {
  console.error("Budget check FAILED. Address the issues above before merging.\n");
  process.exit(1);
} else {
  console.log("All budget checks PASSED.\n");
  process.exit(0);
}
