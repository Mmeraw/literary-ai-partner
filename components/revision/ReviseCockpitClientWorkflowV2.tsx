"use client";

import { useEffect, useRef } from "react";
import type { WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import ReviseCockpitClientWorkflowV1 from "./ReviseCockpitClientWorkflowV1";

const FETCH_PATCH_FLAG = "__revisionGradeChicagoFetchGuardInstalled";
const CLIPBOARD_PATCH_FLAG = "__revisionGradeChicagoClipboardGuardInstalled";

type GuardedWindow = Window & Record<typeof FETCH_PATCH_FLAG | typeof CLIPBOARD_PATCH_FLAG, boolean | undefined>;

function guardedWindow(): GuardedWindow {
  return window as unknown as GuardedWindow;
}

function normalizeSetupForDialogue(value: string): string {
  return value
    .replace(/[,;:—–-]+$/u, "")
    .replace(/[.!?]+$/u, "")
    .trim();
}

function cleanCopy(value: string): string {
  let next = value
    .replace(/^\s*[?¿]+\s*/g, "")
    .replace(/Symptom:\s*[?¿]+\s*/g, "Symptom: ")
    .replace(/Fix:\s*[?¿]+\s*/g, "Fix: ")
    .replace(/\bthe room heard the hurt underneath\b/gi, "the others caught the hurt underneath")
    .replace(/\bthe room\b/gi, "the clearing")
    .replace(/\broom\b/gi, "clearing")
    .replace(/\beveryone\b/gi, "the others")
    .replace(/\s+/g, " ")
    .trim();

  // Chicago-style punctuation hygiene for generated candidate prose.
  next = next
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*\./g, ".")
    .replace(/\.\s*,/g, ".")
    .replace(/,{2,}/g, ",")
    .replace(/\.{2,}/g, ".")
    .replace(/,\s*([”"])/g, "$1")
    .replace(/([“"])([^”"]+?)[.!?][”"]\s+([A-Z][A-Za-z’'\-]+\s+(?:said|asked|whispered|muttered|shouted|called|cried))\./gu, "$1$2,” $3.")
    .replace(/([“"])([^”"]+?),[”"]\s+([A-Z][A-Za-z’'\-]+\s+(?:said|asked|whispered|muttered|shouted|called|cried))\./gu, "$1$2,” $3.")
    .replace(/([A-Z][A-Za-z’'\-]+\s+(?:said|asked|whispered|muttered|shouted|called|cried)),\s*([“"])([^”"]+?),[”"]?/gu, "$1, $2$3.”")
    .replace(/([“"][^”"]+[.!?][”"])\s+([A-Z][A-Za-z’'\-]+\s+(?:said|asked|whispered|muttered|shouted|called|cried))\./gu, (_match, quote: string, tag: string) => {
      const inner = quote.slice(1, -1).replace(/[.!?]+$/u, "");
      return `${quote[0]}${inner},” ${tag}.`;
    });

  // Specific generated-compression repair: "Once the air cleared,. “I want...” Brutus said."
  next = next.replace(
    /^(Once the air cleared)[,.]*\s+[“"]([^”"]+?)[.!?]?[”"]\s+(Brutus\s+said)\.?$/iu,
    (_match, setup: string, speech: string, tag: string) => `${normalizeSetupForDialogue(setup)}, “${speech.trim()},” ${tag}.`,
  );

  next = next.replace(/(:\s+)([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  return next.trim();
}

function cleanVisibleText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  for (const textNode of nodes) {
    const before = textNode.nodeValue ?? "";
    const after = cleanCopy(before);
    if (after !== before) textNode.nodeValue = after;
  }
}

function hideSuggestedLabels(root: HTMLElement) {
  for (const element of Array.from(root.querySelectorAll("p,span,div")) as HTMLElement[]) {
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().toUpperCase();
    if (text === "SUGGESTED INSERTIONS" || text === "SUGGESTED REPLACEMENTS" || text === "SUGGESTED REVISIONS") {
      element.style.display = "none";
    }
  }
}

function hideAuthorFacingInternalStatuses(root: HTMLElement) {
  for (const element of Array.from(root.querySelectorAll("span")) as HTMLElement[]) {
    const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
    const upper = text.toUpperCase();
    const shouldHide =
      /^READY(?:\s+\d+)?$/i.test(text)
      || /^NEEDS TARGETING(?:\s+\d+)?$/i.test(text)
      || /^PENDING(?:\s+\d+)?$/i.test(text)
      || /^ACCEPTED(?:\s+\d+)?$/i.test(text)
      || upper === "UNREADY";

    if (shouldHide) {
      element.style.display = "none";
      element.dataset.rgInternalStatusHidden = "true";
    }
  }
}

function styleWorkbenchManuscriptTitle(root: HTMLElement) {
  const title = root.querySelector("main > div > header h1") as HTMLElement | null;
  if (!title) return;

  const header = title.closest("header") as HTMLElement | null;
  const titleBlock = title.parentElement as HTMLElement | null;
  const pillRail = titleBlock?.nextElementSibling as HTMLElement | null;

  if (header) {
    header.style.height = "auto";
    header.style.minHeight = "3.75rem";
    header.style.gap = "0.75rem";
    header.style.overflow = "hidden";
  }

  if (titleBlock) {
    titleBlock.style.flex = "1 1 auto";
    titleBlock.style.minWidth = "0";
    titleBlock.style.overflow = "hidden";
  }

  if (pillRail) {
    pillRail.style.flex = "0 0 auto";
    pillRail.style.minWidth = "max-content";
  }

  title.style.display = "block";
  title.style.maxWidth = "100%";
  title.style.overflow = "visible";
  title.style.textOverflow = "unset";
  title.style.whiteSpace = "normal";
  title.style.wordBreak = "break-word";
  title.style.fontSize = "clamp(1.2rem, 1.15vw + 0.85rem, 1.6rem)";
  title.style.lineHeight = "1.12";
  title.style.fontWeight = "700";
}

function styleLedgerTable(ledger: HTMLElement) {
  ledger.style.gridColumn = "1 / -1";
  ledger.style.overflowX = "hidden";
  ledger.style.minWidth = "0";
  ledger.style.display = "block";

  const table = ledger.querySelector("table") as HTMLTableElement | null;
  if (table) {
    table.style.tableLayout = "fixed";
    table.style.width = "100%";
    table.style.minWidth = "0";
    for (const cell of Array.from(table.querySelectorAll("th,td")) as HTMLElement[]) {
      cell.style.overflow = "hidden";
      cell.style.textOverflow = "ellipsis";
      cell.style.whiteSpace = "nowrap";
    }
  }
}

function collapseLedger(ledger: HTMLElement) {
  if (ledger.dataset.rgCollapsed === "true") return;

  const tableContainer = ledger.querySelector("div.max-h-32, div[class*='overflow-y-auto']") as HTMLElement | null;
  const scrollDiv = tableContainer ?? (ledger.querySelector("table")?.parentElement as HTMLElement | null);
  if (scrollDiv) {
    scrollDiv.style.maxHeight = "2.2rem";
    scrollDiv.style.overflow = "hidden";
    scrollDiv.dataset.rgLedgerScroll = "true";
  }

  const filterButtons = ledger.querySelectorAll("button") as NodeListOf<HTMLElement>;
  for (const btn of Array.from(filterButtons)) {
    const text = (btn.textContent ?? "").trim();
    if (text !== "Expand" && text !== "Collapse" && !btn.dataset.rgToggle) {
      btn.style.display = "none";
      btn.dataset.rgLedgerFilter = "true";
    }
  }

  if (!ledger.querySelector("[data-rg-toggle]")) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.dataset.rgToggle = "true";
    toggle.textContent = "Expand";
    toggle.className = "ml-auto rounded border border-[#5D4C31] px-2 py-0.5 text-[10px] text-[#C8A96E] hover:bg-[#2A2115]";
    toggle.addEventListener("click", () => {
      const isCollapsed = ledger.dataset.rgCollapsed === "true";
      if (isCollapsed) {
        expandLedger(ledger);
      } else {
        collapseLedger(ledger);
      }
    });
    const headerRow = ledger.querySelector("div.mb-2, div:first-child") as HTMLElement | null;
    if (headerRow) {
      headerRow.style.display = "flex";
      headerRow.style.alignItems = "center";
      headerRow.style.flexWrap = "wrap";
      headerRow.appendChild(toggle);
    }
  }

  ledger.dataset.rgCollapsed = "true";
}

function expandLedger(ledger: HTMLElement) {
  const scrollDiv = ledger.querySelector("[data-rg-ledger-scroll]") as HTMLElement | null;
  if (scrollDiv) {
    scrollDiv.style.maxHeight = "8rem";
    scrollDiv.style.overflow = "auto";
  }

  const filterButtons = ledger.querySelectorAll("[data-rg-ledger-filter]") as NodeListOf<HTMLElement>;
  for (const btn of Array.from(filterButtons)) {
    btn.style.display = "";
  }

  const toggle = ledger.querySelector("[data-rg-toggle]") as HTMLElement | null;
  if (toggle) toggle.textContent = "Collapse";

  ledger.dataset.rgCollapsed = "false";
}

function widenLedger(root: HTMLElement) {
  const ledgerLabel = Array.from(root.querySelectorAll("span,p,div")).find((element) => {
    return (element.textContent ?? "").replace(/\s+/g, " ").trim().toUpperCase() === "REVISION LEDGER";
  }) as HTMLElement | undefined;
  const ledger = ledgerLabel?.closest("section") as HTMLElement | null;
  if (!ledger) return;

  if (ledger.dataset.rgMoved === "true") {
    styleLedgerTable(ledger);
    if (!ledger.dataset.rgCollapsed) collapseLedger(ledger);
    return;
  }

  const workspacePane = ledger.parentElement as HTMLElement | null;
  const workbenchGrid = workspacePane?.parentElement as HTMLElement | null;
  if (!workspacePane || !workbenchGrid) return;

  workspacePane.dataset.rgWorkspacePane = "true";
  workbenchGrid.appendChild(ledger);
  workbenchGrid.style.display = "grid";
  workbenchGrid.style.gridTemplateColumns = "310px minmax(0, 1fr)";
  workbenchGrid.style.gridTemplateRows = "minmax(0, 1fr) auto";
  workbenchGrid.style.overflow = "hidden";
  ledger.dataset.rgMoved = "true";
  styleLedgerTable(ledger);
  collapseLedger(ledger);
}

function queueIsComplete(root: HTMLElement): boolean {
  return Array.from(root.querySelectorAll("span")).some((element) => {
    return (element.textContent ?? "").replace(/\s+/g, " ").trim() === "Queue 0/0";
  });
}

function createBlankWorkspace(): HTMLElement {
  const blank = document.createElement("div");
  blank.dataset.rgCompleteWorkspace = "true";
  blank.className = "m-3 rounded-xl border border-[#2E261A] bg-[#12100B] p-6 text-[#CBBDA4]";
  const title = document.createElement("p");
  title.className = "text-sm font-semibold text-[#F5EFE4]";
  title.textContent = "All open revision opportunities have been moved to the ledger.";
  const note = document.createElement("p");
  note.className = "mt-2 text-sm";
  note.textContent = "Review the ledger below, use Unselect to return an item to the queue, or open Final Review to apply and export.";
  blank.appendChild(title);
  blank.appendChild(note);
  return blank;
}

function resetCompletedLayout(workspace: HTMLElement) {
  const grid = workspace.parentElement as HTMLElement | null;
  if (grid) grid.style.gridTemplateRows = "minmax(0, 1fr) auto";
}

function useLedgerFirstLayout(workspace: HTMLElement) {
  const grid = workspace.parentElement as HTMLElement | null;
  if (grid) grid.style.gridTemplateRows = "auto minmax(0, 1fr)";
}

function blankCompletedWorkspace(root: HTMLElement) {
  const workspace = root.querySelector('[data-rg-workspace-pane="true"]') as HTMLElement | null;
  if (!workspace) return;

  const existing = workspace.querySelector('[data-rg-complete-workspace="true"]') as HTMLElement | null;
  if (!queueIsComplete(root)) {
    existing?.remove();
    resetCompletedLayout(workspace);
    for (const child of Array.from(workspace.children) as HTMLElement[]) {
      child.style.display = "";
    }
    return;
  }

  useLedgerFirstLayout(workspace);
  for (const child of Array.from(workspace.children) as HTMLElement[]) {
    if (child.dataset.rgCompleteWorkspace !== "true") child.style.display = "none";
  }

  if (!existing) workspace.appendChild(createBlankWorkspace());
}

function cleanRevisionLedgerRequestBody(body: BodyInit | null | undefined): BodyInit | null | undefined {
  if (typeof body !== "string") return body;
  try {
    const parsed = JSON.parse(body) as { entries?: Array<Record<string, unknown>> };
    if (!Array.isArray(parsed.entries)) return body;

    parsed.entries = parsed.entries.map((entry) => ({
      ...entry,
      selectedText: typeof entry.selectedText === "string" ? cleanCopy(entry.selectedText) : entry.selectedText,
      customText: typeof entry.customText === "string" ? cleanCopy(entry.customText) : entry.customText,
    }));

    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

function installChicagoFetchGuard() {
  if (typeof window === "undefined") return;
  const win = guardedWindow();
  if (win[FETCH_PATCH_FLAG]) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/api/revision-ledger") && init?.body) {
      return originalFetch(input, { ...init, body: cleanRevisionLedgerRequestBody(init.body) });
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;

  win[FETCH_PATCH_FLAG] = true;
}

function installChicagoClipboardGuard() {
  if (typeof window === "undefined" || !navigator.clipboard?.writeText) return;
  const win = guardedWindow();
  if (win[CLIPBOARD_PATCH_FLAG]) return;

  const originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = ((text: string) => originalWriteText(cleanCopy(text))) as typeof navigator.clipboard.writeText;
  win[CLIPBOARD_PATCH_FLAG] = true;
}

function apply(root: HTMLElement) {
  cleanVisibleText(root);
  hideSuggestedLabels(root);
  hideAuthorFacingInternalStatuses(root);
  styleWorkbenchManuscriptTitle(root);
  widenLedger(root);
  blankCompletedWorkspace(root);
}

export default function ReviseCockpitClientWorkflowV2({ payload }: { payload: WorkbenchQueuePayload }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    installChicagoFetchGuard();
    installChicagoClipboardGuard();
    apply(root);
    const observer = new MutationObserver(() => apply(root));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}><ReviseCockpitClientWorkflowV1 payload={payload} /></div>;
}
