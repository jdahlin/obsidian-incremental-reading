/**
 * Exhaustiveness checking helper for switch statements.
 *
 * Usage:
 * ```typescript
 * type Status = 'new' | 'learning' | 'review'
 *
 * function getLabel(status: Status): string {
 *   switch (status) {
 *     case 'new': return 'New'
 *     case 'learning': return 'Learning'
 *     case 'review': return 'Review'
 *     default: return assertNever(status)
 *   }
 * }
 * ```
 *
 * If a new variant is added to Status, TypeScript will error
 * because the new variant won't be assignable to `never`.
 */
export function assertNever(value: never, message?: string): never {
	throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`)
}
