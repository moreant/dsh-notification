import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { NotificationProjectionState, NotificationProjectionValue } from './contract.ts';
import type { ResolvedConfig } from './types.ts';
export type { NotificationProjectionState } from './contract.ts';
/** The empty-log view (no completed turn yet). */
export declare const EMPTY_PROJECTION: NotificationProjectionValue;
/**
 * Bound one reply to the body budget, ellipsizing on overflow. Kept in the
 * fold so the persisted state never grows past the budget.
 * @param text - the accumulated reply text.
 * @param maxChars - the character budget.
 * @returns the bounded text.
 */
export declare function boundText(text: string, maxChars: number): string;
/**
 * Apply one committed event to the fold state. Uninteresting events return the
 * same reference (Object.is gates the change feed).
 * @param state - the state covering all prior events.
 * @param event - the next committed event.
 * @param maxChars - the body budget.
 * @returns the next state.
 */
export declare function applyProjectionEvent(state: NotificationProjectionState, event: SessionEvent, maxChars: number): NotificationProjectionState;
/**
 * Build the `notification` projection unit.
 * @param config - resolved plugin configuration (body budget).
 * @returns the projection definition registered on the projection seam.
 */
export declare function notificationProjection(config: ResolvedConfig): Omit<ProjectionDefinition<'notification', NotificationProjectionState>, 'wire'> & {
    wire: NonNullable<ProjectionDefinition<'notification', NotificationProjectionState>['wire']>;
};
