import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  children?: ReactNode;
  variant?: 'primary' | 'outline';
}

export function Button({
  label,
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  const variantClass =
    variant === 'outline'
      ? 'border border-slate-600 bg-transparent text-slate-100 hover:bg-slate-800'
      : 'bg-sky-500 text-slate-950 hover:bg-sky-400';

  return (
    <button
      type={type}
      className={`rounded-full px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
      {...props}
    >
      {children ?? label}
    </button>
  );
}

export default Button;
