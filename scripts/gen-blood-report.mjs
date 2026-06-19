#!/usr/bin/env node
/**
 * Regenerate the AI blood-panel report for a user (server-side, no session).
 *   node --import tsx scripts/gen-blood-report.mjs <userId>
 */
import { generateBloodReport } from "../lib/blood-report.ts";

const userId = parseInt(process.argv[2] ?? "", 10);
if (!Number.isFinite(userId)) { console.error("usage: gen-blood-report.mjs <userId>"); process.exit(1); }

const { status, json } = await generateBloodReport(userId, { force: true });
if (status !== 200) { console.error("[blood-report] FAILED", status, json); process.exit(1); }
console.log(`[blood-report] user ${userId}: score=${json.scoreOutOf100} markers=${json.markersCount} optimal=${json.optimalCount} outOfRange=${json.outOfRangeCount}`);
console.log("headline:", json.headline);
