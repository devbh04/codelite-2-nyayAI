"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNegotiationStore, type DebateEntry } from "@/lib/negotiation-store";
import { useAnnotationStore, RISK_CONFIG, parseAnnotations } from "@/lib/annotations-store";

// ── Party Panel ──────────────────────────────────────────────────────────────

function PartyPanel({ party, debate }: { party: "a" | "b"; debate: DebateEntry | null }) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const isA = party === "a";
    const messages = debate?.messages.filter((m) => m.party === party) ?? [];

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    return (
        <div className="bg-background p-5 rounded-xl border border-border flex flex-col h-full">
            <div className={`flex ${isA ? "" : "flex-row-reverse text-right"} items-center gap-3 mb-5 border-b border-border/50 pb-4`}>
                <div className="w-10 h-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isA ? (
                            <><rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></>
                        ) : (
                            <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>
                        )}
                    </svg>
                </div>
                <div>
                    <h3 className="text-foreground font-semibold text-sm">{isA ? "Party A" : "Party B"}</h3>
                    <p className="text-muted-foreground text-xs">{isA ? "Corporate Counsel" : "Reviewing Party"}</p>
                </div>
            </div>
            <div className={`mb-5 ${isA ? "" : "text-right"}`}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Strategy</p>
                <p className="text-xs text-muted-foreground/80 leading-relaxed bg-muted/30 p-3 rounded border border-border/50">
                    {isA
                        ? "Preserve original clause. Maximize legal protection. Minimize liability exposure."
                        : "Advocate for fairer terms. Push for balanced changes. Reference suggested improvements."}
                </p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 scroll-smooth pr-1">
                {messages.map((msg, i) => (
                    <div key={i} className={`p-3 rounded-lg text-sm text-foreground/90 shadow-sm border ${isA ? "bg-muted/30 border-border/50 rounded-tl-sm" : "bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 rounded-tr-sm"}`}>
                        <span className={`block text-[10px] mb-1 font-medium ${isA ? "text-muted-foreground" : "text-orange-500/70"} ${isA ? "" : "text-right"}`}>
                            Round {msg.round}
                        </span>
                        {msg.text}
                    </div>
                ))}
                {debate && !debate.conclusion && messages.length > 0 && (
                    <div className={`flex items-center gap-2 p-2 ${isA ? "" : "justify-end"}`}>
                        {isA ? (
                            <><div className="flex space-x-1"><div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} /><div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} /></div><span className="text-xs text-muted-foreground">Thinking...</span></>
                        ) : (
                            <><span className="text-xs text-muted-foreground">Typing...</span><div className="flex space-x-1"><div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} /><div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} /></div></>
                        )}
                    </div>
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}

// ── Risk Selection Card ─────────────────────────────────────────────────────

function RiskSelectCard({ annotation, isSelected, onToggle }: {
    annotation: { id: string; type: string; content: string; suggestion: string; ipc: string };
    isSelected: boolean;
    onToggle: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const config = RISK_CONFIG[annotation.type as keyof typeof RISK_CONFIG];

    return (
        <div className={`rounded-xl border transition-all ${isSelected ? "border-foreground/30 bg-background shadow-sm" : "border-border bg-muted/20 opacity-60"}`}>
            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider shrink-0 ${config.badge}`}>
                        {config.label}
                    </span>
                    <span className="text-sm text-foreground truncate">{annotation.content.slice(0, 60)}...</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggle(); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSelected
                            ? "bg-foreground text-background"
                            : "bg-muted border border-border text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {isSelected ? "Selected" : "Add"}
                    </button>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}>
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </div>
            </div>
            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                    <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Flagged Clause</p>
                        <p className="text-xs text-foreground/80 leading-relaxed bg-muted/30 p-3 rounded border border-border/50">{annotation.content}</p>
                    </div>
                    {annotation.suggestion && (
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Suggestion</p>
                            <p className="text-xs text-foreground/80 leading-relaxed bg-green-50/50 dark:bg-green-950/10 p-3 rounded border border-green-100 dark:border-green-900/30">{annotation.suggestion}</p>
                        </div>
                    )}
                    {annotation.ipc && (
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">IPC Reference</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{annotation.ipc}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Done Summary ─────────────────────────────────────────────────────────────

function DoneSummary({ debateList, reset }: { debateList: DebateEntry[]; reset: () => void }) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggle = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const acceptedCount = debateList.filter((d) => d.decision === "accepted").length;
    const rejectedCount = debateList.filter((d) => d.decision === "rejected").length;

    return (
        <div className="flex flex-col h-full overflow-hidden p-6 gap-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-foreground">Negotiation Complete</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {acceptedCount} accepted, {rejectedCount} rejected. View the Final Draft tab for the updated contract.
                    </p>
                </div>
                <button onClick={reset} className="inline-flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-muted/30 text-foreground font-medium rounded-lg transition-colors text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
                    Rerun
                </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
                {debateList.map((debate) => {
                    const config = RISK_CONFIG[debate.riskType as keyof typeof RISK_CONFIG];
                    const isExpanded = expandedIds.has(debate.riskId);
                    const isAccepted = debate.decision === "accepted";

                    return (
                        <div key={debate.riskId} className={`bg-background rounded-xl border shadow-sm transition-all ${isAccepted ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800 opacity-80"}`}>
                            {/* Header — click to expand */}
                            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => toggle(debate.riskId)}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider shrink-0 ${config?.badge}`}>{config?.label}</span>
                                    <span className="text-sm text-foreground truncate">{debate.clause.slice(0, 60)}...</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                    <span className={`text-xs font-medium ${isAccepted ? "text-green-600" : "text-red-500"}`}>
                                        {isAccepted ? "✓ Applied" : "✗ Rejected"}
                                    </span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                        <path d="m6 9 6 6 6-6" />
                                    </svg>
                                </div>
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
                                    {/* Judge reasoning */}
                                    {debate.judgeReasoning && (
                                        <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
                                            <div className="flex items-center gap-2 mb-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                                                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Judge&apos;s Opinion</span>
                                            </div>
                                            <p className="text-sm text-foreground/80 leading-relaxed">{debate.judgeReasoning}</p>
                                        </div>
                                    )}

                                    {/* Original clause */}
                                    <div>
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Original Clause</p>
                                        <p className="text-xs text-red-600/80 dark:text-red-400/80 line-through leading-relaxed bg-red-50/50 dark:bg-red-950/10 p-3 rounded border border-red-100 dark:border-red-900/30">
                                            {debate.clause}
                                        </p>
                                    </div>

                                    {/* Replacement clause */}
                                    {debate.conclusion && (
                                        <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                                {isAccepted ? "Replacement (Applied)" : "Proposed Replacement (Rejected)"}
                                            </p>
                                            <p className={`text-xs leading-relaxed p-3 rounded border ${isAccepted
                                                ? "text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-950/10 border-green-100 dark:border-green-900/30"
                                                : "text-muted-foreground bg-muted/20 border-border/50 italic"
                                                }`}>
                                                {debate.conclusion}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NegotiationPage() {
    const {
        status, debates, activeRiskId, selectedRiskIds, finalDraftMd,
        startNegotiation, toggleRiskSelection, selectAllRisks, deselectAllRisks,
        setDecision, buildFinalDraft, reset,
    } = useNegotiationStore();
    const { annotations, setAnnotations } = useAnnotationStore();

    // Hydrate annotations from sessionStorage if store is empty
    useEffect(() => {
        if (annotations.length > 0) return;
        const stored = sessionStorage.getItem("nyayaai_analysis");
        if (!stored) return;
        try {
            const parsed = JSON.parse(stored);
            const { annotations: hydrated } = parseAnnotations(parsed.markdown);
            setAnnotations(hydrated);
        } catch { /* ignore */ }
    }, [annotations.length, setAnnotations]);

    const riskAnnotations = useMemo(() =>
        annotations.filter((a) => a.type === "hr" || a.type === "mr" || a.type === "lr"),
        [annotations]
    );

    // Auto-select all risks on first load
    useEffect(() => {
        if (riskAnnotations.length > 0 && selectedRiskIds.size === 0 && status === "idle") {
            selectAllRisks(riskAnnotations.map((a) => a.id));
        }
    }, [riskAnnotations, selectedRiskIds.size, status, selectAllRisks]);

    const debateList = Object.values(debates);
    const activeDebate = activeRiskId ? debates[activeRiskId] : debateList[debateList.length - 1] ?? null;
    const activeConfig = activeDebate ? RISK_CONFIG[activeDebate.riskType as keyof typeof RISK_CONFIG] : null;

    const completedCount = debateList.filter((d) => d.conclusion).length;
    const selectedCount = selectedRiskIds.size;

    const handleStart = () => {
        const originalMd = sessionStorage.getItem("nyayaai_analysis");
        if (!originalMd) return;
        const parsed = JSON.parse(originalMd);
        startNegotiation(
            parsed.markdown,
            riskAnnotations.map((a) => ({ id: a.id, type: a.type, content: a.content, suggestion: a.suggestion }))
        );
    };

    const allDecided = debateList.length > 0 && debateList.every((d) => d.decision !== "pending");

    // ── No risks ──
    if (riskAnnotations.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4 max-w-md">
                    <div className="inline-flex items-center justify-center p-4 bg-muted/50 rounded-full border border-border">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" /></svg>
                    </div>
                    <h2 className="text-lg font-bold text-foreground">No Risks to Negotiate</h2>
                    <p className="text-sm text-muted-foreground">Upload a contract and run the analysis first to identify risk clauses.</p>
                </div>
            </div>
        );
    }

    // ── Idle: Risk selection ──
    if (status === "idle") {
        return (
            <div className="flex flex-col h-full overflow-hidden p-6 gap-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Negotiation Simulator</h1>
                        <p className="text-sm text-muted-foreground mt-1">Select which risks to include in the negotiation debate.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => selectAllRisks(riskAnnotations.map((a) => a.id))} className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/30">
                            Select All
                        </button>
                        <button onClick={deselectAllRisks} className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/30">
                            Deselect All
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                    {riskAnnotations.map((a) => (
                        <RiskSelectCard
                            key={a.id}
                            annotation={a}
                            isSelected={selectedRiskIds.has(a.id)}
                            onToggle={() => toggleRiskSelection(a.id)}
                        />
                    ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{selectedCount}</span> of {riskAnnotations.length} risks selected
                    </p>
                    <button
                        onClick={handleStart}
                        disabled={selectedCount === 0}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background font-semibold rounded-lg shadow-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                        Start Negotiation
                    </button>
                </div>
            </div>
        );
    }

    // ── Reviewing: Accept / Reject verdicts ──
    if (status === "reviewing") {
        return (
            <div className="flex flex-col h-full overflow-hidden p-6 gap-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Review Judge Verdicts</h1>
                        <p className="text-sm text-muted-foreground mt-1">Accept or reject each balanced clause. Only accepted changes will appear in the Final Draft.</p>
                    </div>
                    {allDecided && (
                        <button
                            onClick={buildFinalDraft}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-semibold rounded-lg shadow-lg hover:opacity-90 transition-opacity text-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                            Generate Draft
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-4">
                    {debateList.map((debate) => {
                        const config = RISK_CONFIG[debate.riskType as keyof typeof RISK_CONFIG];
                        return (
                            <div key={debate.riskId} className={`bg-background rounded-xl border p-5 shadow-sm transition-all ${debate.decision === "accepted" ? "border-green-200 dark:border-green-800" :
                                debate.decision === "rejected" ? "border-red-200 dark:border-red-800 opacity-70" :
                                    "border-border"
                                }`}>
                                {/* Risk header */}
                                <div className="flex items-center gap-2 mb-4">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${config?.badge}`}>
                                        {config?.label}
                                    </span>
                                    <span className="text-sm text-foreground font-medium truncate">{debate.clause.slice(0, 80)}...</span>
                                </div>

                                {/* Judge reasoning */}
                                {debate.judgeReasoning && (
                                    <div className="mb-4 p-4 bg-muted/20 rounded-lg border border-border/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                                            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Judge&apos;s Reasoning</span>
                                        </div>
                                        <p className="text-sm text-foreground/80 leading-relaxed">{debate.judgeReasoning}</p>
                                    </div>
                                )}

                                {/* Balanced clause */}
                                {debate.conclusion && (
                                    <div className="mb-4">
                                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Balanced Clause</p>
                                        <div className="bg-green-50/50 dark:bg-green-950/10 p-4 rounded-lg border border-green-100 dark:border-green-900/30 font-mono text-sm text-foreground/80 leading-loose">
                                            {debate.conclusion}
                                        </div>
                                    </div>
                                )}

                                {/* Accept/Reject buttons */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setDecision(debate.riskId, "accepted")}
                                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${debate.decision === "accepted"
                                            ? "bg-green-600 text-white shadow-md"
                                            : "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100"
                                            }`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => setDecision(debate.riskId, "rejected")}
                                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${debate.decision === "rejected"
                                            ? "bg-red-600 text-white shadow-md"
                                            : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100"
                                            }`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                        Reject
                                    </button>
                                    {debate.decision !== "pending" && (
                                        <span className={`ml-auto text-xs font-medium ${debate.decision === "accepted" ? "text-green-600" : "text-red-500"}`}>
                                            {debate.decision === "accepted" ? "✓ Will be applied" : "✗ Will stay flagged"}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {!allDecided && (
                    <div className="flex items-center justify-center pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                            {debateList.filter((d) => d.decision !== "pending").length} of {debateList.length} decisions made
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // ── Active debate ──
    if (status === "negotiating" || status === "connecting") {
        return (
            <div className="flex flex-col h-full overflow-hidden p-6 gap-5">
                {/* Top bar */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-border pb-4 gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
                            {activeDebate ? (
                                <>
                                    Debating: {activeDebate.clause.slice(0, 50)}...
                                    {activeConfig && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${activeConfig.badge}`}>{activeConfig.label}</span>
                                    )}
                                </>
                            ) : "Connecting..."}
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">Simulating debate based on Indian Contract Act</p>
                    </div>
                    <div className="flex items-center gap-4 bg-background px-4 py-2 rounded-lg border border-border shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Progress</span>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="h-1.5 w-32 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-foreground rounded-full transition-all duration-500" style={{ width: `${selectedCount > 0 ? (completedCount / selectedCount) * 100 : 0}%` }} />
                                </div>
                                <span className="text-foreground font-bold text-sm">{completedCount}/{selectedCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {activeDebate && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 overflow-hidden">
                        <div className="lg:col-span-3 min-h-0 overflow-hidden flex">
                            <PartyPanel party="a" debate={activeDebate} />
                        </div>

                        <div className="lg:col-span-6 flex flex-col gap-4 min-h-0 overflow-auto">
                            <div className="flex justify-center items-center py-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">Draft</span>
                                    <div className="h-px w-8 bg-border" />
                                    <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-orange-600 text-xs font-semibold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                        {activeDebate.conclusion ? "Judge Verdict" : "Debate Active"}
                                    </span>
                                    <div className="h-px w-8 bg-border" />
                                    <span className="text-xs font-medium text-muted-foreground">Consensus</span>
                                </div>
                            </div>

                            <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
                                <div className="bg-muted/30 border-b border-border px-4 py-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Original Clause</span>
                                </div>
                                <div className="p-6 font-mono text-sm leading-loose text-foreground/80 overflow-y-auto max-h-[200px]">
                                    {activeDebate.clause}
                                </div>
                            </div>

                            {!activeDebate.conclusion && (
                                <div className="flex-1 rounded-xl border border-dashed border-border bg-muted/10 flex flex-col items-center justify-center p-8">
                                    <div className="text-center space-y-4">
                                        <div className="inline-flex items-center justify-center p-3 bg-background rounded-full border border-border shadow-sm mb-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 animate-pulse"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                                        </div>
                                        <h3 className="text-foreground text-base font-semibold">
                                            Simulating Round {activeDebate.messages.length > 0 ? activeDebate.messages[activeDebate.messages.length - 1].round : 1}
                                        </h3>
                                        <p className="text-muted-foreground text-xs mt-1">Analyzing clause precedents...</p>
                                    </div>
                                </div>
                            )}

                            {activeDebate.conclusion && (
                                <div className="bg-background border border-border rounded-xl p-6 relative shadow-sm">
                                    <div className="absolute -top-3 left-6 bg-foreground text-background px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest shadow-lg">
                                        Judge&apos;s Verdict
                                    </div>
                                    {activeDebate.judgeReasoning && (
                                        <div className="mt-2 mb-4 p-4 bg-muted/20 rounded-lg border border-border/50">
                                            <p className="text-sm text-foreground/80 leading-relaxed">{activeDebate.judgeReasoning}</p>
                                        </div>
                                    )}
                                    <div className="bg-green-50/50 dark:bg-green-950/10 p-5 rounded-lg border border-green-100 dark:border-green-900/30 font-mono text-sm text-foreground/80 leading-loose">
                                        {activeDebate.conclusion}
                                    </div>
                                    <div className="flex gap-4 mt-4 text-xs font-medium">
                                        <span className="flex items-center gap-1.5 text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                            Party A Accepted
                                        </span>
                                        <span className="flex items-center gap-1.5 text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                            Party B Accepted
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-3 min-h-0 overflow-hidden flex">
                            <PartyPanel party="b" debate={activeDebate} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Done ──
    if (status === "done") {
        return <DoneSummary debateList={debateList} reset={reset} />;
    }

    // ── Error ──
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
                <p className="text-red-500 font-medium">Connection error</p>
                <p className="text-sm text-muted-foreground">{useNegotiationStore.getState().errorMessage}</p>
                <button onClick={reset} className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium">Try Again</button>
            </div>
        </div>
    );
}
