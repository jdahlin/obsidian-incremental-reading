const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * MS_PER_DAY);
}

export function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60 * 1000);
}

export function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isToday(date: Date, now: Date = new Date()): boolean {
	return startOfDay(date).getTime() === startOfDay(now).getTime();
}

export function daysBetween(a: Date, b: Date): number {
	const startA = startOfDay(a).getTime();
	const startB = startOfDay(b).getTime();
	return Math.round((startB - startA) / MS_PER_DAY);
}
