**🔥 WAVE 31 (EXPANDED)**

**Scene-to-Scene Pressure Carry Engine**

This is not a light wave.
This is **one of your system-defining waves**.

Wave 31 ensures:

Every scene inherits unresolved pressure from the previous scene and **adds to it**.

Without this:
👉 chapters feel episodic
👉 tension resets
👉 stakes flatten

With this:
👉 momentum compounds
👉 reader cannot disengage

**🧠 CORE DOCTRINE**

**Pressure must:**

1. **Persist** (never reset to zero)
2. **Transform** (change shape, not disappear)
3. **Escalate OR Complicate** (never stagnate)

**🧩 WHAT THIS WAVE DETECTS**

Across scene boundaries:

**1. Unresolved Tension Threads**

* Threats
* Questions
* Emotional instability
* Power imbalance
* Physical danger

**2. Pressure Drop Events (BAD)**

* Scene opens calm after high tension
* Emotional reset
* Stakes forgotten
* New scene ignores prior consequence

**3. Pressure Continuity (GOOD)**

* Carry-over anxiety
* Lingering consequence
* Escalated stakes
* Compounding decisions

**⚙️ TYPE DEFINITIONS**

type PressureThread = {
 id: string;
 type: "physical" | "emotional" | "psychological" | "external" | "moral";
 intensity: number; // 0–100
 resolved: boolean;
 originScene: number;
};

type ScenePressureState = {
 sceneIndex: number;
 incomingPressure: number;
 outgoingPressure: number;
 threads: PressureThread[];
};

type Wave31Result = {
 issues: {
 type: "pressure\_drop" | "thread\_loss" | "false\_reset";
 sceneIndex: number;
 message: string;
 severity: "low" | "medium" | "high";
 }[];
 suggestions: {
 sceneIndex: number;
 action: "carry\_forward" | "escalate" | "convert" | "delay\_resolution";
 note: string;
 }[];
};

**🔍 DETECTION LOGIC**

export function runWave31(
 scenes: Scene[],
 context: WaveContext
): Wave31Result {

 const issues = [];
 const suggestions = [];

 let previousState: ScenePressureState | null = null;

 scenes.forEach((scene, index) => {
 const currentThreads = extractPressureThreads(scene);
 const incomingPressure = previousState?.outgoingPressure ?? 0;

 const outgoingPressure = calculatePressure(currentThreads);

 // 🚨 DETECT PRESSURE DROP
 if (incomingPressure > 60 && outgoingPressure < 30) {
 issues.push({
 type: "pressure\_drop",
 sceneIndex: index,
 message: "High tension dropped without resolution",
 severity: "high"
 });

 suggestions.push({
 sceneIndex: index,
 action: "carry\_forward",
 note: "Maintain unresolved tension into this scene opening"
 });
 }

 // 🚨 DETECT THREAD LOSS
 if (previousState) {
 const lostThreads = previousState.threads.filter(t =>
 !t.resolved && !currentThreads.some(ct => ct.id === t.id)
 );

 if (lostThreads.length > 0) {
 issues.push({
 type: "thread\_loss",
 sceneIndex: index,
 message: "Unresolved tension threads disappeared",
 severity: "high"
 });

 suggestions.push({
 sceneIndex: index,
 action: "convert",
 note: "Transform prior tension into new form instead of dropping it"
 });
 }
 }

 previousState = {
 sceneIndex: index,
 incomingPressure,
 outgoingPressure,
 threads: currentThreads
 };
 });

 return { issues, suggestions };
}

**🧪 HELPER LOGIC (CRITICAL)**

**Extract Threads**

function extractPressureThreads(scene: Scene): PressureThread[] {
 // heuristic or AI-assisted extraction later
 return scene.tensions.map(t => ({
 id: t.id,
 type: t.type,
 intensity: t.intensity,
 resolved: t.resolved,
 originScene: scene.index
 }));
}

**Pressure Score**

function calculatePressure(threads: PressureThread[]): number {
 return threads.reduce((sum, t) => sum + t.intensity, 0) / (threads.length || 1);
}

**✍️ TEXT-LEVEL ENFORCEMENT (IMPORTANT)**

This wave should ALSO inject **micro-edits**:

**BAD:**

Scene opens neutral after chaos

**FIX:**

* Add:
  + physical residue
  + emotional carry
  + interrupted thought
  + consequence echo

**Example Transform**

**Before:**

The next morning was quiet.

**After:**

The next morning didn’t feel like morning. The noise was gone, but it hadn’t left him.

**🔥 PRIORITY RULE (IMPORTANT)**

Wave 31 should run:

priority: HIGH
phase: "post-structure"
order: before Wave 33–40

Because:
👉 pacing depends on pressure continuity

**⚠️ INTERACTIONS WITH OTHER WAVES**

**With Wave 33–40 (pacing spine)**

* Wave 31 feeds it
* If 31 fails → 33–40 becomes cosmetic

**With Wave 55 (kill switch)**

* 55 may remove weak lines
* 31 ensures **pressure is preserved after removal**

**🚫 WHAT THIS WAVE MUST NEVER DO**

* Resolve tension prematurely
* Add new stakes without linking to prior ones
* Rewrite entire scenes (respect revisionMode)

**🔒 SURGICAL MODE ENFORCEMENT**

if (context.revisionMode === "surgical") {
 // only allow additions or small continuity fixes
 // no structural rewrites
}

**🧠 RESULT**

After Wave 31:

👉 Every scene feels like a continuation
👉 No emotional or narrative reset
👉 Reader feels **constant forward pull**
