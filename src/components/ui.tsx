import type { ButtonHTMLAttributes, ReactNode } from "react";
type ButtonVariant = "primary" | "secondary" | "ghost" | "positive" | "negative";
const BUTTON_BASE = "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    secondary: "border border-line-strong bg-surface text-ink hover:bg-canvas",
    ghost: "text-ink-muted hover:bg-canvas hover:text-ink",
    positive: "border border-positive/30 bg-positive-soft text-positive hover:bg-positive/15",
    negative: "border border-negative/30 bg-surface text-negative hover:bg-negative-soft",
};
export function Button({ variant = "secondary", size = "md", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md";
}) {
    const sizing = size === "sm" ? "h-8 px-3" : "h-10 px-4";
    return (<button type="button" className={`${BUTTON_BASE} ${sizing} ${BUTTON_VARIANTS[variant]} ${className}`} {...props}/>);
}
type Tone = "neutral" | "accent" | "positive" | "negative" | "caution";
const TONES: Record<Tone, string> = {
    neutral: "border-line-strong bg-canvas text-ink-muted",
    accent: "border-accent/25 bg-accent-soft text-accent",
    positive: "border-positive/25 bg-positive-soft text-positive",
    negative: "border-negative/25 bg-negative-soft text-negative",
    caution: "border-caution/30 bg-caution-soft text-caution",
};
export function Badge({ tone = "neutral", children, }: {
    tone?: Tone;
    children: ReactNode;
}) {
    return (<span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${TONES[tone]}`}>
      {children}
    </span>);
}
export function Panel({ title, description, actions, children, }: {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (<section aria-label={title} className="border-line bg-surface rounded-xl border shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <header className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-ink text-[13px] font-semibold tracking-[0.08em] uppercase">
            {title}
          </h2>
          {description ? (<p className="text-ink-subtle mt-1 text-[13px]">{description}</p>) : null}
        </div>
        {actions}
      </header>
      {children}
    </section>);
}
export function Fact({ label, children }: {
    label: string;
    children: ReactNode;
}) {
    return (<div className="min-w-0">
      <dt className="text-ink-subtle text-[11px] font-semibold tracking-[0.08em] uppercase">
        {label}
      </dt>
      <dd className="text-ink mt-1 text-sm break-words">{children}</dd>
    </div>);
}
export function Note({ tone, children }: {
    tone: "caution" | "accent";
    children: ReactNode;
}) {
    const styles = tone === "caution"
        ? "border-caution/25 bg-caution-soft text-caution"
        : "border-accent/20 bg-accent-soft text-accent";
    return (<p className={`rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${styles}`}>
      {children}
    </p>);
}
