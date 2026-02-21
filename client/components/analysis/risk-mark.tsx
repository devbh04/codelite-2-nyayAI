"use client";

import React, { useState } from "react";
import {
    useAnnotationStore,
    RISK_CONFIG,
    type RiskLevel,
} from "@/lib/annotations-store";

export function RiskMark({
    riskType,
    riskId,
    children,
}: {
    riskType: RiskLevel;
    riskId: string;
    children: React.ReactNode;
}) {
    const { annotations, activeId, setActiveId, setExpandedId } = useAnnotationStore();
    const annotation = annotations.find((a) => a.id === riskId);
    const config = RISK_CONFIG[riskType];
    const isActive = activeId === riskId;
    const [showCard, setShowCard] = useState(false);

    const hoverBg =
        riskType === "hr" ? "hover:bg-red-50 dark:hover:bg-red-950/20" :
            riskType === "mr" ? "hover:bg-orange-50 dark:hover:bg-orange-950/20" :
                "hover:bg-yellow-50 dark:hover:bg-yellow-950/20";

    const underlineColor =
        riskType === "hr" ? "border-red-500" :
            riskType === "mr" ? "border-orange-500" :
                "border-yellow-500";

    const bracketColor =
        riskType === "hr" ? "text-red-500 dark:text-red-400" :
            riskType === "mr" ? "text-orange-500 dark:text-orange-400" :
                "text-yellow-500 dark:text-yellow-400";

    return (
        <span
            className={`relative group cursor-pointer rounded transition-colors scroll-mt-96 ${hoverBg} ${isActive ? config.bg : ""}`}
            onMouseEnter={() => {
                setActiveId(riskId);
                setShowCard(true);
            }}
            onMouseLeave={() => {
                setActiveId(null);
                setShowCard(false);
            }}
            onClick={() => {
                setExpandedId(riskId);
                setActiveId(riskId);
                // Wait for expansion to render, then scroll the sidebar list
                setTimeout(() => {
                    const card = document.querySelector(`[data-sidebar-risk="${riskId}"]`);
                    const list = document.querySelector("[data-risk-list]");
                    if (card && list) {
                        const listRect = list.getBoundingClientRect();
                        const cardRect = card.getBoundingClientRect();
                        list.scrollTo({ top: list.scrollTop + cardRect.top - listRect.top - 8, behavior: "smooth" });
                    }
                }, 50);
            }}
        >
            {/* Highlighted text with brackets on hover */}
            <span className={`${config.bg} border-b-2 ${underlineColor} pb-0.5 transition-all ${riskType === "hr" ? "group-hover:border-red-800 dark:group-hover:border-red-300 group-hover:border-b-[3px]" :
                riskType === "mr" ? "group-hover:border-orange-800 dark:group-hover:border-orange-300 group-hover:border-b-[3px]" :
                    "group-hover:border-yellow-800 dark:group-hover:border-yellow-300 group-hover:border-b-[3px]"
                }`}>
                <span className={`${bracketColor} font-bold select-none opacity-0 group-hover:opacity-100 transition-opacity`}>[</span>
                {children}
                <span className={`${bracketColor} font-bold select-none opacity-0 group-hover:opacity-100 transition-opacity`}>]</span>
            </span>

            {/* Hover card — centered on md page */}
            {showCard && annotation && (annotation.suggestion || annotation.ipc) && (
                <span
                    className="absolute left-1/2 -translate-x-1/2 bottom-full z-50 mb-3 w-96 rounded-xl border border-border bg-background p-5 shadow-2xl animate-in fade-in-0 zoom-in-95"
                    onMouseEnter={() => setShowCard(true)}
                    onMouseLeave={() => {
                        setShowCard(false);
                        setActiveId(null);
                    }}
                >
                    <span className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
                            {config.label}
                        </span>
                    </span>
                    {annotation.suggestion && (
                        <span className="block mb-2">
                            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                Suggestion
                            </span>
                            <span className="block text-sm leading-relaxed text-foreground/90">
                                {annotation.suggestion}
                            </span>
                        </span>
                    )}
                    {annotation.ipc && annotation.ipc !== "not found" && (
                        <span className="block">
                            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                IPC Reference
                            </span>
                            <span className="block text-sm leading-relaxed text-foreground/90">
                                {annotation.ipc}
                            </span>
                        </span>
                    )}
                    {annotation.ipc === "not found" && (
                        <span className="block text-xs text-muted-foreground italic">
                            No IPC reference found
                        </span>
                    )}
                </span>
            )}
        </span>
    );
}
