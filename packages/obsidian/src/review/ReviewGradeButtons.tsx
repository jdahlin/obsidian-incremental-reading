import type { FunctionalComponent } from 'preact'
import './ReviewGradeButtons.css'

interface ReviewGradeButtonsProps {
	onGrade: (grade: 1 | 2 | 3 | 4) => void | Promise<void>
}

export const ReviewGradeButtons: FunctionalComponent<ReviewGradeButtonsProps> = ({ onGrade }) => {
	const grades: Array<{ value: 1 | 2 | 3 | 4; className: string }> = [
		{ value: 1, className: 'ir-grade ir-grade-again' },
		{ value: 2, className: 'ir-grade ir-grade-hard' },
		{ value: 3, className: 'ir-grade ir-grade-good' },
		{ value: 4, className: 'ir-grade ir-grade-easy' },
	]

	return (
		<div className="ir-grade-buttons">
			{grades.map((grade) => (
				<button
					key={grade.value}
					type="button"
					className={grade.className}
					onClick={() => {
						void onGrade(grade.value)
					}}
				>
					{grade.value}
				</button>
			))}
		</div>
	)
}
