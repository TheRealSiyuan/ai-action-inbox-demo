export type PlanRequest = {
    message: string;
    now: Date;
    context?: {
        subject?: string | null;
        fromName?: string | null;
        fromEmail?: string | null;
    };
};
export interface ActionPlanner {
    readonly name: string;
    readonly isModel: boolean;
    plan(request: PlanRequest): Promise<unknown>;
}
