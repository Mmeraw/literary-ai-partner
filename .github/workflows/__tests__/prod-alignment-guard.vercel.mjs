// Pure decision function mirroring the Vercel verification logic in
// .github/workflows/prod-alignment-guard.yml (the "Verify Vercel production
// deployment at expected SHA" step). Exported as a pure function so the
// fail-closed contract can be unit-tested with fixtures — the workflow itself
// still performs the HTTP calls / polling inline. If you change one, change the
// other; prod-alignment-guard.vercel.test.mjs guards the contract.
//
// Contract proven: production is aligned ONLY when the deployment attached to
// the configured production alias is READY *and* its meta.githubCommitSha
// equals the expected origin/main SHA. Because the decision is anchored to what
// the alias routes to, a READY deployment for the SHA that is not the alias
// target can never pass — it fails closed. Uses stable Vercel JSON shapes only
// (v4 aliases, v13 deployments); never scrapes `vercel inspect` text.

export const VERDICT = {
  OK: "OK",
  MALFORMED_ALIAS: "MALFORMED_ALIAS",
  ALIAS_ERROR: "ALIAS_ERROR",
  ALIAS_NOT_FOUND: "ALIAS_NOT_FOUND",
  ALIAS_NO_DEPLOYMENT: "ALIAS_NO_DEPLOYMENT",
  MALFORMED_DEPLOYMENT: "MALFORMED_DEPLOYMENT",
  DEPLOYMENT_ERROR: "DEPLOYMENT_ERROR",
  PROJECT_MISMATCH: "PROJECT_MISMATCH",
  NOT_READY: "NOT_READY",
  SHA_MISMATCH: "SHA_MISMATCH",
};

// Codes that may still converge while Vercel finishes building/promoting (the
// workflow's poll loop keeps retrying these). Everything else is a hard error
// that fails closed immediately.
const RETRYABLE = new Set([
  VERDICT.ALIAS_NOT_FOUND,
  VERDICT.ALIAS_NO_DEPLOYMENT,
  VERDICT.NOT_READY,
  VERDICT.SHA_MISMATCH,
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function verdict(code, message, extra = {}) {
  return {
    ok: code === VERDICT.OK,
    code,
    message,
    retryable: RETRYABLE.has(code),
    deployment: null,
    ...extra,
  };
}

// Extract the deployment id an alias points to (mirrors the workflow's
// `.deployment.id // .deployment.uid // .deploymentId` jq expression).
export function resolveAliasDeploymentId(aliasResult, alias) {
  if (!isObject(aliasResult) || typeof aliasResult.status !== "number") {
    return {
      deploymentId: null,
      hardError: verdict(
        VERDICT.MALFORMED_ALIAS,
        `Malformed alias lookup result for ${alias} (expected { status, body }).`,
      ),
    };
  }
  const { status, body } = aliasResult;
  if (status === 404) return { deploymentId: null, hardError: null };
  if (status < 200 || status >= 300) {
    const hint =
      status === 403
        ? " Vercel token cannot inspect the configured production alias. For team-owned projects set VERCEL_TEAM_ID and ensure the token has team/project/alias access."
        : "";
    return {
      deploymentId: null,
      hardError: verdict(
        VERDICT.ALIAS_ERROR,
        `Failed to resolve Vercel production alias ${alias} (HTTP ${status}).${hint}`,
      ),
    };
  }
  if (!isObject(body)) {
    return {
      deploymentId: null,
      hardError: verdict(
        VERDICT.MALFORMED_ALIAS,
        `Malformed Vercel alias response for ${alias} (expected a JSON object).`,
      ),
    };
  }
  const deploymentId =
    (isObject(body.deployment) && (body.deployment.id || body.deployment.uid)) ||
    body.deploymentId ||
    null;
  return { deploymentId: deploymentId || null, hardError: null };
}

// Evaluate the alias-attached deployment against the expected SHA/project
// (mirrors the workflow's readyState/sha/projectId checks).
export function evaluateDeployment({
  deploymentResult,
  deploymentId,
  expectedSha,
  projectId,
  alias,
}) {
  if (!isObject(deploymentResult) || typeof deploymentResult.status !== "number") {
    return verdict(
      VERDICT.MALFORMED_DEPLOYMENT,
      `Malformed deployment lookup result for ${deploymentId} (expected { status, body }).`,
    );
  }
  const { status, body } = deploymentResult;
  if (status < 200 || status >= 300) {
    const hint =
      status === 403
        ? " Vercel token cannot read the alias-attached deployment. For team-owned projects set VERCEL_TEAM_ID and ensure the token has deployment read access."
        : "";
    return verdict(
      VERDICT.DEPLOYMENT_ERROR,
      `Failed to inspect Vercel deployment ${deploymentId} (HTTP ${status}).${hint}`,
    );
  }
  if (!isObject(body)) {
    return verdict(
      VERDICT.MALFORMED_DEPLOYMENT,
      `Malformed Vercel deployment response for ${deploymentId} (expected a JSON object).`,
    );
  }

  const readyState = body.readyState || body.state || "UNKNOWN";
  const sha =
    isObject(body.meta) && typeof body.meta.githubCommitSha === "string"
      ? body.meta.githubCommitSha
      : "";
  const url = typeof body.url === "string" ? body.url : "";
  const deployProjectId =
    body.projectId || (isObject(body.project) && body.project.id) || "";
  const deployment = {
    id: deploymentId,
    readyState,
    sha,
    url,
    projectId: deployProjectId || "",
  };

  if (deployProjectId && deployProjectId !== projectId) {
    return verdict(
      VERDICT.PROJECT_MISMATCH,
      `Alias ${alias} points to project ${deployProjectId}, expected ${projectId}.`,
      { deployment },
    );
  }
  if (readyState !== "READY") {
    return verdict(
      VERDICT.NOT_READY,
      `Alias-attached deployment ${deploymentId} is ${readyState}, not READY (sha=${sha || "<none>"}).`,
      { deployment },
    );
  }
  if (sha !== expectedSha) {
    return verdict(
      VERDICT.SHA_MISMATCH,
      `Alias-attached deployment ${deploymentId} is READY but at sha ${sha || "<none>"}, expected ${expectedSha}.`,
      { deployment },
    );
  }
  return verdict(
    VERDICT.OK,
    `Vercel production alias ${alias} routes to READY deployment ${deploymentId} at expected sha ${expectedSha}.`,
    { deployment },
  );
}

// Full pure decision over the alias and (optional) deployment API results.
// When the alias resolves to a deployment id, `deploymentResult` must be
// supplied. Shape of each result: { status: number, body: any }.
export function evaluateVercelAlignment({
  expectedSha,
  projectId,
  alias,
  aliasResult,
  deploymentResult,
}) {
  const { deploymentId, hardError } = resolveAliasDeploymentId(aliasResult, alias);
  if (hardError) return hardError;
  if (deploymentId === null) {
    const aliasStatus = isObject(aliasResult) ? aliasResult.status : undefined;
    if (aliasStatus === 404) {
      return verdict(
        VERDICT.ALIAS_NOT_FOUND,
        `Production alias ${alias} does not exist yet (HTTP 404); no deployment is live for it.`,
      );
    }
    return verdict(
      VERDICT.ALIAS_NO_DEPLOYMENT,
      `Production alias ${alias} resolved but is not attached to any deployment.`,
    );
  }
  return evaluateDeployment({
    deploymentResult,
    deploymentId,
    expectedSha,
    projectId,
    alias,
  });
}
