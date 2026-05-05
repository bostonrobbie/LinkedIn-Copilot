// Keyboard shortcuts overlay. Triggered by Cmd+/ or Ctrl+/.

import { useEffect, useState } from 'react';

export const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: 'Cmd+1 … Cmd+8', label: 'Switch tabs (Home, New Outreach, Activity, Accounts, Analytics, Playbook, Audit, Settings)' },
  { keys: 'Cmd+K', label: 'Open command palette (jump to anything)' },
  { keys: 'Cmd+N', label: 'New outreach' },
  { keys: 'Enter', label: 'Run pipeline (in New Outreach source step)' },
  { keys: 'Esc', label: 'Close detail / overlays' },
  { keys: 'Cmd+/', label: 'Toggle this shortcuts overlay' }
];

export function useShortcutsOverlay(): { open: boolean; setOpen: (b: boolean) => void } {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === '/') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}

export default function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-ink-900/85 backdrop-blur flex items-center justify-center p-8" onClick={onClose}>
      <div className="card max-w-md w-full p-6 border-white/10" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold tracking-tight">Keyboard shortcuts</h2>
        <table className="mt-4 w-full text-sm">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys} className="border-b border-white/5 last:border-0">
                <td className="py-2 pr-4 font-mono text-xs text-ink-200/70 whitespace-nowrap">{s.keys}</td>
                <td className="py-2 text-ink-100">{s.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 text-xs text-ink-200/50">Press Cmd+/ to close.</div>
      </div>
    </div>
  );
}
