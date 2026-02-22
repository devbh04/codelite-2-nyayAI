"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { AuthDialog } from "@/components/auth-dialog";
import { Highlighter } from "@/components/ui/highlighter";
import { WordRotate } from "@/components/ui/word-rotate";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const AGENT_API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:8000";

export default function LandingPage() {
    const router = useRouter();
    const { isSignedIn, user, signOut, isLoading } = useAuth();
    const [authDialogOpen, setAuthDialogOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingFileRef = useRef<File | null>(null);

    const doUpload = useCallback(
        async (file: File) => {
            setUploading(true);
            try {
                // Upload to BOTH backends in parallel
                const plainForm = new FormData();
                plainForm.append("file", file);
                const agentForm = new FormData();
                agentForm.append("file", file);

                const [plainRes, agentRes] = await Promise.all([
                    // Old server (8001) — just PDF→markdown
                    fetch(`${API_BASE}/upload`, { method: "POST", body: plainForm }),
                    // Agent system (8000) — full analysis
                    fetch(`${AGENT_API_BASE}/analyze`, { method: "POST", body: agentForm }),
                ]);

                // Handle plain markdown from old server
                if (!plainRes.ok) {
                    alert("Failed to convert PDF to markdown");
                    return;
                }
                const plainData = await plainRes.json();

                // Handle agent analysis result
                if (!agentRes.ok) {
                    const err = await agentRes.json();
                    alert(err.detail || "Analysis failed");
                    return;
                }
                const analysisResult = await agentRes.json();

                // Download annotated markdown from agent system
                const annotatedFile = Object.entries(analysisResult.files as Record<string, string>)
                    .find(([key]) => key.includes("annotated_contract"));

                let annotatedMd = "";
                if (annotatedFile) {
                    const mdRes = await fetch(`${AGENT_API_BASE}/download/${annotatedFile[1]}`);
                    if (mdRes.ok) {
                        annotatedMd = await mdRes.text();
                    }
                }

                // Store original (clean) markdown from old server
                sessionStorage.setItem("nyayaai_analysis", JSON.stringify(plainData));

                // Store annotated markdown from agent system
                sessionStorage.setItem("nyayaai_edited_md", annotatedMd);

                // Store risk scores
                sessionStorage.setItem("nyayaai_risk_score", JSON.stringify({
                    overall_risk_score: analysisResult.overall_risk_score,
                    high_risk_count: analysisResult.high_risk_count,
                    medium_risk_count: analysisResult.medium_risk_count,
                    low_risk_count: analysisResult.low_risk_count,
                    total_clauses: analysisResult.total_clauses,
                    executive_summary: analysisResult.executive_summary,
                    top_risks: analysisResult.top_risks,
                }));

                router.push("/analysis");
            } catch {
                alert("Failed to connect to servers. Make sure both backends are running.");
            } finally {
                setUploading(false);
            }
        },
        [router]
    );

    const handleUpload = useCallback(
        (file: File) => {
            if (!isSignedIn) {
                pendingFileRef.current = file;
                setAuthDialogOpen(true);
                return;
            }
            doUpload(file);
        },
        [isSignedIn, doUpload]
    );

    const handleAuthSuccess = useCallback(() => {
        setAuthDialogOpen(false);
        if (pendingFileRef.current) {
            const file = pendingFileRef.current;
            pendingFileRef.current = null;
            doUpload(file);
        }
    }, [doUpload]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
        e.target.value = "";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    };

    return (
        <div className="min-h-screen w-full bg-white relative text-foreground">
            {/* Morning Haze */}
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: `
                        radial-gradient(circle at 50% 100%, rgba(253, 224, 71, 0.6) 0%, transparent 70%),
                        radial-gradient(circle at 50% 100%, rgba(251, 191, 36, 0.55) 0%, transparent 85%),
                        radial-gradient(circle at 50% 100%, rgba(244, 114, 182, 0.6) 0%, transparent 95%)
                    `,
                }}
            />
            <div className="relative z-10 flex flex-col min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
                    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
                        <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded">
                                <img src="/logo.png" alt="" />
                            </div>
                            <span className="text-lg font-bold tracking-tight">NyayAI</span>
                        </div>
                        <nav className="hidden md:flex items-center gap-8">
                            <a className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" href="#features">Features</a>
                            <a className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" href="#how-it-works">How it Works</a>
                            <a className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" href="#cta">Pricing</a>
                        </nav>
                        <div className="flex items-center gap-4">
                            {!isLoading && isSignedIn ? (
                                <>
                                    <span className="hidden text-sm font-medium text-muted-foreground sm:block">
                                        Hi, {user?.name}
                                    </span>
                                    <Button variant="outline" size="sm" onClick={signOut}>
                                        Sign Out
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:block"
                                        onClick={() => setAuthDialogOpen(true)}
                                    >
                                        Log in
                                    </button>
                                    <Button size="sm" onClick={() => setAuthDialogOpen(true)}>
                                        Get Started
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1">
                    {/* Hero */}
                    <section className="relative pt-24 pb-20 lg:pt-20 lg:pb-12">
                        {/* Diagonal Fade Center Grid */}
                        <div
                            className="absolute -inset-12 z-0"
                            style={{
                                backgroundImage: `
                                    linear-gradient(to right, #d1d5db 1px, transparent 1px),
                                    linear-gradient(to bottom, #d1d5db 1px, transparent 1px)
                                `,
                                backgroundSize: "32px 32px",
                                WebkitMaskImage:
                                    "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 70%)",
                                maskImage:
                                    "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 70%)",
                            }}
                        />
                        <div className="mx-auto max-w-6xl px-6 lg:px-8 text-center relative z-10">
                            <div className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground mb-8">
                                <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                Supports latest Indian Laws
                            </div>
                            <h1 className="mx-auto max-w-5xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl mb-6 leading-tight">
                                Your Autonomous Legal <br />
                                <WordRotate words={["Red-Flag Agent", "Negotiation Assistant", "Risk Assessment"]} />
                            </h1>
                            <p className="mx-auto max-w-2xl text-lg text-black pt-4 mb-12 leading-relaxed font-light">
                                Instant{" "}
                                <Highlighter action="highlight" color="#fab44d">
                                    risk assessment and redlining
                                </Highlighter>{" "}
                                based on Indian Contract Act &amp; Corporate Law. Simply upload your contract and let our{" "}
                                <Highlighter action="underline" color="#87CEFA">
                                    multi-agent AI
                                </Highlighter>{" "}
                                secure your interests.
                            </p>

                            {/* Upload zone */}
                            <div className="mx-auto max-w-xl">
                                <div
                                    className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-all cursor-pointer ${dragActive
                                        ? "border-primary bg-primary/5 shadow-md"
                                        : "border-border bg-background/70 hover:border-primary hover:bg-background hover:shadow-sm"
                                        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragActive(true);
                                    }}
                                    onDragLeave={() => setDragActive(false)}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-background border border-border text-muted-foreground shadow-sm transition-transform group-hover:scale-105 group-hover:text-primary group-hover:border-primary/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-base font-semibold">
                                            {uploading ? "Uploading & Analyzing..." : "Upload Contract"}
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            PDF up to 10MB — drag & drop or click to browse
                                        </p>
                                    </div>
                                    <div className="mt-6">
                                        <Button
                                            disabled={uploading}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                fileInputRef.current?.click();
                                            }}
                                        >
                                            {uploading ? "Processing..." : "Analyze Now"}
                                        </Button>
                                    </div>
                                    <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                                        <span className="flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                            Encrypted
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                                            ISO 27001
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Stats */}
                    <section className="border-y border-border bg-muted/30 py-12">
                        <div className="mx-auto max-w-6xl px-6 lg:px-8">
                            <div className="grid grid-cols-2 gap-8 md:grid-cols-4 text-center">
                                {[
                                    { value: "10k+", label: "Contracts Analyzed" },
                                    { value: "50k+", label: "Risks Detected" },
                                    { value: "500+", label: "Acts Covered" },
                                    { value: "99%", label: "Accuracy Rate" },
                                ].map((stat) => (
                                    <div key={stat.label} className="flex flex-col items-center gap-1">
                                        <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
                                        <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Multi-Agent Architecture */}
                    <section id="features" className="py-24 bg-background">
                        <div className="mx-auto max-w-6xl px-6 lg:px-8">
                            <div className="mb-16 md:text-center max-w-2xl mx-auto">
                                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Multi-Agent Architecture</h2>
                                <p className="mt-4 text-base text-muted-foreground font-light">
                                    Three specialized agents work in tandem to deconstruct, analyze, and cross-reference your contracts against Indian legal frameworks.
                                </p>
                            </div>
                            <div className="grid gap-8 md:grid-cols-3">
                                {[
                                    {
                                        icon: (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                                        ),
                                        title: "Parser Agent",
                                        desc: "Deconstructs complex legalese into structured JSON data. It identifies definitions, clauses, and schedules, preparing the document for analysis.",
                                    },
                                    {
                                        icon: (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        ),
                                        title: "Risk Detector",
                                        desc: "Scans for unfair indemnity clauses, unlimited liability, and ambiguous termination rights based on your specific playbook parameters.",
                                    },
                                    {
                                        icon: (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 14-8.5 8.5a2.12 2.12 0 1 1-3-3L11 11" /><path d="M16 16 6 6" /><path d="m8 8 6-6 4 4-6 6" /><path d="m16 16 6 6" /></svg>
                                        ),
                                        title: "Legal Cross-Ref",
                                        desc: "Validates clauses against current Indian case law, the Indian Contract Act (1872), and recent Supreme Court judgments.",
                                    },
                                ].map((card) => (
                                    <div
                                        key={card.title}
                                        className="group rounded-xl border border-border bg-background p-8 transition-all hover:shadow-lg hover:-translate-y-1"
                                    >
                                        <div className="mb-6 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-foreground ring-1 ring-border">
                                            {card.icon}
                                        </div>
                                        <h3 className="mb-3 text-lg font-bold">{card.title}</h3>
                                        <p className="text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* How It Works */}
                    <section id="how-it-works" className="py-24 bg-muted/30 border-t border-border">
                        <div className="mx-auto max-w-6xl px-6 lg:px-8">
                            <div className="mb-16">
                                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Legal Intelligence Flow</h2>
                                <p className="mt-4 text-base text-muted-foreground font-light max-w-xl">
                                    Streamline your contract review process in three simple, automated steps.
                                </p>
                            </div>
                            <div className="grid gap-12 md:grid-cols-3 relative">
                                <div className="absolute top-10 left-0 right-0 hidden md:block border-t border-dashed border-border w-full z-0"></div>
                                {[
                                    { step: "1", title: "Upload Contract", desc: "Securely drag and drop your PDF file. We support English and Hindi legal documents." },
                                    { step: "2", title: "AI Analysis", desc: "Our agents parse, interpret, and risk-score every clause against 50+ customizable legal parameters." },
                                    { step: "3", title: "Risk Score & Report", desc: "Receive a downloadable report with a risk heatmap and suggested redlines ready for negotiation." },
                                ].map((item) => (
                                    <div key={item.step} className="relative z-10 flex flex-col gap-6">
                                        <div className="flex size-20 items-center justify-center rounded-full bg-background border border-border shadow-sm mx-auto md:mx-0">
                                            <span className="text-xl font-bold">{item.step}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* CTA */}
                    <section id="cta" className="py-24 bg-background border-t border-border">
                        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
                            <h2 className="text-3xl font-bold tracking-tight mb-6">Secure your legal agreements</h2>
                            <p className="text-muted-foreground mb-10 text-lg font-light">
                                Join forward-thinking legal teams using NyayaAI to reduce contract review time by 80%.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                <Button
                                    size="lg"
                                    className="min-w-[160px]"
                                    onClick={() => {
                                        if (isSignedIn) {
                                            fileInputRef.current?.click();
                                        } else {
                                            setAuthDialogOpen(true);
                                        }
                                    }}
                                >
                                    Start Free Trial
                                </Button>
                                <Button variant="outline" size="lg" className="min-w-[160px]">
                                    Book a Demo
                                </Button>
                            </div>
                            <p className="mt-8 text-xs text-muted-foreground/50">
                                No credit card required · 14-day free trial
                            </p>
                        </div>
                    </section>
                </main>

                {/* Footer */}
                <footer className="bg-muted/30 border-t border-border py-16 text-sm">
                    <div className="mx-auto max-w-6xl px-6 lg:px-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
                            <div className="col-span-2 md:col-span-1 pr-8">
                                <div className="flex items-center gap-2 mb-6">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" />
                                    </svg>
                                    <span className="text-base font-bold">NyayaAI</span>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Autonomous legal intelligence for the modern Indian enterprise.
                                </p>
                            </div>
                            {[
                                { title: "Product", links: ["Features", "Pricing", "API"] },
                                { title: "Resources", links: ["Blog", "Legal Playbooks", "Case Studies"] },
                                { title: "Company", links: ["About Us", "Contact", "Privacy"] },
                            ].map((col) => (
                                <div key={col.title}>
                                    <h3 className="font-semibold mb-4">{col.title}</h3>
                                    <ul className="space-y-3 text-muted-foreground">
                                        {col.links.map((link) => (
                                            <li key={link}>
                                                <a className="hover:text-foreground transition-colors" href="#">
                                                    {link}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground/60">
                            <p>© 2026 NyayaAI Technologies Pvt Ltd.</p>
                            <div className="flex gap-6">
                                <a className="hover:text-foreground transition-colors" href="#">Terms</a>
                                <a className="hover:text-foreground transition-colors" href="#">Privacy</a>
                                <a className="hover:text-foreground transition-colors" href="#">Cookies</a>
                            </div>
                        </div>
                    </div>
                </footer>

                {/* Auth Dialog */}
                <AuthDialog
                    open={authDialogOpen}
                    onOpenChange={setAuthDialogOpen}
                    onSuccess={handleAuthSuccess}
                />
            </div>
        </div>
    );
}