"use client";

import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { AuthDialog } from "@/components/auth-dialog";
import { Highlighter } from "@/components/ui/highlighter";
import { WordRotate } from "@/components/ui/word-rotate";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
    gsap.registerPlugin(useGSAP, ScrollTrigger);
}

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
    const container = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        gsap.from("nav", { y: -100, opacity: 0, duration: 1, ease: "power3.out" });

        gsap.from(".hero-content > *", {
            y: 50,
            opacity: 0,
            duration: 1,
            stagger: 0.2,
            ease: "power3.out",
            delay: 0.2
        });

        gsap.from(".stat-item", {
            scrollTrigger: {
                trigger: ".stats-section",
                start: "top 85%",
            },
            y: 30,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power2.out",
        });

        gsap.from(".split-left", {
            scrollTrigger: {
                trigger: ".split-section",
                start: "top 75%",
            },
            x: -50,
            opacity: 0,
            duration: 1,
            ease: "power3.out",
        });
        
        gsap.from(".split-right", {
            scrollTrigger: {
                trigger: ".split-section",
                start: "top 75%",
            },
            x: 50,
            opacity: 0,
            duration: 1,
            ease: "power3.out",
        });

        gsap.from(".feature-card", {
            scrollTrigger: {
                trigger: ".features-section",
                start: "top 80%",
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power2.out",
        });

        gsap.from(".step-item", {
            scrollTrigger: {
                trigger: ".how-it-works-section",
                start: "top 60%",
            },
            y: 50,
            opacity: 0,
            duration: 0.2,
            stagger: 0.3,
            ease: "power3.out",
        });

        gsap.from(".cta-content", {
            scrollTrigger: {
                trigger: ".cta-section",
                start: "top 75%",
            },
            y: 30,
            opacity: 0,
            duration: 1,
            ease: "power2.out",
        });
    }, { scope: container });

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
        <div ref={container} className="min-h-screen w-full bg-surface text-on-surface font-manrope selection:bg-primary-fixed selection:text-on-primary-fixed relative">
            
            {/* Hidden file input for file uploading */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* TopNavBar */}
            <nav className="fixed top-0 w-full h-20 z-50 bg-surface/80 backdrop-blur-xl grid-bg">
                <div className="flex justify-between items-center px-8 w-full max-w-[1440px] mx-auto h-full">
                    <div className="font-anton text-3xl tracking-tighter text-[#ffe17c]">NYAYAI</div>
                    <div className="hidden md:flex gap-8 items-center">
                        <a className="font-satoshi font-bold tracking-tight text-sm text-white/70 hover:text-white transition-colors" href="#features">FEATURES</a>
                        <a className="font-satoshi font-bold tracking-tight text-sm text-white/70 hover:text-white transition-colors" href="#how-it-works">HOW IT WORKS</a>
                        <a className="font-satoshi font-bold tracking-tight text-sm text-white/70 hover:text-white transition-colors" href="#pricing">PRICING</a>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {!isLoading && isSignedIn ? (
                            <>
                                <span className="hidden text-sm font-medium text-white/70 font-satoshi sm:block">
                                    Hi, {user?.name}
                                </span>
                                <button className="bg-transparent border border-outline-variant text-white px-6 py-2 font-anton text-sm hover:bg-white/10 transition-all duration-300" onClick={signOut}>
                                    SIGN OUT
                                </button>
                            </>
                        ) : (
                            <button className="bg-primary-fixed text-on-primary-fixed px-6 py-2 font-anton text-sm hover:translate-x-[-4px] hover:translate-y-[-4px] transition-all duration-300 shadow-[4px_4px_0px_0px_#2f3731]" onClick={() => setAuthDialogOpen(true)}>
                                LOG IN
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <main className="pt-20">
                {/* Hero Section */}
                <section className="min-h-screen flex flex-col justify-center items-start px-8 py-20 grid-bg relative overflow-hidden" 
                         onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                         onDragLeave={() => setDragActive(false)}
                         onDrop={handleDrop}>
                    <div className="max-w-[1440px] mx-auto w-full hero-content">
                        <div className="inline-flex items-center gap-2 px-4 py-1 bg-surface-container-highest border border-outline-variant/30 mb-8">
                            <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse"></span>
                            <span className="font-satoshi text-xs font-bold tracking-widest uppercase">Supports latest Indian Laws</span>
                        </div>
                        <h1 className="font-anton text-6xl md:text-9xl uppercase leading-[0.9] tracking-tighter mb-12 max-w-5xl">
                            Your Autonomous Legal <span className="block md:inline skew-highlight text-neutral-300 stroke-text">Red-Flag Agent</span>
                        </h1>
                        <p className="font-satoshi text-xl md:text-2xl text-on-surface-variant max-w-3xl mb-12">
                            Instant risk assessment and redlining based on Indian Contract Act &amp; Corporate Law. Simply upload your contract and let our multi-agent AI secure your interests.
                        </p>
                        <div className="flex flex-col gap-6 w-full max-w-2xl">
                            <div className={`flex flex-col md:flex-row gap-0 w-full transition-all border ${dragActive ? 'border-primary-fixed bg-primary-fixed/5' : 'border-transparent'}`}>
                                <div className="flex-grow bg-surface-container-low border-b-2 border-tertiary-fixed-dim p-4 md:p-6 font-satoshi text-base md:text-lg flex items-center gap-4 text-white/50 cursor-pointer hover:bg-surface-container-highest transition-colors"
                                     onClick={() => fileInputRef.current?.click()}
                                >
                                    <span className="material-symbols-outlined">{uploading ? "hourglass_empty" : "upload_file"}</span>
                                    <span>{uploading ? "Uploading & Analyzing..." : "PDF up to 10MB — drag & drop or click to browse"}</span>
                                </div>
                                <button
                                    disabled={uploading}
                                    className="bg-primary-fixed text-on-primary-fixed px-8 md:px-12 py-4 md:py-6 font-anton text-xl md:text-2xl hover:bg-white transition-all duration-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => {
                                        if (!isSignedIn) {
                                            setAuthDialogOpen(true);
                                        } else {
                                            fileInputRef.current?.click();
                                        }
                                    }}
                                >
                                    {uploading ? "PROCESSING..." : "UPLOAD CONTRACT"}
                                </button>
                            </div>
                            <div className="flex gap-4 items-center flex-wrap">
                                <div className="flex items-center gap-1 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                                    <span className="material-symbols-outlined text-[14px] text-primary-fixed">lock</span>
                                    <span className="font-satoshi text-[10px] font-bold tracking-widest uppercase text-white/60">ENCRYPTED</span>
                                </div>
                                <div className="flex items-center gap-1 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                                    <span className="material-symbols-outlined text-[14px] text-primary-fixed">verified_user</span>
                                    <span className="font-satoshi text-[10px] font-bold tracking-widest uppercase text-white/60">ISO 27001</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Stats Section */}
                <section className="bg-white py-16 stats-section">
                    <div className="max-w-[1440px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-12 px-8">
                        <div className="flex flex-col stat-item">
                            <span className="font-satoshi text-5xl md:text-6xl font-bold text-[#0e1510] tracking-tighter">10k+</span>
                            <span className="font-anton text-base md:text-lg text-[#0e1510]/60 uppercase mt-2">Contracts Analyzed</span>
                        </div>
                        <div className="flex flex-col stat-item">
                            <span className="font-satoshi text-5xl md:text-6xl font-bold text-[#0e1510] tracking-tighter">50k+</span>
                            <span className="font-anton text-base md:text-lg text-[#0e1510]/60 uppercase mt-2">Risks Detected</span>
                        </div>
                        <div className="flex flex-col stat-item">
                            <span className="font-satoshi text-5xl md:text-6xl font-bold text-[#0e1510] tracking-tighter">500+</span>
                            <span className="font-anton text-base md:text-lg text-[#0e1510]/60 uppercase mt-2">Acts Covered</span>
                        </div>
                        <div className="flex flex-col stat-item">
                            <span className="font-satoshi text-5xl md:text-6xl font-bold text-[#0e1510] tracking-tighter">99%</span>
                            <span className="font-anton text-base md:text-lg text-[#0e1510]/60 uppercase mt-2">Accuracy Rate</span>
                        </div>
                    </div>
                </section>

                {/* Problem-Solution Split */}
                <section className="flex flex-col lg:flex-row w-full border-t border-b border-outline-variant/20 split-section">
                    <div className="flex-1 bg-surface-container-low p-10 md:p-24 split-left">
                        <h2 className="font-anton text-4xl md:text-5xl mb-12 uppercase text-white/30">THE OLD WAY</h2>
                        <ul className="space-y-8">
                            <li className="flex items-start gap-4">
                                <span className="material-symbols-outlined text-error text-3xl">close</span>
                                <p className="font-satoshi text-lg md:text-xl">Manual review taking 48-72 hours per draft.</p>
                            </li>
                            <li className="flex items-start gap-4">
                                <span className="material-symbols-outlined text-error text-3xl">close</span>
                                <p className="font-satoshi text-lg md:text-xl">Human error in identifying outdated IPC references.</p>
                            </li>
                            <li className="flex items-start gap-4">
                                <span className="material-symbols-outlined text-error text-3xl">close</span>
                                <p className="font-satoshi text-lg md:text-xl">High hourly legal fees for standard boilerplate.</p>
                            </li>
                        </ul>
                    </div>
                    <div className="flex-1 bg-[#272727] p-10 md:p-24 border-y-8 lg:border-y-0 lg:border-x-8 border-primary-fixed split-right">
                        <h2 className="font-anton text-4xl md:text-5xl mb-12 uppercase text-primary-fixed">THE FLUX WAY</h2>
                        <ul className="space-y-8">
                            <li className="flex items-start gap-4">
                                <span className="material-symbols-outlined text-primary-fixed text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                <p className="font-satoshi text-lg md:text-xl text-white">Instant red-flag reporting under 30 seconds.</p>
                            </li>
                            <li className="flex items-start gap-4">
                                <span className="material-symbols-outlined text-primary-fixed text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                <p className="font-satoshi text-lg md:text-xl text-white">Automatic Bharatiya Nyaya Sanhita alignment.</p>
                            </li>
                            <li className="flex items-start gap-4">
                                <span className="material-symbols-outlined text-primary-fixed text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                <p className="font-satoshi text-lg md:text-xl text-white">Flat subscription for unlimited deep scans.</p>
                            </li>
                        </ul>
                    </div>
                </section>

                {/* Bento Grid Features Section */}
                <section className="py-24 px-4 md:px-8 bg-surface features-section" id="features">
                    <div className="max-w-[1440px] mx-auto mb-16 feature-card">
                        <h2 className="font-anton text-5xl md:text-7xl uppercase mb-6">Multi-Agent Architecture</h2>
                        <p className="font-satoshi text-lg md:text-xl text-on-surface-variant max-w-2xl">Three specialized agents work in tandem to deconstruct, analyze, and cross-reference your contracts against Indian legal frameworks.</p>
                    </div>
                    <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Agent 1 */}
                        <div className="lg:col-span-2 bg-[#f8f9fa] p-8 md:p-10 flex flex-col justify-between min-h-[400px] feature-card">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="material-symbols-outlined text-surface text-3xl">account_tree</span>
                                    <h3 className="font-anton text-3xl md:text-4xl text-[#0e1510] uppercase">Parser Agent</h3>
                                </div>
                                <p className="font-satoshi text-base md:text-lg text-[#0e1510]/70 max-w-md">Deconstructs complex legalese into structured JSON data. It identifies definitions, clauses, and schedules, preparing the document for analysis.</p>
                            </div>
                            <div className="mt-8 relative h-48 bg-white border border-black/10 p-6 shadow-xl overflow-hidden font-satoshi text-xs text-black/40 rounded-sm">
                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                    <span>document_structure.json</span>
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                    </div>
                                </div>
                                <div className="space-y-1 font-mono">
                                    <div className="text-blue-600">{`{`}</div>
                                    <div className="pl-4">"clauses": [</div>
                                    <div className="pl-8 text-green-600">"1.1_definitions": {`{ ... },`}</div>
                                    <div className="pl-8 text-green-600">"4.2_indemnity": {`{ "risk": "high" },`}</div>
                                    <div className="pl-8 text-green-600">"9.0_termination": [ ... ]</div>
                                    <div className="pl-4">]</div>
                                    <div className="text-blue-600">{`}`}</div>
                                </div>
                            </div>
                        </div>
                        {/* Agent 2 */}
                        <div className="bg-surface-container-low p-8 md:p-10 flex flex-col justify-between border-b-8 border-error min-h-[400px] feature-card">
                            <span className="material-symbols-outlined text-error text-5xl mb-6">gpp_maybe</span>
                            <div>
                                <h3 className="font-anton text-3xl text-white mb-4 uppercase">Risk Detector</h3>
                                <p className="font-satoshi text-white/60 text-base md:text-lg">Scans for unfair indemnity clauses, unlimited liability, and ambiguous termination rights based on your specific playbook parameters.</p>
                            </div>
                        </div>
                        {/* Agent 3 */}
                        <div className="bg-primary-fixed p-8 md:p-10 flex flex-col justify-between min-h-[400px] feature-card">
                            <span className="material-symbols-outlined text-black text-5xl mb-6">gavel</span>
                            <div>
                                <h3 className="font-anton text-3xl text-black mb-4 uppercase">Legal Cross-Ref</h3>
                                <p className="font-satoshi text-black/80 text-base md:text-lg">Validates clauses against current Indian case law, the Indian Contract Act (1872), and recent Supreme Court judgments.</p>
                            </div>
                        </div>
                        {/* Jurisprudence Engine */}
                        <div className="lg:col-span-2 bg-[#f8f9fa] p-8 md:p-10 flex flex-col justify-between min-h-[400px] feature-card">
                            <div>
                                <h3 className="font-anton text-3xl md:text-4xl text-[#0e1510] mb-4 uppercase">Jurisprudence Engine</h3>
                                <p className="font-satoshi text-base md:text-lg text-[#0e1510]/70 max-w-md">Our proprietary model scans against Supreme Court precedents to ensure your terms are enforceable in current courts.</p>
                            </div>
                            <div className="mt-8 relative h-48 bg-white border border-black/10 p-4 shadow-xl overflow-hidden rounded-sm">
                                <div className="flex gap-2 mb-4">
                                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="col-span-1 space-y-2">
                                        <div className="h-3 w-full bg-gray-100"></div>
                                        <div className="h-3 w-3/4 bg-gray-100"></div>
                                        <div className="h-3 w-1/2 bg-primary-fixed"></div>
                                    </div>
                                    <div className="col-span-2 border-l border-gray-100 pl-4">
                                        <div className="h-32 w-full bg-gray-50 flex items-center justify-center relative">
                                            <div className="p-2 border border-primary-fixed bg-white font-satoshi text-[10px] text-black shadow-sm">
                                                RISK DETECTED: CLAUSE 4.2
                                            </div>
                                            <span className="material-symbols-outlined absolute top-1/2 left-1/2 text-black text-lg pointer-events-none" style={{ transform: "translate(-50%, -50%)" }}>near_me</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-1 mt-2">
                                            <div className="bg-primary-fixed h-full" style={{ width: "65%" }}></div>
                                        </div>
                                    </div>
                                    <div className="col-span-1 space-y-4">
                                        <div className="w-10 h-10 bg-[#FFE17C]"></div>
                                        <div className="space-y-1">
                                            <div className="h-2 w-full bg-gray-200"></div>
                                            <div className="h-2 w-full bg-gray-200"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How It Works Section */}
                <section className="max-w-[1440px] mx-auto py-24 px-8 flex flex-col lg:flex-row gap-20 how-it-works-section" id="how-it-works">
                    <div className="lg:w-1/3 step-item">
                        <div className="lg:sticky lg:top-32">
                            <h2 className="font-anton text-6xl md:text-7xl lg:text-8xl uppercase">Legal Intelligence Flow</h2>
                            <p className="font-satoshi text-lg md:text-xl text-on-surface-variant mt-8 uppercase tracking-widest font-bold">Streamline your contract review process in three simple, automated steps.</p>
                        </div>
                    </div>
                    <div className="lg:w-2/3 space-y-24 md:space-y-[500px] mt-12 lg:mt-0">
                        <div className="relative group step-item">
                            <span className="font-anton text-8xl md:text-9xl absolute -top-12 md:-top-16 -left-4 md:-left-8 opacity-10 transition-opacity group-hover:opacity-20 pointer-events-none">01</span>
                            <div className="relative z-10 pl-6 md:pl-0">
                                <h4 className="font-anton text-3xl md:text-4xl mb-4 uppercase text-primary-fixed">Upload Contract</h4>
                                <p className="font-satoshi text-lg md:text-xl text-on-surface-variant leading-relaxed">Securely drag and drop your PDF file. We support English and Hindi legal documents.</p>
                            </div>
                        </div>
                        <div className="relative group step-item">
                            <span className="font-anton text-8xl md:text-9xl absolute -top-12 md:-top-16 -left-4 md:-left-8 opacity-10 transition-opacity group-hover:opacity-20 pointer-events-none">02</span>
                            <div className="relative z-10 pl-6 md:pl-0">
                                <h4 className="font-anton text-3xl md:text-4xl mb-4 uppercase text-primary-fixed">AI Analysis</h4>
                                <p className="font-satoshi text-lg md:text-xl text-on-surface-variant leading-relaxed">Our agents parse, interpret, and risk-score every clause against 50+ customizable legal parameters.</p>
                            </div>
                        </div>
                        <div className="relative group step-item">
                            <span className="font-anton text-8xl md:text-9xl absolute -top-12 md:-top-16 -left-4 md:-left-8 opacity-10 transition-opacity group-hover:opacity-20 pointer-events-none">03</span>
                            <div className="relative z-10 pl-6 md:pl-0">
                                <h4 className="font-anton text-3xl md:text-4xl mb-4 uppercase text-primary-fixed">Risk Score &amp; Report</h4>
                                <p className="font-satoshi text-lg md:text-xl text-on-surface-variant leading-relaxed">Receive a downloadable report with a risk heatmap and suggested redlines ready for negotiation.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="bg-primary-fixed py-24 md:py-32 px-8 relative overflow-hidden cta-section" id="pricing">
                    <div className="font-anton text-[12rem] md:text-[20rem] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black/5 pointer-events-none uppercase whitespace-nowrap">SECURE</div>
                    <div className="max-w-[1440px] mx-auto text-center relative z-10 cta-content">
                        <h2 className="font-anton text-5xl md:text-7xl lg:text-9xl uppercase leading-[0.9] text-[#231b00] mb-8">Secure your legal agreements</h2>
                        <p className="font-satoshi text-lg md:text-2xl text-black/70 mb-12 max-w-2xl mx-auto uppercase font-bold tracking-tight">Join forward-thinking legal teams using NyayaAI to reduce contract review time by 80%.</p>
                        <div className="max-w-md mx-auto bg-[#161d18] p-8">
                            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); /* optional email signup logic */ }}>
                                <div className="text-left">
                                    <label className="font-anton text-xs text-primary-fixed mb-2 block uppercase">Business Email</label>
                                    <input className="w-full bg-surface-container-highest border-b-2 border-primary-fixed/30 focus:border-primary-fixed focus:ring-0 text-white p-4 font-satoshi outline-none transition-colors duration-300" placeholder="you@company.com" type="email" />
                                </div>
                                <button type="submit" className="w-full bg-primary-fixed text-on-primary-fixed py-6 font-anton text-2xl hover:bg-white transition-all duration-300">
                                    GET ACCESS
                                </button>
                                <p className="font-satoshi text-xs text-white/40 mt-4 uppercase font-bold">No credit card required · 14-day free trial</p>
                            </form>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-[#161d18] w-full border-t border-[#b7c6c210]">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-8 py-20 max-w-[1440px] mx-auto">
                    <div className="md:col-span-2">
                        <div className="font-anton text-3xl text-[#ffe17c] mb-6">NYAYAI</div>
                        <p className="font-satoshi text-sm opacity-60 text-white max-w-xs mb-8">Autonomous legal intelligence for the modern Indian enterprise.</p>
                        <div className="flex gap-6">
                            <span className="material-symbols-outlined text-white/40 hover:text-[#ffe17c] cursor-pointer transition-colors">public</span>
                            <span className="material-symbols-outlined text-white/40 hover:text-[#ffe17c] cursor-pointer transition-colors">terminal</span>
                            <span className="material-symbols-outlined text-white/40 hover:text-[#ffe17c] cursor-pointer transition-colors">shield</span>
                        </div>
                    </div>
                    <div>
                        <h5 className="font-anton uppercase text-xl text-[#ffe17c] mb-6">PRODUCT</h5>
                        <ul className="space-y-4">
                            <li><a className="font-satoshi text-sm text-white/40 hover:text-[#ffe17c] transition-colors hover:translate-x-1 inline-block duration-200" href="#features">FEATURES</a></li>
                            <li><a className="font-satoshi text-sm text-white/40 hover:text-[#ffe17c] transition-colors hover:translate-x-1 inline-block duration-200" href="#pricing">PRICING</a></li>
                            <li><a className="font-satoshi text-sm text-white/40 hover:text-[#ffe17c] transition-colors hover:translate-x-1 inline-block duration-200" href="#">API</a></li>
                        </ul>
                        <h5 className="font-anton uppercase text-xl text-[#ffe17c] mt-12 mb-6">COMPANY</h5>
                        <ul className="space-y-4">
                            <li><a className="font-satoshi text-sm text-white/40 hover:text-[#ffe17c] transition-colors hover:translate-x-1 inline-block duration-200" href="#">ABOUT US</a></li>
                            <li><a className="font-satoshi text-sm text-white/40 hover:text-[#ffe17c] transition-colors hover:translate-x-1 inline-block duration-200" href="#">CONTACT</a></li>
                            <li><a className="font-satoshi text-sm text-white/40 hover:text-[#ffe17c] transition-colors hover:translate-x-1 inline-block duration-200" href="#">PRIVACY</a></li>
                        </ul>
                    </div>
                    <div>
                        <h5 className="font-anton uppercase text-xl text-[#ffe17c] mb-6">RESOURCES</h5>
                        <ul className="space-y-4">
                            <li><a className="font-satoshi text-sm text-white/40 hover:text-[#ffe17c] transition-colors hover:translate-x-1 inline-block duration-200 uppercase" href="#">Blog</a></li>
                            <li><a className="font-satoshi text-sm text-white/40 hover:text-[#ffe17c] transition-colors hover:translate-x-1 inline-block duration-200 uppercase" href="#">Legal Playbooks</a></li>
                            <li><a className="font-satoshi text-sm text-white/40 hover:text-[#ffe17c] transition-colors hover:translate-x-1 inline-block duration-200 uppercase" href="#">Case Studies</a></li>
                        </ul>
                    </div>
                </div>
                <div className="px-8 py-10 max-w-[1440px] mx-auto border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="font-satoshi text-xs opacity-40 text-white">© 2026 NYAYAI TECHNOLOGIES PVT LTD. PRECISION BRUTALISM APPLIED.</p>
                    <div className="flex gap-8">
                        <a className="font-satoshi text-xs opacity-40 text-white hover:opacity-100 transition-opacity" href="#">TERMS</a>
                        <a className="font-satoshi text-xs opacity-40 text-white hover:opacity-100 transition-opacity" href="#">PRIVACY</a>
                        <a className="font-satoshi text-xs opacity-40 text-white hover:opacity-100 transition-opacity" href="#">COOKIES</a>
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
    );
}