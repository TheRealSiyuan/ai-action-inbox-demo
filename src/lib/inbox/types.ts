import type { MessageSource } from "@/lib/actions/types";
export type InboxMessage = {
    id: string;
    from: string;
    fromEmail: string | null;
    subject: string;
    snippet: string;
    receivedAt: string;
    labels?: string[];
    unsubscribe?: boolean;
};
export type InboxMessageBody = InboxMessage & {
    body: string;
};
export class InboxAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InboxAuthError";
    }
}
export interface InboxProvider {
    readonly name: string;
    readonly live: boolean;
    list(limit: number): Promise<InboxMessage[]>;
    listWindow(days: number, cap: number): Promise<InboxMessage[]>;
    listWindowIds?(days: number, cap: number): Promise<string[]>;
    getHeaders?(id: string): Promise<InboxMessage>;
    get(id: string): Promise<InboxMessageBody>;
}
export function toSummary(message: InboxMessageBody): InboxMessage {
    const { body, ...summary } = message;
    void body;
    return summary;
}
export function toMessageSource(_provider: InboxProvider, message: InboxMessage): MessageSource {
    return {
        kind: "sample",
        label: "Sample inbox",
        externalId: message.id,
        from: message.from,
        subject: message.subject,
        receivedAt: message.receivedAt,
    };
}
