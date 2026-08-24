import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "amber" | "ghost" | "secondary" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-blue-900 text-white hover:bg-blue-800",
  amber: "bg-amber-500 text-white hover:bg-amber-400",
  secondary: "border border-slate-200 bg-white text-slate-800 hover:border-blue-900 hover:text-blue-900",
  ghost: "border border-white/25 bg-white/10 text-white hover:bg-white/20",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-[18px] py-3 font-extrabold transition-transform transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-0.5 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  className = "",
  interactive = true,
  children,
}: {
  className?: string;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm transition-transform transition-shadow duration-200 ${
        interactive ? "hover:-translate-y-1 hover:shadow-lg" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="p-7">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Badge (status pill)                                                 */
/* ------------------------------------------------------------------ */

export type BadgeTone = "pending" | "processing" | "completed" | "failed" | "neutral";

const BADGE_STYLES: Record<BadgeTone, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${BADGE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline gap-2 text-sm font-bold text-slate-700">
        {label}
        {hint && (
          <span className="text-xs font-normal text-slate-500">{hint}</span>
        )}
      </span>
      {children}
    </label>
  );
}

const CONTROL =
  "w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} ${props.className ?? ""}`} />;
}

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-blue-900">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-extrabold text-slate-900 md:text-4xl">{title}</h1>
      </div>
      {action}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* CitationPin — numbered source pin in an answer                      */
/* ------------------------------------------------------------------ */

export function CitationPin({ index }: { index: number }) {
  return (
    <sup className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-900 px-1 align-middle text-[11px] font-bold leading-none text-white">
      {index}
    </sup>
  );
}

/* ------------------------------------------------------------------ */
/* ErrorBanner                                                         */
/* ------------------------------------------------------------------ */

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
    >
      {children}
    </p>
  );
}
