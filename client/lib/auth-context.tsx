"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface User {
    id: string;
    name: string;
    phone: string;
}

interface AuthContextType {
    user: User | null;
    isSignedIn: boolean;
    isLoading: boolean;
    signUp: (name: string, phone: string) => Promise<void>;
    signIn: (phone: string) => Promise<void>;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("nyayaai_user");
        if (stored) {
            try {
                setUser(JSON.parse(stored));
            } catch {
                localStorage.removeItem("nyayaai_user");
            }
        }
        setIsLoading(false);
    }, []);

    const signUp = async (name: string, phone: string) => {
        const res = await fetch(`${API_BASE}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Sign up failed");
        }

        const userData: User = await res.json();
        setUser(userData);
        localStorage.setItem("nyayaai_user", JSON.stringify(userData));
    };

    const signIn = async (phone: string) => {
        const res = await fetch(`${API_BASE}/auth/signin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Sign in failed");
        }

        const userData: User = await res.json();
        setUser(userData);
        localStorage.setItem("nyayaai_user", JSON.stringify(userData));
    };

    const signOut = () => {
        setUser(null);
        localStorage.removeItem("nyayaai_user");
    };

    return (
        <AuthContext.Provider
            value={{ user, isSignedIn: !!user, isLoading, signUp, signIn, signOut }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
