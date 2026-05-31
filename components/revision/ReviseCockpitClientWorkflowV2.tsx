"use client";

import { useEffect, useRef } from "react";
import type { WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import ReviseCockpitClientWorkflowV1 from "./ReviseCockpitClientWorkflowV1";

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
    const after = before
      .replace(/Symptom:\s*[?¿]+\s*/g, "Symptom: ")
      .replace(/Fix:\s*[?¿]+\s*/g, "Fix: ")
      .replace(/\bthe room heard the hurt underneath\b/gi, "the others caught the hurt underneath")
      .replace(/\bthe room\b/gi, "the clearing")
      .replace(/\broom\b/gi, "clearing")
      .replace(/\beveryone\b/gi, "the others");
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
  if (!ledger || !rightPane || !grid || ledger.dataset.rgMoved === "true") return;

  grid.appendChild(ledger);
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "310px minmax(0, 1fr)";
  grid.style.gridTemplateRows = "minmax(0, 1fr) auto";
  ledger.dataset.rgMoved = "true";
  ledger.style.gridColumn = "1 / -1";
  ledger.style.overflowX = "hidden";

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

function apply(root: HTMLElement) {
  cleanVisibleText(root);
  hideSuggestedLabels(root);
  widenLedger(root);
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
