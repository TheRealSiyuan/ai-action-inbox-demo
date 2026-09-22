import "server-only";
import { SimulatedConnector } from "@/lib/execution/connectors/simulated";
import { SampleInboxProvider } from "@/lib/inbox/sample-inbox";
import { MockActionPlanner } from "@/lib/planner/mock-planner";
export type ModeStatus = {
    mode: "DEMO";
    planner: {
        name: string;
        label: string;
        local: boolean;
    };
    inbox: {
        name: string;
        label: string;
        live: boolean;
    };
    execution: {
        name: string;
        label: string;
        simulated: boolean;
    };
};
export async function resolveMode(): Promise<ModeStatus> {
    return {
        mode: "DEMO",
        planner: { name: "mock-rules-v1", label: "Built-in rules · no AI service", local: true },
        inbox: { name: "sample-inbox", label: "Fictional sample messages", live: false },
        execution: { name: "simulated", label: "Simulation only · nothing sent or booked", simulated: true },
    };
}
export async function plannerForMode() { return new MockActionPlanner(); }
export function inboxForMode() { return new SampleInboxProvider(); }
export function connectorForMode() { return new SimulatedConnector(); }
