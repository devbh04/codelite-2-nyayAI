"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Button } from "@/components/ui/button";
import { RiskSidebar } from "@/components/analysis/risk-sidebar";
import { mdComponents } from "@/components/analysis/md-components";
import { parseAnnotations, useAnnotationStore } from "@/lib/annotations-store";

interface AnalysisData {
    markdown: string;
    filename: string;
}

export default function AnalysisPage() {
    const router = useRouter();
    const [originalMd, setOriginalMd] = useState<string>("");
    const [editedMd, setEditedMd] = useState<string | null>(null);
    const [filename, setFilename] = useState<string>("");
    const [view, setView] = useState<"preview" | "md" | "edit">("preview");
    const [mdVersion, setMdVersion] = useState<"original" | "edited">("original");
    const [editContent, setEditContent] = useState("");
    const [loaded, setLoaded] = useState(false);
    const { setAnnotations, annotations, clear } = useAnnotationStore();

    useEffect(() => {
        const stored = sessionStorage.getItem("nyayaai_analysis");
        if (!stored) {
            router.push("/");
            return;
        }
        try {
            const parsed: AnalysisData = JSON.parse(stored);
            setOriginalMd(parsed.markdown);
            setFilename(parsed.filename);

            // Load saved edited version if exists
            const savedEdited = sessionStorage.getItem("nyayaai_edited_md");
            if (savedEdited) {
                setEditedMd(savedEdited);
                setMdVersion("edited");
            }

            setLoaded(true);
        } catch {
            router.push("/");
        }
    }, [router, clear]);

    // The active markdown based on version toggle
    const activeMd = mdVersion === "edited" && editedMd !== null ? editedMd : originalMd;

    const cleanMarkdown = useMemo(() => {
        if (!activeMd) return "";
        return parseAnnotations(activeMd).cleanMarkdown;
    }, [activeMd]);

    useEffect(() => {
        if (!activeMd) return;
        const { annotations: parsed } = parseAnnotations(activeMd);
        setAnnotations(parsed);
    }, [activeMd, setAnnotations]);

    const handleApplyEdit = useCallback(() => {
        setEditedMd(editContent);
        sessionStorage.setItem("nyayaai_edited_md", editContent);
        setMdVersion("edited");
        setView("preview");
    }, [editContent]);

    if (!loaded) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                    <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading analysis...</p>
                </div>
            </div>
        );
    }

    const hasEdited = editedMd !== null;

    return (
        <div className="flex h-full overflow-hidden">
            {/* Document panel */}
            <section className="flex-1 flex flex-col overflow-hidden border-r border-border">
                {/* File info bar */}
                <div className="flex-none flex items-center justify-between px-6 py-2 bg-background border-b border-border text-sm">
                    <div className="flex items-center gap-3">
                        <span className="font-semibold text-foreground">{filename}</span>
                        <span className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 text-xs font-medium border border-green-200 dark:border-green-800">
                            Analysis Complete
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
                            <Button variant={view === "preview" ? "default" : "ghost"} size="sm" onClick={() => setView("preview")} className="h-7 px-2.5 text-xs gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                Preview
                            </Button>
                            <Button variant={view === "md" ? "default" : "ghost"} size="sm" onClick={() => setView("md")} className="h-7 px-2.5 text-xs gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                                MD
                            </Button>
                            <Button variant={view === "edit" ? "default" : "ghost"} size="sm" onClick={() => { setEditContent(activeMd); setView("edit"); }} className="h-7 px-2.5 text-xs gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                Edit
                            </Button>
                        </div>
                        {view === "edit" && (
                            <Button size="sm" onClick={handleApplyEdit} className="h-7 text-xs">Apply</Button>
                        )}
                        <button
                            onClick={() => {
                                sessionStorage.removeItem("nyayaai_analysis");
                                sessionStorage.removeItem("nyayaai_edited_md");
                                clear();
                                router.push("/");
                            }}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Upload new"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                        </button>
                    </div>
                </div>


                {/* Document content */}
                <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-muted/20">
                    <div className="w-full max-w-[800px] bg-background shadow-sm border border-border rounded-lg h-fit">
                        {/* Original / Edited toggle — shown above the document */}
                        {(view === "preview" || view === "md") && hasEdited && (
                            <div className="flex-none flex items-center gap-2 px-8 pt-4 bg-muted/20">
                                <div className="inline-flex items-center rounded-full border border-border bg-background p-0.5 shadow-sm">
                                    <button
                                        onClick={() => setMdVersion("original")}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${mdVersion === "original"
                                            ? "bg-foreground text-background shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                            }`}
                                    >
                                        Original
                                    </button>
                                    <button
                                        onClick={() => setMdVersion("edited")}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${mdVersion === "edited"
                                            ? "bg-foreground text-background shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                            }`}
                                    >
                                        Edited
                                    </button>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                    {mdVersion === "original" ? "Viewing original from backend" : "Viewing your edits"}
                                </span>
                            </div>
                        )}
                        {view === "preview" && (
                            <div className="p-10 lg:p-12 break-words">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={mdComponents}>
                                    {cleanMarkdown}
                                </ReactMarkdown>
                            </div>
                        )}
                        {view === "md" && (
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words p-10 text-sm font-mono text-foreground/80 leading-relaxed">
                                {activeMd}
                            </pre>
                        )}
                        {view === "edit" && (
                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full min-h-[600px] border-0 bg-transparent p-10 text-sm font-mono text-foreground leading-relaxed resize-y focus:outline-none"
                                placeholder="Paste or type your markdown content here..."
                                spellCheck={false}
                            />
                        )}
                    </div>
                </div>
            </section>

            {/* Right sidebar */}
            {annotations.length > 0 && (
                <div className="hidden lg:flex w-[420px] shrink-0">
                    <RiskSidebar />
                </div>
            )}
        </div>
    );
}
