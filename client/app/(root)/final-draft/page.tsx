"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useNegotiationStore } from "@/lib/negotiation-store";
import { RISK_CONFIG } from "@/lib/annotations-store";

export default function FinalDraftPage() {
    const { status, debates, finalDraftMd: storeMd } = useNegotiationStore();

    // Read from sessionStorage (persists across tab navigation) or fall back to store
    const finalDraftMd = storeMd || (typeof window !== "undefined" ? sessionStorage.getItem("nyayaai_final_draft") : null);

    const debateList = Object.values(debates);
    const hasConclusions = debateList.some((d) => d.conclusion);

    // Summary stats
    const resolvedCount = debateList.filter((d) => d.conclusion).length;

    if (!finalDraftMd && (status === "idle" || !hasConclusions)) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4 max-w-md">
                    <div className="inline-flex items-center justify-center p-4 bg-muted/50 rounded-full border border-border">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                            <path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-foreground">No Final Draft Yet</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Run the negotiation simulation first. Once all clauses are debated and balanced,
                        the final draft will appear here with highlighted changes.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-border bg-background">
                <div>
                    <h1 className="text-lg font-bold text-foreground">Final Draft</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {resolvedCount} clause{resolvedCount !== 1 ? "s" : ""} negotiated and balanced
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-800 text-xs font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        Negotiation Complete
                    </span>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Draft content */}
                <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-muted/20">
                    <div className="w-full max-w-[800px] bg-background shadow-sm border border-border rounded-lg h-fit">
                        {finalDraftMd ? (
                            <div className="p-10 lg:p-12 prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                        mark: ({ node, children, ...props }) => {
                                            const isNegotiated = (props as Record<string, string>)["data-negotiated"] === "accepted";
                                            if (isNegotiated) {
                                                return (
                                                    <mark className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 px-1 rounded border-b-2 border-green-400 dark:border-green-600" style={{ backgroundColor: undefined }}>
                                                        {children}
                                                    </mark>
                                                );
                                            }
                                            return <mark {...props}>{children}</mark>;
                                        },
                                    }}
                                >
                                    {finalDraftMd}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <div className="p-10 text-center text-muted-foreground text-sm">
                                Final draft markdown not available. The negotiation may still be in progress.
                            </div>
                        )}
                    </div>
                </div>

                {/* Changes sidebar */}
                <aside className="hidden lg:flex w-[380px] shrink-0 flex-col border-l border-border bg-background">
                    <div className="p-5 border-b border-border">
                        <h2 className="text-sm font-bold text-foreground">Negotiated Changes</h2>
                        <p className="text-xs text-muted-foreground mt-1">Summary of all balanced clauses</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {debateList.map((debate) => {
                            const config = RISK_CONFIG[debate.riskType as keyof typeof RISK_CONFIG];
                            return (
                                <div key={debate.riskId} className="rounded-lg border border-border overflow-hidden">
                                    <div className="bg-muted/30 px-4 py-2 border-b border-border/50 flex items-center justify-between">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${config?.badge}`}>
                                            {config?.label}
                                        </span>
                                        {debate.conclusion && (
                                            <span className="text-green-600 text-[10px] font-medium flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                                Resolved
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-3 space-y-2">
                                        <div>
                                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Original</p>
                                            <p className="text-xs text-red-600/80 dark:text-red-400/80 line-through leading-relaxed">
                                                {debate.clause.slice(0, 100)}{debate.clause.length > 100 ? "..." : ""}
                                            </p>
                                        </div>
                                        {debate.conclusion && (
                                            <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Balanced</p>
                                                <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed bg-green-50/50 dark:bg-green-950/20 p-2 rounded border border-green-100 dark:border-green-900/30">
                                                    {debate.conclusion.slice(0, 150)}{debate.conclusion.length > 150 ? "..." : ""}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>
            </div>
        </div>
    );
}
