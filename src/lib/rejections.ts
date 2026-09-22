import type { z } from "zod";
export type RejectedValue = {
    path: string;
    message: string;
    value: string;
};
const MAX_REJECTED_VALUE_CHARS = 120;
function valueAtPath(root: unknown, path: ReadonlyArray<PropertyKey>): unknown {
    let current = root;
    for (const key of path) {
        if (current === null || typeof current !== "object")
            return undefined;
        current = (current as Record<PropertyKey, unknown>)[key as keyof object];
    }
    return current;
}
function renderRejectedValue(value: unknown): string {
    if (value === undefined)
        return "(absent)";
    let text: string;
    try {
        text = JSON.stringify(value) ?? String(value);
    }
    catch {
        return "(unserialisable)";
    }
    return text.length > MAX_REJECTED_VALUE_CHARS
        ? `${text.slice(0, MAX_REJECTED_VALUE_CHARS)}…`
        : text;
}
export function describeRejections(issues: ReadonlyArray<z.core.$ZodIssue>, raw: unknown): RejectedValue[] {
    return issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
        value: renderRejectedValue(valueAtPath(raw, issue.path)),
    }));
}
