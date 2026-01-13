import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const BASE_URL = Deno.env.get("BASE44_API_URL") || "http://localhost:8000";
const FUNCTION_URL = `${BASE_URL}/functions/evaluateQuickSubmission`;

Deno.test("Sample Scope: No dialogue → Dialogue = NA", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "No Dialogue Test",
      text: "Huhu crouched low. Her hands gripped the earth. She tasted fear and copper. Something in her rose, stubborn and fierce. The Unshaped were near—she heard their heavy breathing, the scrape of massive feet. A hunter staggered past, bloodied and triumphant. Ormak stood apart, watching with wet, furious eyes. He did not join the killing. In his stillness, something sacred emerged.",
      styleMode: "neutral",
      final_work_type_used: "flash_fiction"
    })
  });

  const result = await response.json();
  
  // ASSERT: Dialogue must be NA when no dialogue present
  const dialogueCriterion = result.evaluation.criteria.find(c => c.criterion_id === 'dialogue');
  assertEquals(dialogueCriterion, undefined, "Dialogue should not be scored when no dialogue exists");
  
  const naCriteria = result.evaluation.work_type_routing.na_criteria;
  assertExists(naCriteria.includes('dialogue'), "Dialogue should be in NA list");
});

Deno.test("Sample Scope: S1 micro → Max 7 criteria scored", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "S1 Scope Test",
      text: "She felt the world shift. Tension coiled in her chest. The air hummed with danger she couldn't name yet. This moment—brief, sharp—would define everything. Her hands trembled. Not from fear. From the weight of what came next.",
      styleMode: "neutral",
      final_work_type_used: "flash_fiction"
    })
  });

  const result = await response.json();
  const scoredCount = result.evaluation.criteria.filter(c => c.score !== null).length;
  
  assertEquals(scoredCount <= 7, true, `S1 scope should score max 7 criteria, got ${scoredCount}`);
});