import type { Metadata } from "next";
import { Anton, Space_Grotesk, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const anton = Anton({ weight: "400", variable: "--font-anton", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-satoshi", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NyayaAI — Autonomous Legal Red-Flag Agent",
  description:
    "Instant risk assessment and redlining based on Indian Contract Act & Corporate Law. Upload your contract and let our multi-agent AI secure your interests.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${anton.variable} ${spaceGrotesk.variable} ${manrope.variable}`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`antialiased dark`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
