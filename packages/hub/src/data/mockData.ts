export type ContentType = 'book' | 'video' | 'notes' | 'exam' | 'lecture'

export interface ContentItem {
	readonly id: string
	readonly title: string
	readonly type: ContentType
	readonly description: string
	readonly lectureId: string
	readonly pageCount?: number
	readonly duration?: string
	readonly author?: string
	readonly highlights?: number
	readonly annotations?: number
}

export interface Lecture {
	readonly id: string
	readonly number: number
	readonly title: string
	readonly date: string
	readonly duration: string
	readonly contentCount: number
	readonly isCompleted: boolean
}

export interface QuizQuestion {
	readonly id: string
	readonly question: string
	readonly options: readonly string[]
	readonly correctAnswer: number
	readonly explanation: string
	readonly lectureId: string
}

export interface ChatMessage {
	readonly id: string
	readonly role: 'user' | 'assistant'
	readonly content: string
	readonly timestamp: Date
}

export const lectures: Lecture[] = [
	{
		id: 'lec-1',
		number: 1,
		title: 'Introduction to Biochemistry',
		date: '2024-01-15',
		duration: '90 min',
		contentCount: 5,
		isCompleted: true,
	},
	{
		id: 'lec-2',
		number: 2,
		title: 'Water, pH, and Buffers',
		date: '2024-01-17',
		duration: '90 min',
		contentCount: 4,
		isCompleted: true,
	},
	{
		id: 'lec-3',
		number: 3,
		title: 'Amino Acids and Peptides',
		date: '2024-01-22',
		duration: '90 min',
		contentCount: 6,
		isCompleted: true,
	},
	{
		id: 'lec-4',
		number: 4,
		title: 'Protein Structure',
		date: '2024-01-24',
		duration: '90 min',
		contentCount: 7,
		isCompleted: false,
	},
	{
		id: 'lec-5',
		number: 5,
		title: 'Enzyme Kinetics',
		date: '2024-01-29',
		duration: '90 min',
		contentCount: 5,
		isCompleted: false,
	},
	{
		id: 'lec-6',
		number: 6,
		title: 'Carbohydrate Metabolism',
		date: '2024-01-31',
		duration: '90 min',
		contentCount: 8,
		isCompleted: false,
	},
	{
		id: 'lec-7',
		number: 7,
		title: 'Citric Acid Cycle',
		date: '2024-02-05',
		duration: '90 min',
		contentCount: 6,
		isCompleted: false,
	},
	{
		id: 'lec-8',
		number: 8,
		title: 'Oxidative Phosphorylation',
		date: '2024-02-07',
		duration: '90 min',
		contentCount: 5,
		isCompleted: false,
	},
]

export const contentItems: ContentItem[] = [
	// Lecture 1
	{
		id: 'content-1-1',
		title: 'Lehninger Principles of Biochemistry - Ch. 1',
		type: 'book',
		description:
			'The Foundations of Biochemistry - An overview of cells, biomolecules, and the logic of life',
		lectureId: 'lec-1',
		pageCount: 42,
		author: 'Nelson & Cox',
		highlights: 12,
		annotations: 5,
	},
	{
		id: 'content-1-2',
		title: 'Lecture 1 Slides - Introduction',
		type: 'lecture',
		description:
			"Professor Anderson's slides covering course overview and fundamental concepts",
		lectureId: 'lec-1',
		pageCount: 35,
		highlights: 8,
	},
	{
		id: 'content-1-3',
		title: 'MIT OpenCourseWare - What is Biochemistry?',
		type: 'video',
		description: 'Introductory video explaining the scope and importance of biochemistry',
		lectureId: 'lec-1',
		duration: '24:30',
	},
	{
		id: 'content-1-4',
		title: "Sarah's Lecture Notes - Week 1",
		type: 'notes',
		description: 'Comprehensive notes from lecture with diagrams and key points highlighted',
		lectureId: 'lec-1',
		pageCount: 8,
		author: 'Sarah Chen',
	},
	{
		id: 'content-1-5',
		title: '2023 Midterm - Question Set 1',
		type: 'exam',
		description: 'Past exam questions covering introduction and basic concepts',
		lectureId: 'lec-1',
		pageCount: 4,
	},
	// Lecture 4
	{
		id: 'content-4-1',
		title: 'Lehninger Principles - Ch. 4: Protein Structure',
		type: 'book',
		description:
			'The Three-Dimensional Structure of Proteins - Primary to quaternary structures',
		lectureId: 'lec-4',
		pageCount: 56,
		author: 'Nelson & Cox',
		highlights: 23,
		annotations: 11,
	},
	{
		id: 'content-4-2',
		title: 'Lecture 4 Slides - Protein Folding',
		type: 'lecture',
		description: 'Detailed slides on α-helices, β-sheets, and protein domains',
		lectureId: 'lec-4',
		pageCount: 48,
		highlights: 15,
	},
	{
		id: 'content-4-3',
		title: 'iBiology - How Proteins Fold',
		type: 'video',
		description: 'Advanced visualization of protein folding dynamics and chaperones',
		lectureId: 'lec-4',
		duration: '32:15',
	},
	{
		id: 'content-4-4',
		title: 'Ramachandran Plot Analysis',
		type: 'notes',
		description: 'My personal notes on phi/psi angles and their significance',
		lectureId: 'lec-4',
		pageCount: 6,
		author: 'My Notes',
		annotations: 4,
	},
	{
		id: 'content-4-5',
		title: 'Stryer Biochemistry - Protein Motifs',
		type: 'book',
		description: 'Supplementary reading on structural motifs and supersecondary structures',
		lectureId: 'lec-4',
		pageCount: 28,
		author: 'Berg, Tymoczko, Stryer',
	},
	{
		id: 'content-4-6',
		title: 'PDB Tutorial - Visualizing Hemoglobin',
		type: 'video',
		description: 'Interactive tutorial on using PyMOL to analyze hemoglobin structure',
		lectureId: 'lec-4',
		duration: '18:45',
	},
	{
		id: 'content-4-7',
		title: '2022 Final - Protein Structure Questions',
		type: 'exam',
		description: 'Past exam section focusing on structure-function relationships',
		lectureId: 'lec-4',
		pageCount: 6,
	},
]

export const quizQuestions: QuizQuestion[] = [
	{
		id: 'quiz-1',
		question:
			'Which type of bond is primarily responsible for maintaining the α-helix structure in proteins?',
		options: [
			'Disulfide bonds',
			'Hydrogen bonds between backbone atoms',
			'Ionic bonds between side chains',
			'Hydrophobic interactions',
		],
		correctAnswer: 1,
		explanation:
			'The α-helix is stabilized by hydrogen bonds between the carbonyl oxygen (C=O) of one amino acid and the amide hydrogen (N-H) of an amino acid four residues further along the chain.',
		lectureId: 'lec-4',
	},
	{
		id: 'quiz-2',
		question: 'What does a Ramachandran plot display?',
		options: [
			'Protein molecular weight vs. charge',
			'Allowed φ (phi) and ψ (psi) backbone angles',
			'Enzyme velocity vs. substrate concentration',
			'Protein solubility vs. pH',
		],
		correctAnswer: 1,
		explanation:
			'A Ramachandran plot shows the allowed combinations of φ and ψ dihedral angles for amino acid residues in a protein structure. Most residues fall within allowed regions due to steric constraints.',
		lectureId: 'lec-4',
	},
	{
		id: 'quiz-3',
		question: 'Which amino acid is most commonly found in β-turns?',
		options: ['Alanine', 'Leucine', 'Glycine and Proline', 'Tryptophan'],
		correctAnswer: 2,
		explanation:
			'Glycine (due to its flexibility) and Proline (due to its rigid ring structure) are frequently found in β-turns, which are tight loops that reverse the direction of the polypeptide chain.',
		lectureId: 'lec-4',
	},
	{
		id: 'quiz-4',
		question: 'The quaternary structure of hemoglobin consists of:',
		options: [
			'One polypeptide chain with four heme groups',
			'Two α and two β subunits',
			'Four identical subunits',
			'Two polypeptide chains linked by disulfide bonds',
		],
		correctAnswer: 1,
		explanation:
			'Hemoglobin is a heterotetramer composed of two α-globin and two β-globin subunits (α₂β₂), each containing a heme prosthetic group.',
		lectureId: 'lec-4',
	},
	{
		id: 'quiz-5',
		question: 'What is the Km value in Michaelis-Menten kinetics?',
		options: [
			'Maximum reaction velocity',
			'Substrate concentration at half Vmax',
			'Enzyme turnover number',
			'Inhibitor dissociation constant',
		],
		correctAnswer: 1,
		explanation:
			"Km (Michaelis constant) is defined as the substrate concentration at which the reaction velocity is half of Vmax. It reflects the enzyme's affinity for its substrate.",
		lectureId: 'lec-5',
	},
]

export const initialChatMessages: ChatMessage[] = [
	{
		id: 'msg-1',
		role: 'assistant',
		content:
			"Hello! I'm your Biochemistry tutor. I have access to all your course materials including lectures, textbooks, notes, and past exams. How can I help you study today?",
		timestamp: new Date(),
	},
]

export const getContentForLecture = (lectureId: string): ContentItem[] => {
	return contentItems.filter((item) => item.lectureId === lectureId)
}

export const getQuizForLecture = (lectureId: string): QuizQuestion[] => {
	return quizQuestions.filter((q) => q.lectureId === lectureId)
}

export const searchContent = (
	query: string,
	scope: 'lecture' | 'course' | 'all',
	currentLectureId?: string,
): ContentItem[] => {
	const lowerQuery = query.toLowerCase()

	let items = contentItems

	if (scope === 'lecture' && currentLectureId) {
		items = items.filter((item) => item.lectureId === currentLectureId)
	}

	return items.filter(
		(item) =>
			item.title.toLowerCase().includes(lowerQuery) ||
			item.description.toLowerCase().includes(lowerQuery) ||
			item.author?.toLowerCase().includes(lowerQuery),
	)
}
