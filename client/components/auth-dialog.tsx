"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function AuthDialog({ open, onOpenChange, onSuccess }: AuthDialogProps) {
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { signUp, signIn } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (mode === "signup") {
                if (!name.trim()) {
                    setError("Name is required");
                    setLoading(false);
                    return;
                }
                await signUp(name.trim(), phone.trim());
            } else {
                await signIn(phone.trim());
            }
            onOpenChange(false);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName("");
        setPhone("");
        setError("");
    };

    const toggleMode = () => {
        setMode(mode === "signin" ? "signup" : "signin");
        resetForm();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "signin" ? "Welcome back" : "Create your account"}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "signin"
                            ? "Enter your phone number to sign in"
                            : "Enter your details to get started"}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4">
                    {mode === "signup" && (
                        <div className="grid gap-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                placeholder="Your full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                            id="phone"
                            type="tel"
                            placeholder="+91 98765 43210"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}

                    <Button type="submit" disabled={loading || !phone.trim()}>
                        {loading
                            ? "Please wait..."
                            : mode === "signin"
                                ? "Sign In"
                                : "Sign Up"}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        {mode === "signin"
                            ? "Don't have an account? "
                            : "Already have an account? "}
                        <button
                            type="button"
                            onClick={toggleMode}
                            className="text-primary underline underline-offset-4 hover:text-primary/80"
                        >
                            {mode === "signin" ? "Sign Up" : "Sign In"}
                        </button>
                    </p>
                </form>
            </DialogContent>
        </Dialog>
    );
}
