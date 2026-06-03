import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPipelineHealthAdminEmail } from "@/lib/admin/pipelineHealthAllowlist";
import {
  formatUsdFromCents,
  getCostOpsDashboardData,
  type CostOpsAlert,
  type CostOpsBreakdownRow,
} from "@/lib/admin/costops";

export const dynamic = "force-dynamic";

type AdminUser = {
  app_metadata?: { role?: string } | null;
  email?: string | null;
};

function isAdminUser(user: AdminUser | null): boolean {
  if (!user) return false;
  const role = user.app_metadata?.role;
  return role === "admin" || role === "superadmin" || isPipelineHealthAdminEmail(user.email);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPct(value: number | null): string {
  if (value === null) return "Not set";
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-bold text-slate-950">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-6 text-slate-600">{detail}</div> : null}
    </div>
  );
}

function AlertCard({ alert }: { alert: CostOpsAlert }) {
  const tone =
    alert.severity === "danger"
      ? "border-red-300 bg-red-50 text-red-950"
      : alert.severity === "watch"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : alert.severity === "ok"
          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
          : "border-slate-300 bg-slate-50 text-slate-950";

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="text-sm font-bold">{alert.title}</div>
      <div className="mt-1 text-sm leading-6">{alert.detail}</div>
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: CostOpsBreakdownRow[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="py-3 pr-4">Name</th>
              <th className="py-3 pr-4">Spend</th>
              <th className="py-3 pr-4">Calls</th>
              <th className="py-3 pr-4">Input tokens</th>
              <th className="py-3 pr-4">Output tokens</th>
              <th className="py-3 pr-4">Avg / call</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.slice(0, 12).map((row) => (
                <tr key={row.key} className="align-top">
                  <td className="py-3 pr-4 font-semibold text-slate-900">{row.key}</td>
                  <td className="py-3 pr-4 text-slate-800">{formatUsdFromCents(row.usageCents)}</td>
                  <td className="py-3 pr-4 text-slate-700">{formatNumber(row.callCount)}</td>
                  <td className="py-3 pr-4 text-slate-700">{formatNumber(row.inputTokens)}</td>
                  <td className="py-3 pr-4 text-slate-700">{formatNumber(row.outputTokens)}</td>
                  <td className="py-3 pr-4 text-slate-700">{formatUsdFromCents(row.avgCostPerCallCents)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-4 text-slate-600" colSpan={6}>
                  No telemetry rows found yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function CostOpsDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminUser(user)) {
    redirect("/dashboard");
  }

  const data = await getCostOpsDashboardData();
  const { summary } = data;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1520px] space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">RevisionGrade CostOps</div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                Cost control, job economics, and spend alerts.
              </h1>
              <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600 sm:text-lg">
                This admin dashboard uses internal job telemetry as the source of truth for current MVP estimates, then prepares the surface for OpenAI, Vercel, Supabase, and manual subscription reconciliation.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              Generated {formatDate(summary.generatedAt)}
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Today’s spend"
            value={formatUsdFromCents(summary.today.totalCents)}
            detail={`${formatUsdFromCents(summary.today.usageCents)} usage + ${formatUsdFromCents(summary.today.fixedAllocatedCents)} fixed allocation`}
          />
          <MetricCard
            label="Month-to-date"
            value={formatUsdFromCents(summary.monthToDate.totalCents)}
            detail={`${formatUsdFromCents(summary.monthToDate.usageCents)} usage + ${formatUsdFromCents(summary.monthToDate.fixedAllocatedCents)} fixed allocation`}
          />
          <MetricCard
            label="Projected month-end"
            value={formatUsdFromCents(summary.projectedMonthEndCents)}
            detail={`Budget used: ${formatPct(summary.budgetUsedPct)}. Remaining: ${summary.budgetRemainingCents === null ? "Not set" : formatUsdFromCents(summary.budgetRemainingCents)}`}
          />
          <MetricCard
            label="Cost per evaluation"
            value={formatUsdFromCents(summary.avgUsageCostPerJobCents)}
            detail={`${formatNumber(summary.jobsWithCosts)} jobs with cost data · ${formatNumber(summary.callCount)} LLM calls`}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="OpenAI last 7 days" value={formatUsdFromCents(summary.last7dUsageCents)} detail="Internal LLM usage estimate from job_costs." />
          <MetricCard label="Most expensive job" value={formatUsdFromCents(summary.mostExpensiveJobCostCents)} detail={summary.mostExpensiveJobId ?? "No job telemetry yet."} />
          <MetricCard label="Top model" value={summary.topModel ?? "—"} detail="Highest estimated spend by model." />
          <MetricCard label="Failed / retried waste" value={formatUsdFromCents(summary.failedJobUsageCents + summary.retriedUsageCents)} detail={`${formatUsdFromCents(summary.failedJobUsageCents)} failed jobs · ${formatUsdFromCents(summary.retriedUsageCents)} retries`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Alerts</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.alerts.map((alert) => (
                  <AlertCard key={alert.code} alert={alert} />
                ))}
              </div>
            </section>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Provider status</h2>
            <div className="mt-4 space-y-3">
              {data.providerStatus.map((provider) => (
                <div key={provider.provider} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{provider.provider}</div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                      {provider.status.replace("_", " ")}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{provider.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        {data.warnings.length ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
            <h2 className="text-lg font-bold">Setup warnings</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
              {data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <BreakdownTable title="Spend by model" rows={data.modelBreakdown} />
          <BreakdownTable title="Spend by phase" rows={data.phaseBreakdown} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Most expensive jobs</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="py-3 pr-4">Job</th>
                  <th className="py-3 pr-4">Manuscript</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Phase</th>
                  <th className="py-3 pr-4">Spend</th>
                  <th className="py-3 pr-4">Calls</th>
                  <th className="py-3 pr-4">Tokens</th>
                  <th className="py-3 pr-4">Last call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentJobs.length ? (
                  data.recentJobs.map((job) => (
                    <tr key={job.jobId}>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-800">{job.jobId}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-700">{job.manuscriptId ?? "—"}</td>
                      <td className="py-3 pr-4 text-slate-700">{job.status ?? "—"}</td>
                      <td className="py-3 pr-4 text-slate-700">{job.phase ?? "—"}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{formatUsdFromCents(job.usageCents)}</td>
                      <td className="py-3 pr-4 text-slate-700">{formatNumber(job.callCount)}</td>
                      <td className="py-3 pr-4 text-slate-700">{formatNumber(job.inputTokens + job.outputTokens)}</td>
                      <td className="py-3 pr-4 text-slate-700">{formatDate(job.lastCalledAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-4 text-slate-600" colSpan={8}>No job-level cost telemetry found yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Manual subscriptions</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use this for ChatGPT, Supabase/Vercel fixed plans, domains, email, GitHub/Codex/Devin, and any service without a clean billing API.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="py-3 pr-4">Vendor</th>
                  <th className="py-3 pr-4">Label</th>
                  <th className="py-3 pr-4">Category</th>
                  <th className="py-3 pr-4">Monthly amount</th>
                  <th className="py-3 pr-4">Billing day</th>
                  <th className="py-3 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.manualSubscriptions.length ? (
                  data.manualSubscriptions.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{item.vendor}</td>
                      <td className="py-3 pr-4 text-slate-700">{item.label}</td>
                      <td className="py-3 pr-4 text-slate-700">{item.category}</td>
                      <td className="py-3 pr-4 text-slate-800">{formatUsdFromCents(item.amountCents)}</td>
                      <td className="py-3 pr-4 text-slate-700">{item.billingDay ?? "—"}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.notes ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-4 text-slate-600" colSpan={6}>
                      No manual subscriptions entered yet. Apply the migration, then add ChatGPT, Vercel, Supabase, domains, email, and other fixed costs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
