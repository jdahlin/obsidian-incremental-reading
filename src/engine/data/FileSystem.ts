export interface FileSystem {
	/**
	 * Read file content as string.
	 * Returns null if file does not exist.
	 */
	read(path: string): Promise<string | null>;

	/**
	 * Write content to file.
	 * Creates parent directories if needed.
	 */
	write(path: string, content: string): Promise<void>;

	/**
	 * Delete file.
	 * Does nothing if file does not exist.
	 */
	delete(path: string): Promise<void>;

	/**
	 * Check if file exists.
	 */
	exists(path: string): Promise<boolean>;

	/**
	 * List all files (recursively).
	 * Returns array of file paths relative to root.
	 */
	list(): Promise<string[]>;
}
