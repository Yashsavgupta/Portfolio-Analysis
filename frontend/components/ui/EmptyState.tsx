import type { ReactNode } from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  message?: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, message, action }: EmptyStateProps) {
  const body = description ?? message ?? '';

  return (
    <div className="rounded-3xl border border-dashed border-slate-600 bg-slate-900/70 p-8 text-center text-slate-400">
      {title ? <h3 className="text-xl font-semibold text-slate-100">{title}</h3> : null}
      {body ? <p className={title ? 'mt-3' : ''}>{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
