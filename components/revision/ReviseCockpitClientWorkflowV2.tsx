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

function widenLedger(root: HTMLElement) {
  const ledgerLabel = Array.from(root.querySelectorAll("span,p,div")).find((element) => {
    return (element.textContent ?? "").replace(/\s+/g, " ").trim().toUpperCase() === "REVISION LEDGER";
  }) as HTMLElement | undefined;
  const ledger = ledgerLabel?.closest("section") as HTMLElement | null;
  const rightPane = ledger?.parentElement as HTMLElement | null;
  const grid = rightPane?.parentElement as HTMLElement | null;
  if (!ledger || !rightPane || !grid) return;

  rightPane.dataset.rgWorkspacePane = "true";

  if (ledger.dataset.rgMoved !== "true") {
    grid.appendChild(ledger);
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "310px minmax(0, 1fr)";
    grid.style.gridTemplateRows = "minmax(0, 1fr) auto";
    ledger.dataset.rgMoved = "true";
    ledger.style.gridColumn = "1 / -1";
    ledger.style.overflowX = "hidden";
  }

  const table = ledger.querySelector("table") as HTMLTableElement | null;
  if (table) {
    table.style.tableLayout = "fixed";
    table.style.width = "100%";
    for (const cell of Array.from(table.querySelectorAll("th,td")) as HTMLElement[]) {
      cell.style.overflow = "hidden";
      cell.style.textOverflow = "ellipsis";
      cell.style.whiteSpace = "nowrap";
    }
  }
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
  note.textContent = "Use Unselect in the ledger to return an item to the queue.";
  blank.appendChild(title);
  blank.appendChild(note);
  return blank;
}

function blankCompletedWorkspace(root: HTMLElement) {
  const workspace = root.querySelector('[data-rg-workspace-pane="true"]') as HTMLElement | null;
  if (!workspace) return;

  const existing = workspace.querySelector('[data-rg-complete-workspace="true"]') as HTMLElement | null;
  if (!queueIsComplete(root)) {
    existing?.remove();
    for (const child of Array.from(workspace.children) as HTMLElement[]) {
      child.style.display = "";
    }
    return;
  }

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
