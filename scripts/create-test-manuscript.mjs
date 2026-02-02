#!/usr/bin/env node
/**
 * Create Test Manuscript in Supabase
 * 
 * Creates a realistic 250k word test manuscript for use in CI smoke tests.
 * Returns the manuscript ID for use in job creation.
 * 
 * Usage:
 *   node scripts/create-test-manuscript.mjs
 *   
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

// Sample realistic prose
const PARAGRAPH = `The morning sun broke through the eastern windows, casting long shadows across the marble floors. Eleanor stood at the threshold of her ancestral home, feeling the weight of centuries pressing down upon her shoulders. The house had been in her family for over three hundred years, and now it was hers alone. She walked slowly through the grand entrance hall, her footsteps echoing in the emptiness. The portraits of her ancestors lined the walls, their painted eyes seeming to follow her as she passed. Each face told a story of triumph, of tragedy, of secrets buried deep within the foundations of this ancient house.`;

/**
 * Generate ~250k words of realistic manuscript text
 */
function generateManuscriptText(targetWords = 250000) {
  const paragraphWords = PARAGRAPH.split(/\s+/).length;
  const repetitions = Math.ceil(targetWords / paragraphWords);
  
  const paragraphs = [];
  for (let i = 0; i < repetitions; i++) {
    paragraphs.push(PARAGRAPH);
  }
  
  return paragraphs.join('\n\n');
}

async function main() {
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  console.log("Creating test manuscript...");

  // Generate manuscript text
  const body_text = generateManuscriptText(250000);
  const word_count = body_text.split(/\s+/).length;

  console.log(`Generated ${word_count.toLocaleString()} words (${(body_text.length / 1024 / 1024).toFixed(2)} MB)`);

  // Insert manuscript
  const { data, error } = await supabase
    .from("manuscripts")
    .insert({
      title: "CI Smoke Test Manuscript - 250k words",
      body_text,
      word_count,
      work_type: "novel",
      is_test: true, // Flag for easy cleanup
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create test manuscript: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Failed to create test manuscript: no id returned");
  }

  console.log(`✅ Test manuscript created: ID = ${data.id}`);
  console.log(JSON.stringify({ manuscript_id: data.id }));
  
  return data.id;
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
