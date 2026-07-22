import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assessBurnIn, loadBurnInCohort } from '@/lib/evaluation/reliability/burnInContract';

const manifestArg = process.argv[2];
if (!manifestArg) throw new Error('Usage: npm run evaluation:burn-in -- <cohort-manifest.json> [report.json]');
const loaded = loadBurnInCohort(resolve(manifestArg));
const report = assessBurnIn(loaded.manifest, loaded.manifestSha256, loaded.outcomes);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
const reportArg = process.argv[3];
if (reportArg) writeFileSync(resolve(reportArg), serialized, 'utf8');
process.stdout.write(serialized);
if (!report.pass) process.exitCode = 1;
