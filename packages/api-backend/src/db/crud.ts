function quoteIdent(identifier: string): string {
	return `"${identifier.replace(/"/g, '""')}"`
}

export function buildInsertStatement(
	table: string,
	data: Readonly<Record<string, unknown>>,
	columns: readonly string[],
	returning: readonly string[],
): { sql: string; params: unknown[] } {
	const insertColumns = columns.filter((column) => data[column] !== undefined)
	if (insertColumns.length === 0) {
		throw new Error('No fields to insert')
	}

	const params = insertColumns.map((column) => data[column])
	const columnsSql = insertColumns.map(quoteIdent).join(', ')
	const valuesSql = insertColumns.map((_, index) => `$${index + 1}`).join(', ')
	const returningSql =
		returning.length > 0 ? ` RETURNING ${returning.map(quoteIdent).join(', ')}` : ''

	return {
		sql: `INSERT INTO ${quoteIdent(table)} (${columnsSql}) VALUES (${valuesSql})${returningSql};`,
		params,
	}
}

export function buildUpdateStatement(
	table: string,
	idColumn: string,
	idValue: unknown,
	data: Readonly<Record<string, unknown>>,
	columns: readonly string[],
	returning: readonly string[],
	updatedAtColumn?: string,
): { sql: string; params: unknown[] } {
	const updateColumns = columns.filter((column) => data[column] !== undefined)
	if (updateColumns.length === 0) {
		throw new Error('No fields to update')
	}

	const params = updateColumns.map((column) => data[column])
	const setSql = updateColumns.map((column, index) => `${quoteIdent(column)} = $${index + 1}`)
	if (updatedAtColumn) {
		setSql.push(`${quoteIdent(updatedAtColumn)} = CURRENT_TIMESTAMP`)
	}

	const idParamIndex = updateColumns.length + 1
	params.push(idValue)

	const returningSql =
		returning.length > 0 ? ` RETURNING ${returning.map(quoteIdent).join(', ')}` : ''

	return {
		sql: `UPDATE ${quoteIdent(table)} SET ${setSql.join(', ')} WHERE ${quoteIdent(
			idColumn,
		)} = $${idParamIndex}${returningSql};`,
		params,
	}
}

export function mapRowDates<T extends object>(row: T, keys: readonly string[]): T {
	for (const key of keys) {
		const value = (row as Record<string, unknown>)[key]
		if (value instanceof Date) {
			;(row as Record<string, unknown>)[key] = value.toISOString()
		}
	}
	return row
}
