// Skills + Playbooks viewer. Loads markdown directly from data/seed/{skills,playbooks}/
// (ported verbatim from the BDR repo). Two-pane view: sidebar with doc list, main with content.

import { useEffect, useMemo, useState } from 'react';

interface Doc {
  id: string;
  title: string;
  content: string;
  byteSize: number;
}

const STATIC_REFERENCE = [
  {
    id: 'connect-formula-locked',
    title: 'Connection Request — locked formula (INC-022 v1)',
    content: `Hi {First}, I'm at Testsigma, AI-powered test automation, and I connect with {dept} to share what we're building. Your {hook} is what caught my attention. Happy to connect if that sounds worthwhile. Rob

Variables:
  {First}  — first name from live LinkedIn profile
  {dept}   — one of: "QA leaders" | "engineering leaders" | "automation leaders" | "QE leaders"
  {hook}   — single noun phrase, traceable to evidence_quote_for_hook (or tenure-only on LINKEDIN-QUIET)

Hard constraints:
  - 229–278 chars total
  - 0 em dashes, 0 question marks
  - "AI-powered test automation" verbatim
  - "Happy to connect if that sounds worthwhile." verbatim
  - Sign-off ends with "worthwhile. Rob" (inline, NOT new line, NOT "— Rob")`
  },
  {
    id: 'inmail-formula-locked',
    title: 'Sales Nav InMail — 5-paragraph hero formula',
    content: `Subject: 4–10 words, no em dashes, no period.

Body (paragraphs separated by blank lines):
  1. Opener — Hi {First}, I'm at Testsigma, AI-powered test automation. {hook_sentence}. Hopefully its not too much to ask how testing has been holding up at {Company} {tenure_or_activity_context}?
  2. Connector — Reason I'm asking, when {company_category_summary} spans {tech_areas}, the testing surface tends to multiply fast. {area1}, {area2}, {area3}, all hitting cross-stack scenarios at the same time.
  3. Proof — CRED is one example. As their FinTech app scaled, they got to 90% automated regression coverage with 5x faster execution once AI took over the test authoring and self-healing work their team had been carrying manually.
  4. Capability — Testsigma's Agent does that across web, mobile, and API. Plain-English test authoring, AI self-healing when locators break, and coverage gaps surfaced automatically as new features ship.
  5. Close — Curious if any of that sounds like what your team is running into at {Company}?
  Sign-off — Best, Rob

Hard constraints:
  - "Hopefully its not too much to ask" uses LOWERCASE "its" verbatim (intentional voice)
  - Subject 4–10 words, body 700–1100 chars
  - 0 em dashes
  - Hook tier: A (LINKEDIN-QUIET tenure-only) | A+ (substantive activity) | A++ (recipient-amplified or recipient-published)`
  }
];

export default function Playbook() {
  const [skills, setSkills] = useState<Doc[]>([]);
  const [playbooks, setPlaybooks] = useState<Doc[]>([]);
  const [activeId, setActiveId] = useState<string>(STATIC_REFERENCE[0].id);

  useEffect(() => {
    void window.api.listSkills().then((r) => {
      setSkills(r.skills);
      setPlaybooks(r.playbooks);
    });
  }, []);

  const allDocs = useMemo(() => [
    ...STATIC_REFERENCE.map((d) => ({ ...d, byteSize: d.content.length, kind: 'reference' as const })),
    ...skills.map((d) => ({ ...d, kind: 'skill' as const })),
    ...playbooks.map((d) => ({ ...d, kind: 'playbook' as const }))
  ], [skills, playbooks]);

  const active = allDocs.find((d) => d.id === activeId);

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r border-white/5 overflow-y-auto">
        <div className="p-4 border-b border-white/5">
          <div className="text-xs uppercase tracking-wide text-ink-200/50">Reference</div>
        </div>
        <DocList
          label="Locked formulas"
          docs={STATIC_REFERENCE.map((d) => ({ ...d, byteSize: d.content.length }))}
          activeId={activeId}
          onPick={setActiveId}
          tag="ref"
        />
        <DocList
          label="BDR Skills (ported)"
          docs={skills}
          activeId={activeId}
          onPick={setActiveId}
          tag="skill"
        />
        <DocList
          label="BDR Playbooks (ported)"
          docs={playbooks}
          activeId={activeId}
          onPick={setActiveId}
          tag="playbook"
        />
        {skills.length === 0 && playbooks.length === 0 && (
          <div className="p-4 text-xs text-ink-200/40">
            Skills and playbooks are loaded from data/seed/&#123;skills,playbooks&#125;/ at runtime. None found yet.
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-10 max-w-4xl">
          {active && (
            <>
              <h1 className="text-xl font-semibold tracking-tight">{active.title}</h1>
              <div className="text-xs text-ink-200/50 mt-1">
                {active.byteSize.toLocaleString()} bytes · sourced from BDR repo
              </div>
              <pre className="mt-6 text-xs whitespace-pre-wrap font-mono text-ink-200/80 leading-relaxed">
                {active.content}
              </pre>
            </>
          )}
          {!active && (
            <div className="text-ink-200/40 text-sm">Select a doc.</div>
          )}
        </div>
      </main>
    </div>
  );
}

function DocList({
  label,
  docs,
  activeId,
  onPick,
  tag
}: {
  label: string;
  docs: Doc[];
  activeId: string;
  onPick: (id: string) => void;
  tag: 'ref' | 'skill' | 'playbook';
}) {
  if (docs.length === 0) return null;
  const tagClass =
    tag === 'ref'
      ? 'text-emerald-200'
      : tag === 'skill'
        ? 'text-purple-200'
        : 'text-blue-200';
  return (
    <div className="border-b border-white/5">
      <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-ink-200/40">{label}</div>
      {docs.map((d) => (
        <button
          key={d.id}
          onClick={() => onPick(d.id)}
          className={`w-full text-left px-4 py-2 text-sm flex items-start gap-2 transition-colors ${
            activeId === d.id ? 'bg-white/10 text-white' : 'text-ink-200/80 hover:bg-white/5'
          }`}
        >
          <span className={`text-[10px] font-mono uppercase mt-0.5 ${tagClass}`}>{tag}</span>
          <span className="flex-1">{d.title}</span>
        </button>
      ))}
    </div>
  );
}
