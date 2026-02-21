"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const NAV_TABS = [
    { label: "Analysis", href: "/analysis" },
    { label: "Negotiation", href: "/negotiation" },
    { label: "Draft", href: "/final-draft" },
];

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, signOut, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
            <header className="flex-none flex items-center justify-between border-b border-border bg-background px-6 py-3 z-20 shadow-sm">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push("/")}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                        <div className="flex size-8 items-center justify-center rounded bg-foreground text-background">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" />
                            </svg>
                        </div>
                        <span className="text-lg font-bold tracking-tight">NyayaAI</span>
                    </button>
                </div>

                {/* Center nav */}
                <nav className="hidden md:flex items-center bg-muted rounded-lg p-1">
                    {NAV_TABS.map((tab) => {
                        const isActive = pathname === tab.href;
                        return (
                            <button
                                key={tab.href}
                                onClick={() => router.push(tab.href)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${isActive
                                        ? "bg-background text-foreground shadow-sm border border-border font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Right side */}
                <div className="flex items-center gap-4">
                    {!isLoading && user && (
                        <>
                            <span className="text-sm text-muted-foreground hidden sm:inline">
                                {user.name}
                            </span>
                            <Button variant="outline" size="sm" onClick={signOut}>
                                Sign Out
                            </Button>
                        </>
                    )}
                </div>
            </header>
            <main className="flex-1 overflow-hidden">{children}</main>
        </div>
    );
}
