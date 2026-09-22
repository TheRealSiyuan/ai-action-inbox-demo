export const INJECTION_PATTERNS: ReadonlyArray<readonly [
    string,
    RegExp
]> = [
    ["instruction override", /\b(?:ignore|disregard|forget)\b[^.?!\n]{0,40}\b(?:previous|prior|above|earlier|all)\b[^.?!\n]{0,20}\b(?:instruction|prompt|rule|direction)/i],
    ["self-approval", /\bmark\b[^.?!\n]{0,30}\bas\b[^.?!\n]{0,10}\bapproved\b|\bset\b[^.?!\n]{0,20}\bstatus\b[^.?!\n]{0,20}\bapproved\b|\bapprove\b[^.?!\n]{0,20}\b(?:this|it|yourself|automatically)\b/i],
    ["execution demand", /\bexecute\b[^.?!\n]{0,30}\b(?:immediately|now|automatically|without)\b|\bwithout\b[^.?!\n]{0,20}\b(?:asking|approval|review|confirmation|the user)\b/i],
    ["false authorisation", /\byou are\b[^.?!\n]{0,20}\bauthoris|\byou are\b[^.?!\n]{0,20}\bauthoriz|\bno (?:approval|review|confirmation) (?:is )?(?:needed|required)\b/i],
    ["auto-send demand", /\bsend\b[^.?!\n]{0,25}\bautomatically\b|\bauto-?send\b|\bsend it (?:now|straight away|immediately)\b/i],
    ["prompt extraction", /\b(?:system prompt|your instructions|initial prompt)\b/i],
];
export type InjectionFinding = {
    label: string;
    matched: string;
};
export function detectInjection(message: string): InjectionFinding[] {
    const findings: InjectionFinding[] = [];
    for (const [label, pattern] of INJECTION_PATTERNS) {
        const match = message.match(pattern);
        if (match)
            findings.push({ label, matched: match[0].trim().slice(0, 120) });
    }
    return findings;
}
export function describeInjection(findings: InjectionFinding[]): string | null {
    if (findings.length === 0)
        return null;
    const labels = [...new Set(findings.map((f) => f.label))].join(", ");
    return `This message contains text attempting to instruct the system (${labels}). It was treated as data and had no effect: the planner cannot approve or execute anything.`;
}
