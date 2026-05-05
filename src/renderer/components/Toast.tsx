import { useEffect, useState, useCallback } from 'react';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

let nextId = 1;
const listeners = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];

export function pushToast(kind: Toast['kind'], text: string, ttlMs = 5000): void {
  const t: Toast = { id: nextId++, kind, text };
  toasts = [...toasts, t];
  listeners.forEach((cb) => cb(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    listeners.forEach((cb) => cb(toasts));
  }, ttlMs);
}

export default function ToastHost() {
  const [list, setList] = useState<Toast[]>(toasts);
  const update = useCallback((t: Toast[]) => setList(t), []);
  useEffect(() => {
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, [update]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {list.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto card px-4 py-2.5 text-sm flex items-center gap-2 shadow-lg ${
            t.kind === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : t.kind === 'error'
                ? 'border-red-500/30 bg-red-500/10'
                : 'border-white/10'
          }`}
        >
          <span>{t.kind === 'success' ? '✓' : t.kind === 'error' ? '✗' : 'ℹ'}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
