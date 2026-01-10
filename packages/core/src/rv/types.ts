export interface RvCommand {
	name: string;
	args: string[];
	line: number;
	raw: string;
}

export interface RvScript {
	commands: RvCommand[];
	expected: string[];
}
