import { ActionInbox } from "@/components/ActionInbox";
import { resolveMode, inboxForMode } from "@/lib/mode";
import { storageSummary } from "@/lib/store/repository";
export const dynamic = "force-dynamic";
export default async function Page() {
    const status = await resolveMode();
    const messages = await inboxForMode().list(20);
    return <ActionInbox initial={{ status, storage: storageSummary() }} initialInbox={messages} initialInboxError={null}/>;
}
