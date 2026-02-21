import { Components } from "react-markdown";
import { RiskMark } from "@/components/analysis/risk-mark";
import { type RiskLevel } from "@/lib/annotations-store";

export const mdComponents: Components = {
    h1: ({ children }) => (
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-10 mb-4 pb-3 border-b border-border first:mt-0">
            {children}
        </h1>
    ),
    h2: ({ children }) => (
        <h2 className="text-2xl font-bold tracking-tight text-foreground mt-10 mb-3 pb-2 border-b border-border/50">
            {children}
        </h2>
    ),
    h3: ({ children }) => (
        <h3 className="text-xl font-semibold text-foreground mt-8 mb-3">
            {children}
        </h3>
    ),
    h4: ({ children }) => (
        <h4 className="text-lg font-semibold text-foreground mt-6 mb-2">
            {children}
        </h4>
    ),
    p: ({ children }) => (
        <p className="text-[15px] leading-7 text-foreground/90 mb-4 last:mb-0">
            {children}
        </p>
    ),
    a: ({ href, children }) => (
        <a
            href={href}
            className="text-primary font-medium underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-colors"
            target="_blank"
            rel="noopener noreferrer"
        >
            {children}
        </a>
    ),
    ul: ({ children }) => (
        <ul className="my-4 ml-6 list-disc space-y-2 text-[15px] leading-7 text-foreground/90 marker:text-muted-foreground">
            {children}
        </ul>
    ),
    ol: ({ children }) => (
        <ol className="my-4 ml-6 list-decimal space-y-2 text-[15px] leading-7 text-foreground/90 marker:text-muted-foreground marker:font-medium">
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    blockquote: ({ children }) => (
        <blockquote className="my-6 border-l-4 border-primary/40 bg-muted/30 py-3 px-5 rounded-r-lg text-foreground/80 italic [&>p]:mb-0">
            {children}
        </blockquote>
    ),
    code: ({ className, children }) => {
        const isBlock = className?.includes("language-");
        if (isBlock) return <code className="block text-sm">{children}</code>;
        return (
            <code className="rounded-md bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground/90 border border-border/50">
                {children}
            </code>
        );
    },
    pre: ({ children }) => (
        <pre className="my-6 overflow-x-auto rounded-xl bg-muted/80 border border-border/50 p-5 text-sm leading-relaxed font-mono">
            {children}
        </pre>
    ),
    table: ({ children }) => (
        <div className="my-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">{children}</table>
        </div>
    ),
    thead: ({ children }) => (
        <thead className="bg-muted/60 border-b border-border">{children}</thead>
    ),
    tbody: ({ children }) => (
        <tbody className="divide-y divide-border/50">{children}</tbody>
    ),
    tr: ({ children }) => (
        <tr className="transition-colors hover:bg-muted/30">{children}</tr>
    ),
    th: ({ children }) => (
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="px-4 py-3 text-sm text-foreground/90">{children}</td>
    ),
    hr: () => <hr className="my-8 border-t border-border" />,
    strong: ({ children }) => (
        <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }) => (
        <em className="italic text-foreground/80">{children}</em>
    ),

    // Custom <mark> elements rendered by the annotation parser
    mark: ({ children, ...props }) => {
        const riskType = (props as Record<string, string>)["data-risk"] as
            | RiskLevel
            | undefined;
        const riskId = (props as Record<string, string>)["data-risk-id"];

        if (riskType && riskId) {
            return (
                <RiskMark riskType={riskType} riskId={riskId}>
                    {children}
                </RiskMark>
            );
        }
        return <mark>{children}</mark>;
    },
};
