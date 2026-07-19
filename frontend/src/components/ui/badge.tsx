import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  className = "",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center px-2 py-0.5 rounded font-extrabold text-[10px] uppercase tracking-wider select-text";

  const variants = {
    success: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse",
    info: "bg-blue-500/10 text-blue-500 border border-blue-500/20",
    neutral: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700"
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
