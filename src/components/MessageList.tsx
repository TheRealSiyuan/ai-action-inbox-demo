"use client";
import type { InboxMessage } from "@/lib/inbox/types";
import { formatRelative } from "./labels";
export function MessageList({ messages, selectedId, busy, onSelect, error, handledIds, }: {
    messages: InboxMessage[];
    selectedId: string | null;
    busy: boolean;
    onSelect: (message: InboxMessage) => void;
    error: string | null;
    handledIds: Set<string>;
}) {
    if (error) {
        return (<p role="alert" className="text-negative px-5 py-4 text-sm">
        {error}
      </p>);
    }
    if (messages.length === 0) {
        return <p className="text-ink-subtle px-5 py-4 text-sm">Nothing here right now.</p>;
    }
    return (<ul aria-label="Inbox messages" className="divide-line divide-y">
      {messages.map((message) => {
            const selected = selectedId === message.id;
            return (<li key={message.id}>
            <button type="button" onClick={() => onSelect(message)} disabled={busy} aria-current={selected} className={`hover:bg-canvas w-full px-4 py-3 text-left transition-colors disabled:cursor-wait ${selected ? "bg-accent-soft" : ""}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-ink truncate text-[13px] font-semibold">{message.from}</span>
                <time className="text-ink-subtle shrink-0 text-[11px]">
                  {formatRelative(message.receivedAt)}
                </time>
              </div>
              <div className="text-ink mt-0.5 flex items-center gap-1.5 truncate text-[13px]">
                {handledIds.has(message.id) ? (<span aria-label="Reviewed" className="text-positive shrink-0">
                    ✓
                  </span>) : null}
                <span className="truncate">{message.subject}</span>
              </div>
              <div className="text-ink-subtle mt-0.5 truncate text-xs">{message.snippet}</div>
            </button>
          </li>);
        })}
    </ul>);
}
