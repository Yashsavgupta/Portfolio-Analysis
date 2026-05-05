import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: ReactNode;
}

export function Card({ title, children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-slate-700 bg-slate-900/80 shadow-sm shadow-slate-900/20 ${className}`}
      {...props}
    >
      {title ? <h3 className="px-6 pt-6 text-xl font-semibold text-slate-100">{title}</h3> : null}
      <div className={`${title ? 'px-6 pb-6 pt-4' : ''} text-slate-300`}>{children}</div>
    </div>
  );
}

export default Card;
