const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const ID_LENGTH = 12

export function createId(): string {
	const bytes = new Uint8Array(ID_LENGTH)
	if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
		crypto.getRandomValues(bytes)
	} else {
		for (let i = 0; i < bytes.length; i += 1) {
			bytes[i] = Math.floor(Math.random() * 256)
		}
	}

	let result = ''
	for (const value of bytes) {
		result += ALPHABET[value % ALPHABET.length]
	}
	return result
}
