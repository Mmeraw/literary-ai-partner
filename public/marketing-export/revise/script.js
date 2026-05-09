// Revise — landing page interactivity

(function () {
  "use strict";

  /* -------- Queue item switching -------- */
  // Different opportunities for each queue item, so the demo feels real.
  const cases = {
    1: {
      crumb: "Dialogue · Chapter 11 · river scene",
      title: "Abstract phrasing weakens river-scene tension",
      tags: [
        ["tag-must", "Must"],
        ["tag-spine", "Spine-critical"],
        ["tag-conf", "Moderate confidence"],
      ],
      anchor: "char 1247–1330 · Chapter 11 · river scene",
      quote: { highlight: "It’s okay,", rest: " I whispered. But even as I said it, I knew it wasn’t okay." },
      diagnosis: {
        symptom: "Emotional contradiction is stated directly instead of dramatized.",
        cause:
          "Internal realization duplicates what the dialogue already implies, flattening the moment into commentary.",
        fix: "Replace internal explanation with a physical hesitation or interruption beat.",
        effect: "Tension escalates instead of pausing for narrator gloss.",
        proof:
          "Preserve the speaker’s voice and the dialogue’s rhythm. Do not introduce new information about the river or the listener’s reaction.",
      },
      options: [
        {
          key: "A",
          mech: "Action-beat substitution",
          text: '“It’s okay,” I whispered.\nThe lie caught halfway out.',
          rationale:
            "Replaces internal gloss with a physical reaction; voice fingerprint preserved.",
        },
        {
          key: "B",
          mech: "Interruption beat",
          text: '“It’s okay—”\nMy voice cracked before I could finish.',
          rationale: "Cuts the reassurance mid-line so the failure is heard, not narrated.",
        },
        {
          key: "C",
          mech: "Rendering shift",
          text: '“It’s okay.”\nShe looked at me long enough to know I didn’t believe it.',
          rationale:
            "Lets the listener carry the contradiction; closes the scene with weight.",
        },
      ],
    },
    2: {
      crumb: "Pacing · Chapter 11 · scene close",
      title: "Internal monologue duplicates dialogue subtext",
      tags: [
        ["tag-must", "Must"],
        ["tag-high", "High"],
        ["tag-conf", "High confidence"],
      ],
      anchor: "char 1331–1462 · Chapter 11 · scene close",
      quote: {
        highlight: "I knew it wasn’t okay.",
        rest: " That was the whole problem, really — knowing things and saying nothing.",
      },
      diagnosis: {
        symptom: "Narrator restates the emotional verdict the prior dialogue already delivered.",
        cause: "Pass-through interiority used as a crutch where action would advance the scene.",
        fix: "Cut the recap line; let the next beat carry the consequence.",
        effect: "Scene momentum returns; reader is trusted to hold the contradiction.",
        proof: "Do not remove the next paragraph’s sensory anchors — they are not duplicative.",
      },
      options: [
        {
          key: "A",
          mech: "Excision",
          text: "[remove sentence]\n— scene continues with the next paragraph —",
          rationale: "Cleanest cut. Preserves rhythm by removing the restatement entirely.",
        },
        {
          key: "B",
          mech: "Compression",
          text: "I knew. That was the problem.",
          rationale: "Keeps the cadence but trims the recap to a single fragment.",
        },
        {
          key: "C",
          mech: "Substitution",
          text: "I looked at the river. The river didn’t care.",
          rationale: "Replaces interiority with a sensory beat that re-grounds the scene.",
        },
      ],
    },
    3: {
      crumb: "Golden Spine · cross-chapter",
      title: "Promise opened in Ch. 4 still unresolved at midpoint",
      tags: [
        ["tag-should", "Should"],
        ["tag-medium", "Medium"],
        ["tag-conf", "Moderate confidence"],
      ],
      anchor: "Ch. 4 setup → Ch. 12 expected payoff",
      quote: {
        highlight: "He promised himself he would tell her.",
        rest: " By the time the river scene arrived, he still had not.",
      },
      diagnosis: {
        symptom:
          "A primary character promise is opened in Act I but receives no acknowledgment by midpoint.",
        cause:
          "The narrative spine carries this thread silently rather than tightening pressure on it.",
        fix:
          "Surface the promise in Ch. 12 — even one beat of avoidance, denial, or near-confession.",
        effect: "Pressure continuity is restored across the second-act plateau.",
        proof: "Don’t resolve the promise here. The Ch. 18 payoff still owns that beat.",
      },
      options: [
        {
          key: "A",
          mech: "Avoidance beat",
          text: "He almost said it. He drank instead.",
          rationale: "Lightest possible touch; keeps the promise live without spending it.",
        },
        {
          key: "B",
          mech: "Reader-only acknowledgment",
          text: "(narration) The thing he had promised himself in May had not been said.",
          rationale: "Gives the reader the spine cue without burdening the scene.",
        },
        {
          key: "C",
          mech: "Near-confession",
          text: '“There’s something—” he started. Then the call came in, and he let it go.',
          rationale:
            "Highest leverage: applies pressure visibly without resolving the promise.",
        },
      ],
    },
    4: {
      crumb: "Pacing valley · Ch. 12–14",
      title: "Pressure plateaus across chapters 12–14",
      tags: [
        ["tag-should", "Should"],
        ["tag-medium", "Medium"],
        ["tag-conf", "Moderate confidence"],
      ],
      anchor: "Ch. 12 §3 → Ch. 14 §1 · scene density 0.42",
      quote: {
        highlight: "Three chapters of conversation",
        rest: " separate the inciting confrontation from the next consequence.",
      },
      diagnosis: {
        symptom: "Narrative pressure flattens across the second-act seam.",
        cause:
          "Scene-density drops below 0.5 with no compensating subplot escalation or threat introduction.",
        fix: "Insert one consequence-bearing scene or compress two slow chapters into one.",
        effect: "Reader engagement curve recovers ahead of the Ch. 15 turn.",
        proof: "Preserve the quiet character work in Ch. 13 §2 — that beat earns the later cost.",
      },
      options: [
        {
          key: "A",
          mech: "Compression",
          text: "Merge Ch. 12 §4 into Ch. 13 §1; cut transitional travel.",
          rationale: "Removes a soft seam without losing scene content.",
        },
        {
          key: "B",
          mech: "Escalation insertion",
          text: "Introduce one external pressure event in Ch. 13 — a deadline, a witness, a leak.",
          rationale: "Re-establishes stakes without disturbing existing beats.",
        },
        {
          key: "C",
          mech: "Subplot weave",
          text:
            "Move the Ch. 16 subplot reveal earlier so it resonates against the Ch. 12 confrontation.",
          rationale:
            "Highest leverage; uses material that already exists, rebalances the spine.",
        },
      ],
    },
    5: {
      crumb: "Voice · Ch. 11, p. 132",
      title: "Filtered perception softens close-third POV",
      tags: [
        ["tag-could", "Could"],
        ["tag-local", "Local"],
        ["tag-conf", "High confidence"],
      ],
      anchor: "char 4089–4131 · Ch. 11, p. 132",
      quote: {
        highlight: "She could see the boat",
        rest: " moving downstream, slowly, against the dimming light.",
      },
      diagnosis: {
        symptom:
          "Filter verb (“could see”) inserts narrative distance into a close-third moment.",
        cause: "Habitual perception phrasing; not a deliberate stylistic choice elsewhere.",
        fix: "Drop the filter; render the perception directly.",
        effect: "POV closeness is restored; the image lands without mediation.",
        proof:
          "Do not alter the character’s observational rhythm — only remove the filter verb.",
      },
      options: [
        {
          key: "A",
          mech: "Filter removal",
          text: "The boat moved downstream, slowly, against the dimming light.",
          rationale: "Direct rendering; matches the chapter’s established close-third voice.",
        },
        {
          key: "B",
          mech: "Active substitution",
          text: "She watched the boat move downstream against the dimming light.",
          rationale: "Keeps the act of seeing but as action, not capability.",
        },
        {
          key: "C",
          mech: "Compression",
          text: "Downstream, the boat moved against the dimming light.",
          rationale: "Removes the filter and the perceiver, foregrounding the image itself.",
        },
      ],
    },
    6: {
      crumb: "Prose control · Ch. 11",
      title: "Adverb stack thins on key reassurance line",
      tags: [
        ["tag-could", "Could"],
        ["tag-local", "Local"],
        ["tag-conf", "High confidence"],
      ],
      anchor: "char 1198–1246 · Ch. 11",
      quote: {
        highlight: "she said softly, gently, almost apologetically",
        rest: ", reaching for his hand.",
      },
      diagnosis: {
        symptom: "Three adverbs stack on a single attribution, diluting tonal precision.",
        cause: "Uncertainty about whether dialogue alone carries the emotional weight.",
        fix: "Choose one adverb or replace the stack with a physical beat.",
        effect: "Tone sharpens; reader receives one clear signal instead of three competing ones.",
        proof:
          "Keep the gesture (“reaching for his hand”) — it carries the tonal load on its own.",
      },
      options: [
        {
          key: "A",
          mech: "Single-adverb selection",
          text: "she said gently, reaching for his hand.",
          rationale: "Smallest change; preserves the attribution shape.",
        },
        {
          key: "B",
          mech: "Adverb removal",
          text: "she said, reaching for his hand.",
          rationale: "Lets the gesture do the tonal work; cleanest.",
        },
        {
          key: "C",
          mech: "Beat substitution",
          text: "She reached for his hand. “It’s okay.”",
          rationale: "Reorders so the gesture leads; eliminates attribution overhead.",
        },
      ],
    },
    7: {
      crumb: "WAVE · Act II",
      title: "Thematic propagation thin in Act II",
      tags: [
        ["tag-deferred", "Deferred"],
        ["tag-conf", "Low confidence"],
      ],
      anchor: "Cross-chapter · Ch. 12–17",
      quote: {
        highlight: "The river motif",
        rest:
          " established in Ch. 1, 4, and 11 does not recur with sufficient density across Act II.",
      },
      diagnosis: {
        symptom: "Central motif loses presence in the manuscript’s middle.",
        cause:
          "Act II focuses on consequence rather than image; thematic substrate goes quiet.",
        fix: "Re-thread the motif across two Act-II chapters with light, non-decorative anchors.",
        effect: "Thematic continuity restored without flagging the motif as theme-on-the-nose.",
        proof: "Avoid placing the motif in dialogue. Image-only re-entries.",
      },
      options: [
        {
          key: "A",
          mech: "Image cameo",
          text: "Add a single river-light reflection in Ch. 13 §2 (kitchen window).",
          rationale: "Lightest possible re-entry; preserves Act-II tone.",
        },
        {
          key: "B",
          mech: "Sound cameo",
          text: "Add an off-stage water sound in Ch. 15 §1 (background to scene).",
          rationale: "Sensory substrate without visual repetition.",
        },
        {
          key: "C",
          mech: "Object echo",
          text: "Reintroduce the boat oar (Ch. 4 prop) once in Ch. 16 §3.",
          rationale: "Highest leverage; uses an existing object to carry the motif.",
        },
      ],
    },
  };

  const tagsHost = document.querySelector(".detail-tags");
  const titleEl = document.getElementById("detailTitle");
  const crumbEl = document.querySelector(".detail-head .crumb");
  const blockquoteEl = document.querySelector(".evidence blockquote");
  const anchorEl = document.querySelector(".evidence .anchor");
  const diagnosisEl = document.querySelector(".diagnosis");
  const optionsContainer = document.querySelector(".options");

  function renderCase(id) {
    const c = cases[id];
    if (!c) return;

    crumbEl.textContent = c.crumb;
    titleEl.textContent = c.title;

    // Tags
    tagsHost.innerHTML = c.tags
      .map(([cls, label]) => `<span class="tag ${cls}">${label}</span>`)
      .join("");

    // Quote
    blockquoteEl.innerHTML = `<span class="quote-mark" aria-hidden="true">“</span><span class="quoted-text">${c.quote.highlight}</span>${c.quote.rest}`;
    anchorEl.textContent = c.anchor;

    // Diagnosis
    diagnosisEl.innerHTML = `
      <div><dt>Symptom</dt><dd>${c.diagnosis.symptom}</dd></div>
      <div><dt>Cause</dt><dd>${c.diagnosis.cause}</dd></div>
      <div><dt>Fix direction</dt><dd>${c.diagnosis.fix}</dd></div>
      <div><dt>Reader effect</dt><dd>${c.diagnosis.effect}</dd></div>
      <div><dt>Mistake-proofing</dt><dd>${c.diagnosis.proof}</dd></div>
    `;

    // Options
    optionsContainer.innerHTML = `
      <h4>Three structurally distinct proposals</h4>
      ${c.options
        .map(
          (o) => `
        <article class="option" data-key="${o.key}">
          <header>
            <span class="opt-key">${o.key}</span>
            <span class="opt-mech">${o.mech}</span>
          </header>
          <pre class="proposal">${o.text}</pre>
          <p class="opt-rationale">${o.rationale}</p>
        </article>
      `
        )
        .join("")}
    `;
  }

  document.querySelectorAll(".queue-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".queue-item").forEach((i) => i.classList.remove("is-active"));
      item.classList.add("is-active");
      const id = item.getAttribute("data-id");
      renderCase(id);
      // smooth nudge if user is on small screen
      if (window.innerWidth < 980) {
        document.getElementById("detail").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  /* -------- Filter chips (cosmetic for the demo) -------- */
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
    });
  });

  /* -------- Scroll-aware sticky header -------- */
  const header = document.querySelector(".site-header");
  let lastY = window.scrollY;
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > 8) header.classList.add("is-scrolled");
        else header.classList.remove("is-scrolled");
        lastY = y;
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* -------- Reveal on scroll -------- */
  const reveals = document.querySelectorAll(
    ".section-head, .layer-card, .six-grid li, .gates article, .spine-card, .wave-text, .voice-line, .voice-foot, .cta h2, .cta p, .cta-actions, .workspace"
  );
  reveals.forEach((el) => el.classList.add("reveal"));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.06 }
  );
  reveals.forEach((el) => io.observe(el));

  /* -------- Smooth anchor scroll w/ header offset -------- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 60;
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
  });
})();
