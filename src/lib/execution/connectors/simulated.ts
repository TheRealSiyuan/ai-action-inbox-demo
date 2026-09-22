import type { Action } from "@/lib/actions/types";
import { isExecutableType, type ActionConnector, type ConnectorResult } from "../types";
import type { ActionType } from "@/lib/schemas";
export class SimulatedConnector implements ActionConnector {
    readonly name = "simulated";
    readonly simulated = true;
    supports(type: ActionType) { return isExecutableType(type); }
    async execute(action: Action): Promise<ConnectorResult> {
        return {
            detail: `Simulation complete: ${action.title}. Nothing was sent, booked or saved to an external service.`,
            externalId: null,
            externalUrl: null,
        };
    }
}
