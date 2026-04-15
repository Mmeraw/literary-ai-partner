/**
 * Phase 2C: Lease Service Client
 * Wraps Supabase RPC calls for claim, heartbeat, release, expire.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LeaseResult {
  ok: boolean;
  error?: string;
  lease_token?: string;
  expires_at?: string;
}

export class LeaseService {
  private db: SupabaseClient;
  private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  async claim(jobId: string, workerId: string, ttlSeconds = 300): Promise<LeaseResult> {
    const { data, error } = await this.db.rpc('claim_lease', {
      p_job_id: jobId,
      p_worker_id: workerId,
      p_ttl_seconds: ttlSeconds,
    });
    if (error) return { ok: false, error: error.message };
    return data as LeaseResult;
  }

  async heartbeat(jobId: string, leaseToken: string, ttlSeconds = 300): Promise<LeaseResult> {
    const { data, error } = await this.db.rpc('heartbeat_lease', {
      p_job_id: jobId,
      p_lease_token: leaseToken,
      p_ttl_seconds: ttlSeconds,
    });
    if (error) return { ok: false, error: error.message };
    return data as LeaseResult;
  }

  startHeartbeat(jobId: string, leaseToken: string, intervalMs = 60000): void {
    this.stopHeartbeat(jobId);
    const iv = setInterval(async () => {
      const res = await this.heartbeat(jobId, leaseToken);
      if (!res.ok) {
        console.error(`[LeaseService] heartbeat failed for job ${jobId}:`, res.error);
        this.stopHeartbeat(jobId);
      }
    }, intervalMs);
    this.heartbeatIntervals.set(jobId, iv);
  }

  stopHeartbeat(jobId: string): void {
    const iv = this.heartbeatIntervals.get(jobId);
    if (iv) {
      clearInterval(iv);
      this.heartbeatIntervals.delete(jobId);
    }
  }

  async release(jobId: string, leaseToken: string): Promise<LeaseResult> {
    this.stopHeartbeat(jobId);
    const { data, error } = await this.db.rpc('release_lease', {
      p_job_id: jobId,
      p_lease_token: leaseToken,
    });
    if (error) return { ok: false, error: error.message };
    return data as LeaseResult;
  }

  async expireStale(): Promise<{ ok: boolean; expired_count?: number; error?: string }> {
    const { data, error } = await this.db.rpc('expire_stale_leases');
    if (error) return { ok: false, error: error.message };
    return data as { ok: boolean; expired_count: number };
  }

  stopAll(): void {
    for (const [jobId] of this.heartbeatIntervals) {
      this.stopHeartbeat(jobId);
    }
  }
}
