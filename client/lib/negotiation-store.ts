import { create } from "zustand";

export interface DebateMessage {
    party: "a" | "b";
    round: number;
    text: string;
    timestamp: number;
}

export interface DebateEntry {
    riskId: string;
    riskType: string;
    clause: string;
    messages: DebateMessage[];
    judgeReasoning: string | null;
    conclusion: string | null;
    decision: "pending" | "accepted" | "rejected";
}

interface NegotiationState {
    status: "idle" | "connecting" | "negotiating" | "reviewing" | "done" | "error";
    selectedRiskIds: Set<string>;
    debates: Record<string, DebateEntry>;
    activeRiskId: string | null;
    finalDraftMd: string | null;
    errorMessage: string | null;

    // Actions
    toggleRiskSelection: (id: string) => void;
    selectAllRisks: (ids: string[]) => void;
    deselectAllRisks: () => void;
    startNegotiation: (originalMd: string, risks: { id: string; type: string; content: string; suggestion: string }[]) => void;
    setDecision: (riskId: string, decision: "accepted" | "rejected") => void;
    buildFinalDraft: () => void;
    reset: () => void;
}

let ws: WebSocket | null = null;

export const useNegotiationStore = create<NegotiationState>((set, get) => ({
    status: "idle",
    selectedRiskIds: new Set<string>(),
    debates: {},
    activeRiskId: null,
    finalDraftMd: null,
    errorMessage: null,

    toggleRiskSelection: (id) => {
        const current = new Set(get().selectedRiskIds);
        if (current.has(id)) current.delete(id);
        else current.add(id);
        set({ selectedRiskIds: current });
    },

    selectAllRisks: (ids) => {
        set({ selectedRiskIds: new Set(ids) });
    },

    deselectAllRisks: () => {
        set({ selectedRiskIds: new Set() });
    },

    startNegotiation: (_originalMd, risks) => {
        if (ws) { ws.close(); ws = null; }

        const selected = get().selectedRiskIds;
        const filteredRisks = risks.filter((r) => selected.has(r.id));

        if (filteredRisks.length === 0) return;

        set({
            status: "connecting",
            debates: {},
            activeRiskId: null,
            finalDraftMd: null,
            errorMessage: null,
        });

        ws = new WebSocket("ws://localhost:8000/ws/negotiate");

        ws.onopen = () => {
            set({ status: "negotiating" });
            ws?.send(JSON.stringify({
                risks: filteredRisks.map((r) => ({
                    id: r.id, type: r.type, content: r.content, suggestion: r.suggestion,
                })),
            }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const state = get();

            switch (data.type) {
                case "debate_start": {
                    const entry: DebateEntry = {
                        riskId: data.risk_id,
                        riskType: data.risk_type,
                        clause: data.clause,
                        messages: [],
                        judgeReasoning: null,
                        conclusion: null,
                        decision: "pending",
                    };
                    set({
                        debates: { ...state.debates, [data.risk_id]: entry },
                        activeRiskId: data.risk_id,
                    });
                    break;
                }
                case "party_a":
                case "party_b": {
                    const party = data.type === "party_a" ? "a" : "b";
                    const debate = state.debates[data.risk_id];
                    if (debate) {
                        const updated = {
                            ...debate,
                            messages: [...debate.messages, {
                                party: party as "a" | "b",
                                round: data.round,
                                text: data.message,
                                timestamp: Date.now(),
                            }],
                        };
                        set({ debates: { ...state.debates, [data.risk_id]: updated } });
                    }
                    break;
                }
                case "judge_verdict": {
                    const debate = state.debates[data.risk_id];
                    if (debate) {
                        const updated = {
                            ...debate,
                            judgeReasoning: data.reasoning,
                            conclusion: data.balanced_clause,
                        };
                        set({ debates: { ...state.debates, [data.risk_id]: updated } });
                    }
                    break;
                }
                case "done": {
                    set({ status: "reviewing", activeRiskId: null });
                    break;
                }
                case "error": {
                    set({ errorMessage: data.message });
                    break;
                }
            }
        };

        ws.onerror = () => {
            set({ status: "error", errorMessage: "WebSocket connection failed" });
        };

        ws.onclose = () => { ws = null; };
    },

    setDecision: (riskId, decision) => {
        const state = get();
        const debate = state.debates[riskId];
        if (debate) {
            const updated = { ...debate, decision };
            set({ debates: { ...state.debates, [riskId]: updated } });
        }
    },

    buildFinalDraft: async () => {
        const state = get();

        // Get original markdown from sessionStorage
        const stored = sessionStorage.getItem("nyayaai_analysis");
        if (!stored) {
            set({ errorMessage: "Original markdown not found" });
            return;
        }
        const originalMd: string = JSON.parse(stored).markdown;

        // Build replacements array from accepted debates
        const replacements = Object.values(state.debates)
            .filter((d) => d.decision === "accepted" && d.conclusion)
            .map((d) => ({
                original: d.clause,        // original clause text
                replacement: d.conclusion!, // judge's balanced clause
            }));

        try {
            // Call backend to do the find-and-replace
            const res = await fetch("http://localhost:8000/generate-draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ original_md: originalMd, replacements }),
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const data = await res.json();
            const finalMd: string = data.markdown;

            // Store in sessionStorage for persistence across tab navigation
            sessionStorage.setItem("nyayaai_final_draft", finalMd);

            set({ finalDraftMd: finalMd, status: "done" });
        } catch (e) {
            set({ errorMessage: `Failed to generate draft: ${e}` });
        }
    },

    reset: () => {
        if (ws) { ws.close(); ws = null; }
        sessionStorage.removeItem("nyayaai_final_draft");
        set({
            status: "idle",
            selectedRiskIds: new Set(),
            debates: {},
            activeRiskId: null,
            finalDraftMd: null,
            errorMessage: null,
        });
    },
}));
