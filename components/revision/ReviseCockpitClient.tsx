"use client";

import type { WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import ReviseQueueV2Client from "@/components/revision/ReviseQueueV2Client";

export default function ReviseCockpitClient({ payload }: { payload: WorkbenchQueuePayload }) {
  return <ReviseQueueV2Client payload={payload} />;
}