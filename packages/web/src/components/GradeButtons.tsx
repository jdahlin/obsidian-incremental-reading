import type { FC } from 'react'

interface GradeButtonsProps {
	onGrade: (grade: 1 | 2 | 3 | 4) => void | Promise<void>
}

const grades: Array<{ value: 1 | 2 | 3 | 4; label: string }> = [
	{ value: 1, label: 'Again' },
	{ value: 2, label: 'Hard' },
	{ value: 3, label: 'Good' },
	{ value: 4, label: 'Easy' },
]

export const GradeButtons: FC<GradeButtonsProps> = ({ onGrade }) => {
	return (
		<div className="ir-grade-buttons">
			{grades.map((grade) => (
				<button
					key={grade.value}
					type="button"
					className="ir-grade-btn"
					data-grade={grade.value}
					onClick={() => void onGrade(grade.value)}
				>
					{grade.value}
				</button>
			))}
		</div>
	)
}
