jest.mock("@/lib/db/waveRuns", () => ({
	insertWaveRun: jest.fn(),
	updateWaveRunStatus: jest.fn(),
	getWaveRunsBySession: jest.fn(),
}));

import { executeWaveModules } from "@/lib/revision/wave-executor";
import { insertWaveRun, updateWaveRunStatus } from "@/lib/db/waveRuns";

describe("wave run persistence", () => {
	const mockInsertWaveRun = insertWaveRun as jest.MockedFunction<typeof insertWaveRun>;
	const mockUpdateWaveRunStatus =
		updateWaveRunStatus as jest.MockedFunction<typeof updateWaveRunStatus>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockInsertWaveRun.mockImplementation(async (input) => ({
			id: `wave-run-${input.wave_number}`,
			revision_session_id: input.revision_session_id,
			wave_number: input.wave_number,
			wave_name: input.wave_name,
			category: input.category,
			status: input.status,
			proposed_text_hash: input.proposed_text_hash,
			changes_count: input.changes_count ?? 0,
			modifications: input.modifications ?? [],
			duration_ms: input.duration_ms ?? 0,
			error_message: input.error_message ?? null,
			created_at: new Date().toISOString(),
			completed_at: input.completed_at ?? null,
		}));

		mockUpdateWaveRunStatus.mockImplementation(async (waveRunId, input) => ({
			id: waveRunId,
			revision_session_id: "revision-session-123",
			wave_number: 0,
			wave_name: "mock",
			category: "mock",
			status: input.status,
			proposed_text_hash: input.proposed_text_hash ?? "hash",
			changes_count: input.changes_count ?? 0,
			modifications: input.modifications ?? [],
			duration_ms: input.duration_ms ?? 0,
			error_message: input.error_message ?? null,
			created_at: new Date().toISOString(),
			completed_at: input.completed_at ?? null,
		}));
	});

	it("persists wave runs for each requested wave when revisionSessionId is present", async () => {
		await executeWaveModules({
			revisionSessionId: "revision-session-123",
			text: "Original text.",
			targets: [],
			requestedWaves: [999, 1000],
			mode: "standard",
		});

		expect(mockInsertWaveRun).toHaveBeenCalledTimes(2);
		expect(mockInsertWaveRun).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				revision_session_id: "revision-session-123",
				wave_number: 999,
				status: "running",
			}),
		);
		expect(mockInsertWaveRun).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				revision_session_id: "revision-session-123",
				wave_number: 1000,
				status: "running",
			}),
		);
	});

	it("does not persist wave runs when revisionSessionId is not provided", async () => {
		await executeWaveModules({
			text: "Original text.",
			targets: [],
			requestedWaves: [999, 1000],
			mode: "standard",
		});

		expect(mockInsertWaveRun).not.toHaveBeenCalled();
	});
});
