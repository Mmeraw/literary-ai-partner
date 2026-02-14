import { runPhase1 } from '../lib/jobs/phase1';

const jobId = '3b44cf89-f247-4c57-b1ec-6e16b7856001';

console.log('Starting Phase 1 for job:', jobId);
runPhase1(jobId)
  .then(() => console.log('Phase 1 completed!'))
  .catch(err => console.error('Phase 1 failed:', err));
