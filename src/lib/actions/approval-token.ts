import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { materialFingerprint } from "./materiality";
import type { Action, ApprovalRecord } from "./types";
const runtime = globalThis as typeof globalThis & {
    demoApprovalKey?: string;
};
const secret = runtime.demoApprovalKey ??= randomBytes(32).toString("hex");
function payloadToSign(fingerprint: string, approvedAt: string, approvedBy: string): string {
    return JSON.stringify({ fingerprint, approvedAt, approvedBy });
}
export type Signer = (fingerprint: string, approvedAt: string, approvedBy: string) => string;
export const hmacSigner: Signer = (fingerprint, approvedAt, approvedBy) => createHmac("sha256", secret).update(payloadToSign(fingerprint, approvedAt, approvedBy)).digest("hex");
export function buildApproval(action: Action, approvedAt: string, approvedBy: string, sign: Signer = hmacSigner): ApprovalRecord {
    const fingerprint = materialFingerprint(action);
    return {
        fingerprint,
        approvedAt,
        approvedBy,
        signature: sign(fingerprint, approvedAt, approvedBy),
    };
}
export type VerificationResult = {
    valid: true;
} | {
    valid: false;
    reason: "BAD_SIGNATURE" | "FINGERPRINT_MISMATCH";
};
export function verifyApproval(action: Action, approval: ApprovalRecord, sign: Signer = hmacSigner): VerificationResult {
    const expected = sign(approval.fingerprint, approval.approvedAt, approval.approvedBy);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(approval.signature, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return { valid: false, reason: "BAD_SIGNATURE" };
    }
    if (materialFingerprint(action) !== approval.fingerprint) {
        return { valid: false, reason: "FINGERPRINT_MISMATCH" };
    }
    return { valid: true };
}
