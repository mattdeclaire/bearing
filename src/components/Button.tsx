import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-amber-400 text-slate-900 hover:bg-amber-300 active:bg-amber-500"
      : "bg-slate-700 text-slate-100 hover:bg-slate-600 active:bg-slate-800";
  return (
    <button
      className={`rounded-xl px-6 py-3 text-lg font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${styles} ${className}`}
      {...props}
    />
  );
}
