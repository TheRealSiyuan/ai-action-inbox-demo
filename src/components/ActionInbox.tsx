"use client";
import { useCallback, useReducer, useState } from "react";
import { ActivityPanel } from "./ActivityPanel";
import { Drawer } from "./Drawer";
import { MessageList } from "./MessageList";
import { MessageView } from "./MessageView";
import { SettingsPanel } from "./SettingsPanel";
import { SetupChecklist } from "./SetupChecklist";
import { Badge, Button } from "./ui";
import { inboxReducer, initialInboxState, type InboxState } from "@/lib/actions/reducer";
import type { ActionEdit } from "@/lib/actions/materiality";
import type { Action } from "@/lib/actions/types";
import type { AuditEvent } from "@/lib/audit/events";
import { analyse, approveAction, editAction, eraseData, executeAction, fetchActivity, rejectAction, type ModeResponse, } from "@/lib/client-api";
import type { InboxMessage } from "@/lib/inbox/types";
export function ActionInbox({ initial, initialInbox, initialInboxError, }: {
    initial: ModeResponse;
    initialInbox: InboxMessage[];
    initialInboxError: string | null;
}) {
    const [mode, setMode] = useState(initial);
    const [inbox] = useState(initialInbox);
    const [inboxError] = useState(initialInboxError);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [handled, setHandled] = useState<Set<string>>(new Set());
    const [state, dispatch] = useReducer(inboxReducer, initialInboxState as InboxState);
    const [busyActionId, setBusyActionId] = useState<string | null>(null);
    const [reading, setReading] = useState(false);
    const [activity, setActivity] = useState<AuditEvent[]>([]);
    const [showActivity, setShowActivity] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const refreshActivity = useCallback(async () => {
        try {
            setActivity((await fetchActivity()).events);
        }
        catch {
        }
    }, []);
    const refreshMode = useCallback(async () => {
        try {
            const response = await fetch("/api/mode");
            if (response.ok)
                setMode((await response.json()) as ModeResponse);
        }
        catch {
        }
    }, []);
    async function openMessage(message: InboxMessage) {
        setSelectedId(message.id);
        setReading(true);
        try {
            dispatch({ kind: "ANALYSIS_COMPLETED", analysis: await analyse({ inboxMessageId: message.id }) });
            setHandled((current) => new Set(current).add(message.id));
        }
        catch (error) {
            dispatch({
                kind: "ANALYSIS_FAILED",
                error: error instanceof Error ? error.message : "Could not read that message.",
            });
        }
        finally {
            setReading(false);
            void refreshActivity();
        }
    }
    async function mutate(action: Action, run: () => Promise<{
        action: Action;
    }>) {
        setBusyActionId(action.id);
        try {
            dispatch({ kind: "ACTION_UPDATED", action: (await run()).action });
        }
        catch (error) {
            dispatch({
                kind: "ERROR",
                error: error instanceof Error ? error.message : "That did not work.",
            });
        }
        finally {
            setBusyActionId(null);
            void refreshActivity();
        }
    }
    async function approveAll(actions: Action[]) {
        for (const action of actions) {
            await mutate(action, () => approveAction(action.id));
        }
    }
    return (<div className="flex h-dvh flex-col">
      <header className="border-line bg-surface flex shrink-0 flex-wrap items-center gap-3 border-b px-5 py-3">
        <h1 className="text-ink text-[15px] font-semibold tracking-tight">Action Inbox</h1>
        <Badge tone="caution">Sample inbox · simulation only</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => {
            void refreshActivity();
            setShowActivity(true);
        }}>
            Activity
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { void refreshMode(); setShowSettings(true); }}>
            Settings
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav aria-label="Inbox" className="border-line bg-surface max-h-56 w-full shrink-0 overflow-y-auto border-b md:max-h-none md:w-[300px] md:border-r md:border-b-0">
          <MessageList messages={inbox} selectedId={selectedId} busy={reading || busyActionId !== null} handledIds={handled} onSelect={(message) => void openMessage(message)} error={inboxError}/>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 sm:px-8">
            <SetupChecklist />

            {state.error ? (<div role="alert" className="border-negative/25 bg-negative-soft text-negative flex items-start gap-3 rounded-xl border px-5 py-4 text-sm">
                <span className="flex-1">{state.error}</span>
                <button type="button" onClick={() => dispatch({ kind: "CLEAR_ERROR" })} className="shrink-0 font-semibold underline underline-offset-2">
                  Dismiss
                </button>
              </div>) : null}

            {reading && !state.analysis ? (<p className="text-ink-subtle py-10 text-center text-sm">
                Reading the sample message…
              </p>) : null}

            {state.analysis ? (<MessageView analysis={state.analysis} busyActionId={busyActionId} onApprove={(action) => void mutate(action, () => approveAction(action.id))} onApproveAll={(actions) => void approveAll(actions)} onReject={(action) => void mutate(action, () => rejectAction(action.id))} onExecute={(action) => void mutate(action, () => executeAction(action.id))} onEdit={(action, edit: ActionEdit) => void mutate(action, () => editAction(action, edit))}/>) : !reading ? (<div className="text-ink-subtle py-16 text-center">
                <p className="text-ink text-[15px] font-medium">Pick a message to get started</p>
                <p className="mt-1 text-[13px]">
                  Action Inbox reads it and suggests what to do. Nothing happens until you approve.
                </p>
              </div>) : null}
          </div>
        </main>
      </div>

      <Drawer title="Activity" open={showActivity} onClose={() => setShowActivity(false)}>
        <ActivityPanel events={activity}/>
      </Drawer>

      <Drawer title="Settings" open={showSettings} onClose={() => setShowSettings(false)}>
        <SettingsPanel status={mode.status} storage={mode.storage} onErase={async () => {
            await eraseData();
            dispatch({ kind: "RESET" });
            setSelectedId(null);
            setHandled(new Set());
            setActivity([]);
            await refreshMode();
        }}/>
      </Drawer>
    </div>);
}
