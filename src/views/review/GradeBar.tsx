import type { JSX } from 'preact';

export function GradeBar(props: {
	phase: 'question' | 'answer';
	onGrade: (n: number) => void;
	onShowAnswer: () => void;
}): JSX.Element {
	if (props.phase === 'question') {
		return (
			<div className="ir-review-gradebar">
				<button className="ir-review-showanswer" onClick={props.onShowAnswer}>
					Show Answer
				</button>
			</div>
		);
	}

	return (
		<div className="ir-review-gradebar">
			<button className="ir-review-gradebtn ir-grade-again" onClick={() => props.onGrade(1)}>1</button>
			<button className="ir-review-gradebtn ir-grade-hard" onClick={() => props.onGrade(2)}>2</button>
			<button className="ir-review-gradebtn ir-grade-good" onClick={() => props.onGrade(3)}>3</button>
			<button className="ir-review-gradebtn ir-grade-easy" onClick={() => props.onGrade(4)}>4</button>
		</div>
	);
}