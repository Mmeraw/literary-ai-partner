import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";

type Status = "SCORABLE" | "NOT_APPLICABLE" | "NO_SIGNAL" | "INSUFFICIENT_SIGNAL";
type Signal = "STRONG" | "MODERATE" | "WEAK" | "NONE";
interface V2C {
  key: CriterionKey;
  status: Status;
  score_0_10: number | null;
  signal_strength: Signal;
  rationale: string;
  evidence: { snippet: string }[];
  recommendations: any[];
}

const mkS = (k: CriterionKey, s = 7): V2C => ({
  key: k, status: "SCORABLE", score_0_10: s, signal_strength: "STRONG",
  rationale: "r", evidence: [{ snippet: "ev" }], recommendations: [],
});
const mkNA = (k: CriterionKey): V2C => ({
  key: k, status: "NOT_APPLICABLE", score_0_10: null, signal_strength: "NONE",
  rationale: "na", evidence: [], recommendations: [],
});

function chkScore(cs: V2C[]) {
  return cs.flatMap(c =>
    c.status === "SCORABLE" && (c.score_0_10 === null || c.score_0_10 < 0 || c.score_0_10 > 10)
      ? [c.key + ":bad"]
      : c.status !== "SCORABLE" && c.score_0_10 !== null
        ? [c.key + ":fake"]
        : []
  );
}
function chkSig(cs: V2C[]) {
  return cs.filter(c => c.status === "NOT_APPLICABLE" && c.signal_strength !== "NONE").map(c => c.key);
}
function chkAgg(cs: V2C[], ov: number | null) {
  const s = cs.filter(c => c.status === "SCORABLE");
  return s.length === 0 && ov !== null ? ["fail"] : s.length > 0 && ov === null ? ["fail"] : [];
}
function chkCov(cs: V2C[]) {
  const u = new Set(cs.map(c => c.key));
  return u.size !== 13 ? ["fail"] : [];
}
function chkProv(cs: V2C[], na?: CriterionKey[]) {
  if (!na) return [];
  const a = new Set(cs.filter(c => c.status === "NOT_APPLICABLE").map(c => c.key));
  return na.filter(k => !a.has(k));
}

describe("QG-V2 Observability Invariants", () => {
  it("SCORABLE+numeric, NA+null => pass", () => {
    const cs = [...CRITERIA_KEYS.slice(0, 11).map(k => mkS(k)), mkNA("narrativeClosure" as CriterionKey), mkNA("marketability" as CriterionKey)];
    expect(chkScore(cs)).toEqual([]);
  });
  it("SCORABLE+null => fail", () => {
    const cs = CRITERIA_KEYS.map(k => mkS(k));
    (cs[3] as any).score_0_10 = null;
    expect(chkScore(cs).length).toBe(1);
  });
  it("NA+0 => fail (fake zero)", () => {
    const cs = CRITERIA_KEYS.map(k => mkS(k));
    cs[11] = mkNA("narrativeClosure" as CriterionKey);
    (cs[11] as any).score_0_10 = 0;
    expect(chkScore(cs).length).toBe(1);
  });
  it("NA+NONE signal => pass", () => {
    expect(chkSig([...CRITERIA_KEYS.slice(0, 12).map(k => mkS(k)), mkNA("marketability" as CriterionKey)])).toEqual([]);
  });
  it("NA+WEAK signal => fail", () => {
    const cs = CRITERIA_KEYS.map(k => mkS(k));
    cs[12] = mkNA("marketability" as CriterionKey);
    (cs[12] as any).signal_strength = "WEAK";
    expect(chkSig(cs).length).toBe(1);
  });
  it("0 scored + null overall => pass", () => {
    expect(chkAgg(CRITERIA_KEYS.map(k => mkNA(k)), null)).toEqual([]);
  });
  it("0 scored + 70 overall => fail", () => {
    expect(chkAgg(CRITERIA_KEYS.map(k => mkNA(k)), 70).length).toBe(1);
  });
  it("13 unique keys => pass", () => {
    expect(chkCov(CRITERIA_KEYS.map(k => mkS(k)))).toEqual([]);
  });
  it("governed NA matches actual => pass", () => {
    const cs = [...CRITERIA_KEYS.slice(0, 11).map(k => mkS(k)), mkNA("narrativeClosure" as CriterionKey), mkNA("marketability" as CriterionKey)];
    expect(chkProv(cs, ["narrativeClosure", "marketability"] as CriterionKey[])).toEqual([]);
  });
  it("chapter-excerpt combined pass", () => {
    const cs = CRITERIA_KEYS.map(k => k === "narrativeClosure" || k === "pacing" ? mkNA(k) : mkS(k));
    expect(chkScore(cs)).toEqual([]);
    expect(chkSig(cs)).toEqual([]);
    expect(chkAgg(cs, 68)).toEqual([]);
    expect(chkCov(cs)).toEqual([]);
  });
});
