"use client";
import { useState } from "react";
import type { ModeStatus } from "@/lib/mode";
import type { StorageSummary } from "@/lib/client-api";
import { Button } from "./ui";
export function SettingsPanel({ status, storage, onErase }: {
    status: ModeStatus;
    storage: StorageSummary;
    onErase: () => Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return <div className="space-y-6 p-5 text-sm">
    <section><h3 className="font-semibold">Public demo</h3><p className="mt-2">{status.planner.label}</p><p>{status.inbox.label}</p><p>{status.execution.label}</p></section>
    <section><h3 className="font-semibold">This session</h3><p className="mt-2">{storage.messages} messages reviewed · {storage.actions} suggestions · {storage.auditEvents} activity entries</p><p className="text-ink-muted mt-2">Demo state lives only in server memory and is shared by tabs on this local server. Resetting clears suggestions and activity; the sample inbox remains available.</p></section>
    {error ? <p role="alert" className="text-negative">{error}</p> : null}
    <Button variant="negative" disabled={busy} onClick={async () => { setBusy(true); setError(null); try {
        await onErase();
    }
    catch {
        setError("Could not reset the demo. Please try again.");
    }
    finally {
        setBusy(false);
    } }}>{busy ? "Resetting…" : "Reset demo"}</Button>
  </div>;
}
