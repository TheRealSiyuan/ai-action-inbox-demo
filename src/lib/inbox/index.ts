import { SampleInboxProvider } from "./sample-inbox";
export type { InboxMessage, InboxMessageBody, InboxProvider } from "./types";
export { toMessageSource } from "./types";
export function getInbox() { return new SampleInboxProvider(); }
