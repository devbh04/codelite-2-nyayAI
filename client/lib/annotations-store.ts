import { create } from "zustand";

export type RiskLevel = "hr" | "mr" | "lr";

export interface Annotation {
    id: string;
    type: RiskLevel;
    content: string;
    suggestion: string;
    ipc: string;
}

interface AnnotationState {
    annotations: Annotation[];
    activeId: string | null;
    expandedId: string | null;
    setAnnotations: (annotations: Annotation[]) => void;
    setActiveId: (id: string | null) => void;
    setExpandedId: (id: string | null) => void;
    clear: () => void;
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
    annotations: [],
    activeId: null,
    expandedId: null,
    setAnnotations: (annotations) => set({ annotations }),
    setActiveId: (activeId) => set({ activeId }),
    setExpandedId: (expandedId) => set({ expandedId }),
    clear: () => set({ annotations: [], activeId: null, expandedId: null }),
}));

/**
 * Parse markdown for risk markers and extract annotations.
 *
 * Pattern: -hr-content-hr--sg-suggestion-sg--ipc-ipc ref-ipc-
 * Same for -mr- and -lr-.
 *
 * Returns { cleanMarkdown, annotations }
 */
export function parseAnnotations(markdown: string): {
    cleanMarkdown: string;
    annotations: Annotation[];
} {
    const annotations: Annotation[] = [];
    let counter = 0;

    // Match -TYPE-content-TYPE- optionally followed by -sg-...-sg- and -ipc-...-ipc-
    const pattern =
        /-(hr|mr|lr)-([\s\S]*?)-(hr|mr|lr)-(?:\s*-sg-([\s\S]*?)-sg-)?(?:\s*-ipc-([\s\S]*?)-ipc-)?/g;

    const cleanMarkdown = markdown.replace(
        pattern,
        (_match, type: RiskLevel, content: string, _closeType, suggestion = "", ipc = "") => {
            const id = `risk-${counter++}`;
            annotations.push({
                id,
                type,
                content: content.trim(),
                suggestion: suggestion.trim(),
                ipc: ipc.trim(),
            });

            // Replace with an HTML span that has data attributes for styling
            // The content stays visible but wrapped in a marked span
            return `<mark data-risk="${type}" data-risk-id="${id}">${content.trim()}</mark>`;
        }
    );

    return { cleanMarkdown, annotations };
}

export const RISK_CONFIG: Record<
    RiskLevel,
    { label: string; color: string; bg: string; border: string; badge: string }
> = {
    hr: {
        label: "High Risk",
        color: "text-red-700 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-950/30",
        border: "border-red-200 dark:border-red-800",
        badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    },
    mr: {
        label: "Medium Risk",
        color: "text-orange-700 dark:text-orange-400",
        bg: "bg-orange-50 dark:bg-orange-950/30",
        border: "border-orange-200 dark:border-orange-800",
        badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
    },
    lr: {
        label: "Low Risk",
        color: "text-yellow-700 dark:text-yellow-400",
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
        border: "border-yellow-200 dark:border-yellow-800",
        badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
    },
};
