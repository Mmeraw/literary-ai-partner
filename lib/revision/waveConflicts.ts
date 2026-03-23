import {
  type WaveEntry,
  WAVE_REGISTRY,
  getWave,
  getConflictingWaves,
} from "./waveRegistry";

type RevisionMode = "surgical" | "standard" | "deep";

const VALID_WAVE_IDS = new Set<number>(WAVE_REGISTRY.map((wave) => wave.id));

export type ConflictResolution = {
  waveId: number;
  conflictingWaveId: number;
  resolution: "suppress" | "defer" | "merge" | "allow";
  reason: string;
  priority: number;
};

export type ConflictReport = {
  resolvedPairs: ConflictResolution[];
  suppressedWaves: number[];
  deferredWaves: number[];
  mergedGroups: number[][];
};

function normalizeMode(mode: string): RevisionMode {
  if (mode === "surgical" || mode === "standard" || mode === "deep") {
    return mode;
  }
  return "standard";
}

function normalizePlannedWaveIds(waveIds: number[]): number[] {
  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const waveId of waveIds) {
    if (!Number.isInteger(waveId) || seen.has(waveId)) {
      continue;
    }
    if (!VALID_WAVE_IDS.has(waveId)) {
      continue;
    }
    seen.add(waveId);
    normalized.push(waveId);
  }

  return normalized;
}

function compareByExecutionPriority(a: number, b: number): number {
  const waveA = getWave(a);
  const waveB = getWave(b);

  if (!waveA || !waveB) {
    return a - b;
  }

  if (waveA.priority !== waveB.priority) {
    return waveB.priority - waveA.priority;
  }

  return a - b;
}

function areMergeable(a: WaveEntry, b: WaveEntry): boolean {
  if (!a.surgicalAllowed || !b.surgicalAllowed) {
    return false;
  }

  if (a.passSource !== b.passSource) {
    return false;
  }

  if (a.category === b.category) {
    return true;
  }

  return a.scope === b.scope && a.maxEditRadiusSentences <= 8 && b.maxEditRadiusSentences <= 8;
}

function chooseWaveToKeep(
  waveA: WaveEntry,
  waveB: WaveEntry,
  mode: RevisionMode,
): { keep: WaveEntry; suppress: WaveEntry; reason: string } {
  if (mode === "surgical") {
    const scoreA =
      (waveA.surgicalAllowed ? 1000 : 0) + (50 - Math.min(waveA.maxEditRadiusSentences, 50)) + waveA.priority;
    const scoreB =
      (waveB.surgicalAllowed ? 1000 : 0) + (50 - Math.min(waveB.maxEditRadiusSentences, 50)) + waveB.priority;

    if (scoreA !== scoreB) {
      if (scoreA > scoreB) {
        return {
          keep: waveA,
          suppress: waveB,
          reason:
            "Surgical mode prefers narrower edit radius and surgical-safe waves when conflicts are present.",
        };
      }
      return {
        keep: waveB,
        suppress: waveA,
        reason:
          "Surgical mode prefers narrower edit radius and surgical-safe waves when conflicts are present.",
      };
    }
  }

  if (waveA.priority !== waveB.priority) {
    if (waveA.priority > waveB.priority) {
      return {
        keep: waveA,
        suppress: waveB,
        reason: "Conflict resolved by priority: lower-priority wave suppressed.",
      };
    }
    return {
      keep: waveB,
      suppress: waveA,
      reason: "Conflict resolved by priority: lower-priority wave suppressed.",
    };
  }

  if (waveA.id < waveB.id) {
    return {
      keep: waveA,
      suppress: waveB,
      reason: "Conflict tie-breaker applied: lower wave id retained.",
    };
  }

  return {
    keep: waveB,
    suppress: waveA,
    reason: "Conflict tie-breaker applied: lower wave id retained.",
  };
}

class UnionFind {
  private readonly parent: Map<number, number>;

  constructor(ids: readonly number[]) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }

  find(id: number): number {
    const parent = this.parent.get(id);
    if (parent === undefined) {
      this.parent.set(id, id);
      return id;
    }
    if (parent === id) {
      return id;
    }
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) {
      return;
    }
    if (rootA < rootB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootA, rootB);
    }
  }

  groups(ids: readonly number[]): number[][] {
    const grouped = new Map<number, number[]>();

    for (const id of ids) {
      const root = this.find(id);
      const existing = grouped.get(root);
      if (existing) {
        existing.push(id);
      } else {
        grouped.set(root, [id]);
      }
    }

    return [...grouped.values()]
      .map((group) => group.sort((a, b) => a - b))
      .filter((group) => group.length > 1)
      .sort((a, b) => a[0] - b[0]);
  }
}

export function canCoexist(waveA: number, waveB: number): boolean {
  if (waveA === waveB) {
    return true;
  }

  if (!VALID_WAVE_IDS.has(waveA) || !VALID_WAVE_IDS.has(waveB)) {
    return false;
  }

  const conflictsA = new Set(getConflictingWaves(waveA).map((wave) => wave.id));
  const conflictsB = new Set(getConflictingWaves(waveB).map((wave) => wave.id));

  return !conflictsA.has(waveB) && !conflictsB.has(waveA);
}

export function resolveConflicts(
  plannedWaveIds: number[],
  revisionMode: "surgical" | "standard" | "deep",
): ConflictReport {
  const mode = normalizeMode(revisionMode);
  const planned = normalizePlannedWaveIds(plannedWaveIds);

  const resolvedPairs: ConflictResolution[] = [];
  const suppressed = new Set<number>();
  const deferred = new Set<number>();
  const active = new Set<number>(planned);

  if (mode === "surgical") {
    for (const waveId of planned) {
      const wave = getWave(waveId);
      if (!wave) {
        continue;
      }

      if (!wave.surgicalAllowed || wave.maxEditRadiusSentences > 12) {
        suppressed.add(waveId);
        active.delete(waveId);
        resolvedPairs.push({
          waveId,
          conflictingWaveId: -1,
          resolution: "suppress",
          reason:
            "Surgical mode suppression: wave exceeds surgical safety constraints (allowed flag or edit radius).",
          priority: wave.priority,
        });
      }
    }
  }

  for (let i = 0; i < planned.length; i += 1) {
    const leftId = planned[i];
    if (!active.has(leftId)) {
      continue;
    }

    for (let j = i + 1; j < planned.length; j += 1) {
      const rightId = planned[j];
      if (!active.has(rightId)) {
        continue;
      }

      const left = getWave(leftId);
      const right = getWave(rightId);
      if (!left || !right) {
        continue;
      }

      const mutuallyConflicting = !canCoexist(leftId, rightId);
      if (!mutuallyConflicting) {
        continue;
      }

      const decision = chooseWaveToKeep(left, right, mode);
      suppressed.add(decision.suppress.id);
      active.delete(decision.suppress.id);

      resolvedPairs.push({
        waveId: decision.keep.id,
        conflictingWaveId: decision.suppress.id,
        resolution: "suppress",
        reason: decision.reason,
        priority: decision.keep.priority,
      });
    }
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const waveId of [...active]) {
      const wave = getWave(waveId);
      if (!wave) {
        continue;
      }

      const missingDependencies = wave.dependencies.filter((dependencyId) => !active.has(dependencyId));
      if (missingDependencies.length === 0) {
        continue;
      }

      active.delete(waveId);
      if (!suppressed.has(waveId)) {
        deferred.add(waveId);
      }

      resolvedPairs.push({
        waveId,
        conflictingWaveId: missingDependencies[0],
        resolution: "defer",
        reason: `Deferred due to missing dependencies: ${missingDependencies.join(", ")}.`,
        priority: wave.priority,
      });
      changed = true;
    }
  }

  const survivors = [...active].sort((a, b) => a - b);
  const dsu = new UnionFind(survivors);

  for (let i = 0; i < survivors.length; i += 1) {
    const leftId = survivors[i];
    const left = getWave(leftId);
    if (!left) {
      continue;
    }

    for (let j = i + 1; j < survivors.length; j += 1) {
      const rightId = survivors[j];
      const right = getWave(rightId);
      if (!right) {
        continue;
      }

      if (!canCoexist(leftId, rightId)) {
        continue;
      }

      if (!areMergeable(left, right)) {
        continue;
      }

      dsu.union(leftId, rightId);
      resolvedPairs.push({
        waveId: leftId,
        conflictingWaveId: rightId,
        resolution: "merge",
        reason:
          "Waves are mergeable: compatible scope/category with surgical-safe characteristics in same pass.",
        priority: Math.max(left.priority, right.priority),
      });
    }
  }

  return {
    resolvedPairs,
    suppressedWaves: [...suppressed].sort((a, b) => a - b),
    deferredWaves: [...deferred].sort((a, b) => a - b),
    mergedGroups: dsu.groups(survivors),
  };
}

export function buildExecutionPlan(waveIds: number[], mode: string): number[] {
  const normalizedMode = normalizeMode(mode);
  const report = resolveConflicts(waveIds, normalizedMode);
  const blocked = new Set<number>([...report.suppressedWaves, ...report.deferredWaves]);

  const candidates = normalizePlannedWaveIds(waveIds).filter((waveId) => !blocked.has(waveId));
  const candidateSet = new Set<number>(candidates);

  const inDegree = new Map<number, number>();
  const adjacency = new Map<number, number[]>();

  for (const waveId of candidates) {
    inDegree.set(waveId, 0);
    adjacency.set(waveId, []);
  }

  for (const waveId of candidates) {
    const wave = getWave(waveId);
    if (!wave) {
      continue;
    }

    for (const dependencyId of wave.dependencies) {
      if (!candidateSet.has(dependencyId)) {
        continue;
      }

      inDegree.set(waveId, (inDegree.get(waveId) ?? 0) + 1);
      const targets = adjacency.get(dependencyId);
      if (targets) {
        targets.push(waveId);
      } else {
        adjacency.set(dependencyId, [waveId]);
      }
    }
  }

  const ready: number[] = [];
  for (const waveId of candidates) {
    if ((inDegree.get(waveId) ?? 0) === 0) {
      ready.push(waveId);
    }
  }
  ready.sort(compareByExecutionPriority);

  const executionPlan: number[] = [];
  while (ready.length > 0) {
    const nextWaveId = ready.shift();
    if (nextWaveId === undefined) {
      break;
    }

    executionPlan.push(nextWaveId);
    const dependents = adjacency.get(nextWaveId) ?? [];

    for (const dependentId of dependents) {
      const currentDegree = inDegree.get(dependentId) ?? 0;
      const updatedDegree = currentDegree - 1;
      inDegree.set(dependentId, updatedDegree);

      if (updatedDegree === 0) {
        ready.push(dependentId);
      }
    }

    ready.sort(compareByExecutionPriority);
  }

  if (executionPlan.length < candidates.length) {
    const remaining = candidates
      .filter((waveId) => !executionPlan.includes(waveId))
      .sort(compareByExecutionPriority);
    executionPlan.push(...remaining);
  }

  return executionPlan;
}
