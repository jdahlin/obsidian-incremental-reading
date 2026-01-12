/**
 * Recursively makes all properties readonly.
 * Handles arrays, objects, Maps, Sets, and treats Date as immutable.
 * Functions, primitives, and branded types are preserved as-is.
 */
export type DeepReadonly<T> = T extends
	| string
	| number
	| boolean
	| symbol
	| bigint
	| null
	| undefined
	? T
	: T extends Date
		? T
		: // eslint-disable-next-line ts/no-explicit-any
			T extends (...args: readonly any[]) => any
			? T
			: T extends ReadonlyMap<infer K, infer V>
				? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
				: T extends Map<infer K, infer V>
					? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
					: T extends ReadonlySet<infer U>
						? ReadonlySet<DeepReadonly<U>>
						: T extends Set<infer U>
							? ReadonlySet<DeepReadonly<U>>
							: T extends readonly (infer U)[]
								? readonly DeepReadonly<U>[]
								: T extends (infer U)[]
									? readonly DeepReadonly<U>[]
									: T extends object
										? { readonly [K in keyof T]: DeepReadonly<T[K]> }
										: T
