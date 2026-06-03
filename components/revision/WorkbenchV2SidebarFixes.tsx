"use client";

import { useEffect } from "react";

const CRITERION_DISPLAY_NAMES_BY_TOKEN: Record<string, string> = {
  CONCEPT: "Concept & Core Premise",
  CONCEPTCOREPREMISE: "Concept & Core Premise",
  "CONCEPT&COREPREMISE": "Concept & Core Premise",
  NARRATIVEDRIVE: "Narrative Drive & Momentum",
  NARRATIVEDRIVEMOMENTUM: "Narrative Drive & Momentum",
  "NARRATIVEDRIVE&MOMENTUM": "Narrative Drive & Momentum",
  CHARACTER: "Character Depth & Psychological Coherence",
  CHARACTERDEPTH: "Character Depth & Psychological Coherence",
  CHARACTERDEPTHPSYCHOLOGICALCOHERENCE: "Character Depth & Psychological Coherence",
  "CHARACTERDEPTH&PSYCHOLOGICALCOHERENCE": "Character Depth & Psychological Coherence",
  VOICE: "Point of View & Voice Control",
  POINTOFVIEWVOICECONTROL: "Point of View & Voice Control",
  "POINTOFVIEW&VOICECONTROL": "Point of View & Voice Control",
  POVVOICECONTROL: "Point of View & Voice Control",
  "POV&VOICECONTROL": "Point of View & Voice Control",
  SCENECONSTRUCTION: "Scene Construction & Function",
  SCENECONSTRUCTIONFUNCTION: "Scene Construction & Function",
  "SCENECONSTRUCTION&FUNCTION": "Scene Construction & Function",
  DIALOGUE: "Dialogue Authenticity & Subtext",
  DIALOGUEAUTHENTICITY: "Dialogue Authenticity & Subtext",
  DIALOGUEAUTHENTICITYSUBTEXT: "Dialogue Authenticity & Subtext",
  "DIALOGUEAUTHENTICITY&SUBTEXT": "Dialogue Authenticity & Subtext",
  THEME: "Thematic Integration",
  THEMATICINTEGRATION: "Thematic Integration",
  WORLDBUILDING: "World-Building & Environmental Logic",
  WORLDBUILDINGENVIRONMENTALLOGIC: "World-Building & Environmental Logic",
  "WORLDBUILDING&ENVIRONMENTALLOGIC": "World-Building & Environmental Logic",
  PACING: "Pacing & Structural Balance",
  PACINGSTRUCTURALBALANCE: "Pacing & Structural Balance",
  "PACING&STRUCTURALBALANCE": "Pacing & Structural Balance",
  PROSECONTROL: "Prose Control & Line-Level Craft",
  PROSECONTROLLINELEVELCRAFT: "Prose Control & Line-Level Craft",
  "PROSECONTROL&LINELEVELCRAFT": "Prose Control & Line-Level Craft",
  TONE: "Tonal Authority & Consistency",
  TONALAUTHORITY: "Tonal Authority & Consistency",
  TONALAUTHORITYCONSISTENCY: "Tonal Authority & Consistency",
  "TONALAUTHORITY&CONSISTENCY": "Tonal Authority & Consistency",
  NARRATIVECLOSURE: "Narrative Closure & Promises Kept",
  NARRATIVECLOSUREPROMISESKEPT: "Narrative Closure & Promises Kept",
  "NARRATIVECLOSURE&PROMISESKEPT": "Narrative Closure & Promises Kept",
  MARKETABILITY: "Professional Readiness & Market Positioning",
  PROFESSIONALREADINESS: "Professional Readiness & Market Positioning",
  PROFESSIONALREADINESSMARKETPOSITIONING: "Professional Readiness & Market Positioning",
  "PROFESSIONALREADINESS&MARKETPOSITIONING": "Professional Readiness & Market Positioning",
};

function normalizeCriterionToken(value: string): string {
  return value
    .replace(/[_\-\s]+/g, "")
    .replace(/AND/gi, "&")
    .toUpperCase();
}

function formatCriterionText(value: string): string {
  return value.replace(/[A-Za-z][A-Za-z_&-]*/g, (token) => {
    const looksMachineGenerated = /[_&-]/.test(token) || /^[A-Z0-9]+$/.test(token) || /[a-z][A-Z]/.test(token);
    if (!looksMachineGenerated) return token;
    return CRITERION_DISPLAY_NAMES_BY_TOKEN[normalizeCriterionToken(token)] ?? token;
  });
}

function findSearchQueueInput(root: HTMLElement): HTMLInputElement | null {
  return Array.from(root.querySelectorAll("input")).find((input) => {
    return (input.getAttribute("placeholder") ?? "").trim().toLowerCase() === "search queue";
  }) as HTMLInputElement | undefined ?? null;
}

function findQueueBadge(root: HTMLElement): HTMLElement | null {
  return Array.from(root.querySelectorAll("span")).find((element) => {
    return /^Queue\s+\d+\/\d+$/i.test((element.textContent ?? "").replace(/\s+/g, " ").trim());
  }) as HTMLElement | undefined ?? null;
}

function findCriteriaSelect(root: HTMLElement): HTMLSelectElement | null {
  return Array.from(root.querySelectorAll("select")).find((select) => {
    return Array.from(select.options).some((option) => {
      return (option.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase() === "all criteria";
    });
  }) as HTMLSelectElement | undefined ?? null;
}

function formatVisibleCriteria(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const before = textNode.nodeValue ?? "";
    const after = formatCriterionText(before);
    if (after !== before) textNode.nodeValue = after;
  }
}

function moveQueueCounterBesideSearchLabel(root: HTMLElement) {
  const input = findSearchQueueInput(root);
  if (!input) return;
  if (!input.id) input.id = "revision-grade-search-queue";

  const filterPanel = input.parentElement as HTMLElement | null;
  if (!filterPanel) return;

  let row = filterPanel.querySelector('[data-rg-search-queue-row="true"]') as HTMLElement | null;
  if (!row) {
    row = document.createElement("div");
    row.dataset.rgSearchQueueRow = "true";
    row.className = "flex items-center justify-between gap-2";
    filterPanel.insertBefore(row, input);
  }

  let label = row.querySelector('[data-rg-search-queue-label="true"]') as HTMLLabelElement | null;
  if (!label) {
    label = document.createElement("label");
    label.dataset.rgSearchQueueLabel = "true";
    label.className = "text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96E]";
    label.textContent = "Search queue";
    row.insertBefore(label, row.firstChild);
  }
  label.htmlFor = input.id;

  const queueBadge = findQueueBadge(root);
  if (!queueBadge) return;

  const previousParent = queueBadge.parentElement as HTMLElement | null;
  if (!row.contains(queueBadge)) row.appendChild(queueBadge);
  queueBadge.textContent = (queueBadge.textContent ?? "").replace(/\s+/g, " ").trim();
  queueBadge.style.marginLeft = "auto";
  if (previousParent && previousParent !== row && previousParent.children.length === 0) previousParent.remove();
}

function labelCriteriaDropdown(root: HTMLElement) {
  const select = findCriteriaSelect(root);
  if (!select) return;
  if (!select.id) select.id = "revision-grade-criteria-filter";
  select.setAttribute("aria-label", "All Criteria");

  for (const option of Array.from(select.options)) {
    option.textContent = formatCriterionText(option.textContent ?? "");
  }

  const previous = select.previousElementSibling as HTMLElement | null;
  if (previous?.dataset.rgCriteriaLabel === "true") return;

  const label = document.createElement("label");
  label.dataset.rgCriteriaLabel = "true";
  label.htmlFor = select.id;
  label.className = "block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96E]";
  label.textContent = "All Criteria";
  select.parentElement?.insertBefore(label, select);
}

function applySidebarFixes(root: HTMLElement) {
  formatVisibleCriteria(root);
  moveQueueCounterBesideSearchLabel(root);
  labelCriteriaDropdown(root);
}

export default function WorkbenchV2SidebarFixes() {
  useEffect(() => {
    const root = document.querySelector(".workbench-v2-route") as HTMLElement | null;
    if (!root) return;

    applySidebarFixes(root);
    const observer = new MutationObserver(() => applySidebarFixes(root));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
