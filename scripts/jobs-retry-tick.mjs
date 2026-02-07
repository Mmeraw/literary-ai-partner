console.log("jobs-retry-tick", new Date().toISOString());

// This script finds failed jobs with next_retry_at and retries them when eligible

import { getAllJobs } from "../lib/jobs/store.js";
import { getBaseUrl } from "./base-url.mjs";

async function retryTick() {
  const BASE = await getBaseUrl();
  const jobs = getAllJobs();
  const now = new Date();

  for (const job of jobs) {
    if (job.status === "failed" && job.progress.next_retry_at && new Date(job.progress.next_retry_at) <= now) {
      const retryPhase = job.progress.retry_phase;
      console.log(`Retrying job ${job.id}, phase ${retryPhase}`);

      // Determine endpoint
      let endpoint;
      if (retryPhase === "phase_1") {
        endpoint = `/api/jobs/${job.id}/run-phase1`;
      } else if (retryPhase === "phase_2") {
        endpoint = `/api/jobs/${job.id}/run-phase2`;
      } else {
        console.log(`Unknown retry_phase for job ${job.id}: ${retryPhase}`);
        continue;
      }

      try {
        const response = await fetch(`${BASE}${endpoint}`, { method: "POST" });
        if (response.ok) {
          console.log(`Retry triggered for job ${job.id}`);
        } else {
          console.log(`Retry failed for job ${job.id}: ${response.status}`);
        }
      } catch (e) {
        console.log(`Retry error for job ${job.id}: ${e.message}`);
      }
    }
  }
}

retryTick().catch(console.error);