import { NextResponse } from "next/server";

type BucketEntry = {
  count: number;
  resetAt: number;
};

type BucketConfig = {
  bucket: string;
  limit: number;
  windowMs: number;
  keySuffix?: string | null;
};

const buckets = new Map<string, BucketEntry>();

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function getRateLimitKey(req: Request, config: BucketConfig): string {
  const ip = getClientIp(req);
  return `${config.bucket}:${config.keySuffix ?? ip}`;
}

function cleanupExpired(now: number): void {
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function enforceApiRateLimit(req: Request, config: BucketConfig): NextResponse | null {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const now = Date.now();
  cleanupExpired(now);

  const key = getRateLimitKey(req, config);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  if (existing.count >= config.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return NextResponse.json(
      {
        ok: false,
        error: "Too many requests",
        code: "RATE_LIMITED",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(existing.resetAt / 1000)),
        },
      }
    );
  }

  existing.count += 1;
  return null;
}

export function clearApiRateLimitsForTests(): void {
  buckets.clear();
}
