import type { FunctionalComponent } from 'preact';

export interface ReviewGradeButtonsProps {
	onGrade: (grade: number) => void;
}

export const ReviewGradeButtons: FunctionalComponent<ReviewGradeButtonsProps> = ({ onGrade }) => {
	const grades = [
		{ value: 1, className: 'ir-grade ir-grade-again' },
		{ value: 2, className: 'ir-grade ir-grade-hard' },
		{ value: 3, className: 'ir-grade ir-grade-good' },
		{ value: 4, className: 'ir-grade ir-grade-easy' },
	];

	return (
		<div className="ir-grade-buttons">
			{grades.map((grade) => (
				<button
					key={grade.value}
					type="button"
					className={grade.className}
					onClick={() => onGrade(grade.value)}
				>
					{grade.value}
				</button>
			))}
		</div>
	);
};
