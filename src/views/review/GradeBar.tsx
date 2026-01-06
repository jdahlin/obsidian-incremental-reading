import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';

const LABELS = ['Again', 'Hard', 'Good', 'Easy'] as const;

export function GradeBar(props: {
	phase: 'question' | 'answer';
	onGrade: (n: number) => void;
	onShowAnswer: () => void;
}): JSX.Element {
	const buttons = useMemo(
		() =>
			LABELS.map((label, idx) => {
				const n = idx + 1;
				return (
					<button key={n} className="ir-review-gradebtn" onClick={() => props.onGrade(n)}>
						{label} [{n}]
					</button>
				);
			}),
		[props.onGrade],
	);

	if (props.phase === 'question') {
		return (
			<div className="ir-review-gradebar">
				<button className="ir-review-gradebtn ir-review-showanswer" onClick={props.onShowAnswer}>
					Show Answer [Space]
				</button>
			</div>
		);
	}

	return <div className="ir-review-gradebar">{buttons}</div>;
}