import type { WorkflowContext, WorkflowState } from "../workflow_manager";

export const validateStateName = (state: WorkflowState, expectedName: string): void => {
	if (state.name !== expectedName) {
		throw new Error(`Invalid state type. expected: ${expectedName}, actual: ${state.type}`);
	}
};
