"use client";

import { useEffect, useRef } from "react";
import type { WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import ReviseCockpitClientWorkflowV1 from "./ReviseCockpitClientWorkflowV1";

function cleanCopy(value: string): string {
  let next = value
    .replace(/^\s*[?¿]+\s*/g, "")
    .replace(/Symptom:\s*[?¿]+\s*/g, "Symptom: ")
    .replace(/Fix:\s*[?¿]+\s*/g, "Fix: ")
    .replace(/\bthe room heard the hurt underneath\b/gi, "the others caught the hurt underneath")
    .replace(/\bthe room\b/gi, "the clearing")
    .replace(/\broom\b/gi, "clearing")
    .replace(/\beveryone\b/gi, "the others");

  next = next.replace(/(:\s+)([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  return next;
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

function widenLedger(root: HTMLElement) {
  const ledgerLabel = Array.from(root.querySelectorAll("span,p,div")).find((element) => {
    return (element.textContent ?? "").replace(/\s+/g, " ").trim().toUpperCase() === "REVISION LEDGER";
  }) as HTMLElement | undefined;
  const ledger = ledgerLabel?.closest("section") as HTMLElement | null;
  if (!ledger) return;

  if (ledger.dataset.rgMoved === "true") {
    styleLedgerTable(ledger);
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

function apply(root: HTMLElement) {
  cleanVisibleText(root);
  hideSuggestedLabels(root);
  widenLedger(root);
  blankCompletedWorkspace(root);
}

export default function ReviseCockpitClientWorkflowV2({ payload }: { payload: WorkbenchQueuePayload }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    apply(root);
    const observer = new MutationObserver(() => apply(root));
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}><ReviseCockpitClientWorkflowV1 payload={payload} /></div>;
}
