"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
    LiveKitRoom,
    RoomAudioRenderer,
    useRoomContext,
    useParticipants,
    useIsSpeaking,
    useLocalParticipant,
} from "@livekit/components-react";

// ── Audio Visualizer Bars ────────────────────────────────────────────────────

function AudioBars({ speaking }: { speaking: boolean }) {
    return (
        <div className="flex items-center justify-center gap-[3px] h-10">
            {[0, 1, 2, 3, 4].map((i) => (
                <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-150 ${speaking
                        ? "bg-green-500 animate-pulse"
                        : "bg-muted-foreground/30"
                        }`}
                    style={{
                        height: speaking
                            ? `${12 + Math.random() * 20}px`
                            : "8px",
                        animationDelay: `${i * 80}ms`,
                    }}
                />
            ))}
        </div>
    );
}

// ── Room Content (inside LiveKitRoom provider) ───────────────────────────────

function RoomContent({ onClose }: { onClose: () => void }) {
    const room = useRoomContext();
    const participants = useParticipants();
    const { localParticipant } = useLocalParticipant();
    const [muted, setMuted] = useState(false);

    // Find the agent participant (may not have joined yet)
    const agentParticipant = participants.find(
        (p) => p.identity !== localParticipant.identity
    );
    // Hook must always be called — use localParticipant as fallback when agent is absent
    const speakingRaw = useIsSpeaking(agentParticipant ?? localParticipant);
    const agentSpeaking = agentParticipant ? speakingRaw : false;

    const toggleMute = useCallback(() => {
        if (localParticipant) {
            localParticipant.setMicrophoneEnabled(muted);
            setMuted(!muted);
        }
    }, [localParticipant, muted]);

    const handleDisconnect = useCallback(() => {
        room.disconnect();
        onClose();
    }, [room, onClose]);

    return (
        <div className="flex flex-col items-center gap-4 py-2">
            {/* This renders all remote audio tracks — REQUIRED for hearing the agent */}
            <RoomAudioRenderer />
            {/* Agent status */}
            <div className="flex flex-col items-center gap-2">
                <div className={`flex size-16 items-center justify-center rounded-full border-2 transition-all ${agentSpeaking
                    ? "border-green-400 bg-green-50 dark:bg-green-950/30 shadow-lg shadow-green-400/20"
                    : "border-border bg-muted/30"
                    }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={agentSpeaking ? "text-green-600" : "text-muted-foreground"}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                </div>
                <AudioBars speaking={agentSpeaking} />
                <p className="text-xs text-muted-foreground">
                    {agentSpeaking ? "Nyaya AI is speaking..." : "Listening..."}
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
                <button
                    onClick={toggleMute}
                    className={`flex size-10 items-center justify-center rounded-full transition-all ${muted
                        ? "bg-red-100 dark:bg-red-950/30 text-red-600 border border-red-200 dark:border-red-800"
                        : "bg-muted/50 text-foreground border border-border hover:bg-muted"
                        }`}
                    title={muted ? "Unmute" : "Mute"}
                >
                    {muted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="2" x2="22" y1="2" y2="22" />
                            <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                            <path d="M5 10v2a7 7 0 0 0 12 5" />
                            <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                            <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                    )}
                </button>
                <button
                    onClick={handleDisconnect}
                    className="flex size-10 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                    title="End call"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                        <line x1="23" x2="1" y1="1" y2="23" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

// ── Main Panel ───────────────────────────────────────────────────────────────

interface VoiceAgentPanelProps {
    open: boolean;
    onClose: () => void;
}

export default function VoiceAgentPanel({ open, onClose }: VoiceAgentPanelProps) {
    const [token, setToken] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const didConnect = useRef(false);

    // Request token when panel opens
    useEffect(() => {
        if (!open || didConnect.current) return;
        didConnect.current = true;

        const connect = async () => {
            setConnecting(true);
            setError(null);

            try {
                // Read document from sessionStorage
                const stored = sessionStorage.getItem("nyayaai_analysis");
                const risks = sessionStorage.getItem("nyayaai_risks");

                const markdown = stored
                    ? JSON.parse(stored).markdown || ""
                    : "";
                const risksStr = risks || "[]";

                const res = await fetch("http://localhost:8000/livekit-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ markdown, risks: risksStr }),
                });

                if (!res.ok) throw new Error(`Server error: ${res.status}`);

                const data = await res.json();
                setToken(data.token);
                setUrl(data.url);
            } catch (e) {
                setError(`Failed to connect: ${e}`);
            } finally {
                setConnecting(false);
            }
        };

        connect();
    }, [open]);

    // Reset on close
    const handleClose = useCallback(() => {
        setToken(null);
        setUrl(null);
        setError(null);
        didConnect.current = false;
        onClose();
    }, [onClose]);

    if (!open) return null;

    return (
        <div className="fixed bottom-24 right-6 z-50 w-[280px] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-semibold text-foreground">Nyaya AI Voice</span>
                </div>
                <button
                    onClick={handleClose}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                </button>
            </div>

            {/* Content */}
            <div className="px-4 py-5">
                {connecting && (
                    <div className="flex flex-col items-center gap-3 py-4">
                        <div className="size-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-muted-foreground">Connecting to Nyaya AI...</p>
                    </div>
                )}

                {error && (
                    <div className="text-center py-4">
                        <p className="text-xs text-red-500">{error}</p>
                        <button
                            onClick={() => {
                                didConnect.current = false;
                                setError(null);
                            }}
                            className="text-xs text-foreground underline mt-2"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {token && url && (
                    <LiveKitRoom
                        token={token}
                        serverUrl={url}
                        connect={true}
                        audio={true}
                        video={false}
                    >
                        <RoomContent onClose={handleClose} />
                    </LiveKitRoom>
                )}
            </div>
        </div>
    );
}
