"use client";
import type { ActionEdit } from "@/lib/actions/materiality";
import type { Action, MessageAnalysis } from "@/lib/actions/types";
import { SuggestionCard } from "./SuggestionCard";
import { Badge, Button } from "./ui";
import { formatDate, PRIORITY_LABELS, PRIORITY_TONES } from "./labels";
export function MessageView({ analysis, busyActionId, onApprove, onApproveAll, onReject, onEdit, onExecute, }: {
    analysis: MessageAnalysis;
    busyActionId: string | null;
    onApprove: (action: Action) => void;
    onApproveAll: (actions: Action[]) => void;
    onReject: (action: Action) => void;
    onEdit: (action: Action, edit: ActionEdit) => void;
    onExecute: (action: Action) => void;
}) {
    const pending = analysis.actions.filter((action) => action.status === "PROPOSED");
    const bulkSafe = pending.length > 1 && pending.every((action) => action.clarificationNeeded === null);
    return (<div className="space-y-6">
      <header className="border-line bg-surface rounded-xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-ink text-lg font-semibold tracking-tight">
              {analysis.source.subject ?? "Pasted message"}
            </h2>
            <p className="text-ink-subtle mt-0.5 text-[13px]">
              {analysis.source.from ? `From ${analysis.source.from}` : "Pasted by hand"}
              {analysis.source.receivedAt
            ? ` · ${formatDate(analysis.source.receivedAt.slice(0, 10))}`
            : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {analysis.priority === "urgent" || analysis.priority === "high" ? (<Badge tone={PRIORITY_TONES[analysis.priority]}>
                {PRIORITY_LABELS[analysis.priority]}
              </Badge>) : null}
            {analysis.needsClarification ? <Badge tone="caution">Needs your input</Badge> : null}
          </div>
        </div>

        <p className="text-ink mt-4 text-[15px] leading-relaxed">{analysis.summary}</p>

        {analysis.deadline ? (<p className="text-ink-muted mt-2 text-[13px]">
            Due {formatDate(analysis.deadline)}
          </p>) : null}

        {analysis.needsClarification && analysis.clarificationReason ? (<p className="border-caution/25 bg-caution-soft text-caution mt-4 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed">
            {analysis.clarificationReason}
          </p>) : null}

        {analysis.suspectedInjection ? (<div role="alert" className="border-negative/25 bg-negative-soft text-negative mt-4 rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed">
            <span className="font-semibold">Careful with this one. </span>
            This message contains hidden text trying to give instructions to Action Inbox — asking
            it to approve and send things by itself. It was ignored, and nothing can happen without
            you approving it. Treat the sender with suspicion.
          </div>) : null}
      </header>

      <details className="border-line bg-surface rounded-xl border p-5">
        <summary className="cursor-pointer text-sm font-medium">Read original sample message</summary>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">{analysis.message}</pre>
      </details>
      <section aria-labelledby="suggestions-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 id="suggestions-heading" className="text-ink text-sm font-semibold">
            {analysis.actions.length === 0
            ? "No suggestions"
            : pending.length > 0
                ? `Suggested — ${pending.length} to review`
                : "Suggested"}
          </h3>
          {bulkSafe ? (<Button size="sm" variant="positive" onClick={() => onApproveAll(pending)}>
              Approve all {pending.length}
            </Button>) : null}
        </div>

        {analysis.actions.map((action) => (<SuggestionCard key={action.id} action={action} busy={busyActionId === action.id} onApprove={() => onApprove(action)} onReject={() => onReject(action)} onEdit={(edit) => onEdit(action, edit)} onExecute={() => onExecute(action)}/>))}
      </section>
    </div>);
}
