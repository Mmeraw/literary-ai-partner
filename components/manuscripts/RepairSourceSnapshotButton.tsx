"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  manuscriptId: number;
};

type RepairState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function RepairSourceSnapshotButton({ manuscriptId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<RepairState>({ kind: "idle" });

  const onRepair = async () => {
    try {
      setState({ kind: "loading" });
      const res = await fetch(`/api/manuscripts/${manuscriptId}/repair-source`, {
        method: "POST",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        setState({
          kind: "error",
          message: payload.error || "Failed to repair source snapshot.",
        });
        return;
      }

      setState({
        kind: "success",
        message: payload.message || "Source snapshot repaired.",
      });
      router.refresh();
    } catch {
      setState({
        kind: "error",
        message: "Failed to repair source snapshot.",
      });
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={onRepair}
        disabled={state.kind === "loading"}
        className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 text-xs font-semibold text-[#1A140C] hover:bg-[#D8BB7B] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state.kind === "loading" ? "Repairing source snapshot..." : "Repair source snapshot"}
      </button>

      {state.kind === "error" ? (
        <p className="text-xs text-[#F6B5B5]">{state.message}</p>
      ) : null}

      {state.kind === "success" ? (
        <p className="text-xs text-[#AEE5B8]">{state.message}</p>
      ) : null}
    </div>
  );
}
