"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    useAnnotationStore,
    RISK_CONFIG,
    type RiskLevel,
    type Annotation,
} from "@/lib/annotations-store";

function RiskCard({ annotation, isExpanded, onToggle }: {
    annotation: Annotation;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    const { activeId, setActiveId } = useAnnotationStore();
    const config = RISK_CONFIG[annotation.type];
    const isActive = activeId === annotation.id;

    const iconBg =
        annotation.type === "hr" ? "text-red-600" :
            annotation.type === "mr" ? "text-orange-600" :
                "text-yellow-600";

    const cardBg = isExpanded
        ? "bg-background border-border shadow-sm"
        : `${isActive ? config.bg : "bg-background"} border-border hover:shadow-sm`;

    return (
        <div
            data-sidebar-risk={annotation.id}
            className={`rounded-lg border overflow-hidden transition-all scroll-mt-4 ${cardBg}`}
            onMouseEnter={() => setActiveId(annotation.id)}
            onMouseLeave={() => setActiveId(null)}
        >
            {/* Header */}
            <button
                className="w-full p-4 bg-muted/30 border-b border-border/50 flex items-start justify-between cursor-pointer text-left"
                onClick={() => {
                    onToggle();
                    const el = document.querySelector(`[data-risk-id="${annotation.id}"]`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    setActiveId(annotation.id);
                }}
            >
                <div className="flex gap-3">
                    <div className={`mt-0.5 ${iconBg}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {annotation.type === "hr" ? (
                                <><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></>
                            ) : annotation.type === "mr" ? (
                                <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></>
                            ) : (
                                <><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="16" y2="12" /><line x1="12" x2="12.01" y1="8" y2="8" /></>
                            )}
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-foreground font-semibold text-sm leading-tight">
                            {annotation.content.slice(0, 60)}{annotation.content.length > 60 ? "..." : ""}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">Risk ID: {annotation.id}</p>
                    </div>
                </div>
                <span className={`${config.badge} text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide shrink-0`}>
                    {config.label.split(" ")[0]}
                </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="p-4 space-y-4">
                    <div>
                        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Flagged Clause</h4>
                        <p className="text-foreground/80 text-sm leading-relaxed">{annotation.content}</p>
                    </div>
                    {annotation.suggestion && (
                        <div>
                            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Suggestion</h4>
                            <p className="text-foreground/80 text-sm leading-relaxed">{annotation.suggestion}</p>
                        </div>
                    )}
                    {annotation.ipc && annotation.ipc !== "not found" && (
                        <div>
                            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Legal Reference</h4>
                            <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
                                </svg>
                                {annotation.ipc}
                            </span>
                        </div>
                    )}
                    {annotation.ipc === "not found" && (
                        <div>
                            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Legal Reference</h4>
                            <p className="text-xs text-muted-foreground italic">No reference found</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function RiskSidebar() {
    const { annotations, expandedId, setExpandedId } = useAnnotationStore();
    const [filter, setFilter] = React.useState<"all" | RiskLevel>("all");
    const [summaryOpen, setSummaryOpen] = React.useState(false);

    // Read risk scores from sessionStorage
    const [riskData, setRiskData] = React.useState<{
        overall_risk_score: number;
        total_clauses: number;
        executive_summary: string;
    } | null>(null);

    React.useEffect(() => {
        const stored = sessionStorage.getItem("nyayaai_risk_score");
        if (stored) {
            try { setRiskData(JSON.parse(stored)); } catch { /* ignore */ }
        }
    }, []);

    if (annotations.length === 0) return null;

    const countByType = (type: RiskLevel) =>
        annotations.filter((a) => a.type === type).length;

    const hrCount = countByType("hr");
    const mrCount = countByType("mr");
    const lrCount = countByType("lr");

    const filteredAnnotations =
        filter === "all"
            ? annotations
            : annotations.filter((a) => a.type === filter);

    // Use real risk score from agent system, fallback to derived
    const score = riskData?.overall_risk_score ?? Math.max(0, Math.min(100, 100 - (hrCount * 10 + mrCount * 5 + lrCount * 2)));
    const totalClauses = riskData?.total_clauses ?? annotations.length;
    const scoreColor = score >= 70 ? "text-red-600 bg-red-50 border-red-100" :
        score >= 40 ? "text-orange-600 bg-orange-50 border-orange-100" :
            "text-green-600 bg-green-50 border-green-100";

    return (
        <aside className="w-full h-full flex flex-col bg-background border-l border-border shadow-[rgba(0,0,0,0.05)_0px_0px_10px]">
            {/* Risk Overview */}
            <div className="p-6 border-b border-border">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Risk Score</h2>
                        <div className="text-xs text-muted-foreground mt-1">AI-powered analysis</div>
                    </div>
                    <div className={`flex items-center justify-center size-12 rounded-full font-bold text-lg border-2 ${scoreColor}`}>
                        {score}
                    </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-3 mb-3">
                    <div className="flex-1 rounded-md bg-muted/40 px-3 py-2 text-center">
                        <div className="text-lg font-bold text-foreground">{totalClauses}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Clauses</div>
                    </div>
                    <div className="flex-1 rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-2 text-center">
                        <div className="text-lg font-bold text-red-600">{hrCount}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">High</div>
                    </div>
                    <div className="flex-1 rounded-md bg-orange-50 dark:bg-orange-950/20 px-3 py-2 text-center">
                        <div className="text-lg font-bold text-orange-600">{mrCount}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Medium</div>
                    </div>
                    <div className="flex-1 rounded-md bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-center">
                        <div className="text-lg font-bold text-yellow-600">{lrCount}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Low</div>
                    </div>
                </div>

                <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                    This agreement contains{" "}
                    {hrCount > 0 && (
                        <strong className="text-red-700 dark:text-red-400 font-semibold">{hrCount} high-risk clause{hrCount !== 1 ? "s" : ""}</strong>
                    )}
                    {hrCount > 0 && mrCount > 0 && " and "}
                    {mrCount > 0 && (
                        <strong className="text-orange-700 dark:text-orange-400 font-semibold">{mrCount} medium-risk clause{mrCount !== 1 ? "s" : ""}</strong>
                    )}
                    {(hrCount > 0 || mrCount > 0) && lrCount > 0 && " and "}
                    {lrCount > 0 && (
                        <strong className="text-yellow-700 dark:text-yellow-400 font-semibold">{lrCount} low-risk clause{lrCount !== 1 ? "s" : ""}</strong>
                    )}
                    .
                </p>

                {/* Executive Summary button */}
                {riskData?.executive_summary && (
                    <button
                        onClick={() => setSummaryOpen(true)}
                        className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-muted/30 text-foreground hover:bg-muted transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
                        </svg>
                        View Executive Summary
                    </button>
                )}
            </div>

            {/* Executive Summary Dialog */}
            {summaryOpen && riskData?.executive_summary && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSummaryOpen(false)}>
                    <div
                        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
                                </svg>
                                <h3 className="font-bold text-foreground">Executive Summary</h3>
                            </div>
                            <button onClick={() => setSummaryOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-6 py-5 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {riskData.executive_summary}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter tabs */}
            <div className="flex border-b border-border px-6 pt-2">
                <button
                    onClick={() => setFilter("all")}
                    className={`mr-6 pb-3 text-sm font-medium transition-colors ${filter === "all"
                        ? "text-foreground font-semibold border-b-2 border-foreground"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    All Risks{" "}
                    <span className="ml-1 bg-muted text-muted-foreground px-1.5 rounded text-[10px] align-middle">
                        {annotations.length}
                    </span>
                </button>
                {hrCount > 0 && (
                    <button
                        onClick={() => setFilter("hr")}
                        className={`mr-6 pb-3 text-sm font-medium transition-colors ${filter === "hr"
                            ? "text-foreground font-semibold border-b-2 border-red-500"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        High{" "}
                        <span className="ml-1 bg-red-50 dark:bg-red-950/50 text-red-600 px-1.5 rounded text-[10px] align-middle">
                            {hrCount}
                        </span>
                    </button>
                )}
                {mrCount > 0 && (
                    <button
                        onClick={() => setFilter("mr")}
                        className={`mr-6 pb-3 text-sm font-medium transition-colors ${filter === "mr"
                            ? "text-foreground font-semibold border-b-2 border-orange-500"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Medium{" "}
                        <span className="ml-1 bg-orange-50 dark:bg-orange-950/50 text-orange-600 px-1.5 rounded text-[10px] align-middle">
                            {mrCount}
                        </span>
                    </button>
                )}
                {lrCount > 0 && (
                    <button
                        onClick={() => setFilter("lr")}
                        className={`mr-6 pb-3 text-sm font-medium transition-colors ${filter === "lr"
                            ? "text-foreground font-semibold border-b-2 border-yellow-500"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Low{" "}
                        <span className="ml-1 bg-yellow-50 dark:bg-yellow-950/50 text-yellow-600 px-1.5 rounded text-[10px] align-middle">
                            {lrCount}
                        </span>
                    </button>
                )}
            </div>

            {/* Risk list */}
            <div data-risk-list className="flex-1 overflow-y-auto scroll-smooth p-6 space-y-3">
                {filteredAnnotations.map((ann) => (
                    <RiskCard
                        key={ann.id}
                        annotation={ann}
                        isExpanded={expandedId === ann.id}
                        onToggle={() =>
                            setExpandedId(expandedId === ann.id ? null : ann.id)
                        }
                    />
                ))}
            </div>
        </aside>
    );
}
