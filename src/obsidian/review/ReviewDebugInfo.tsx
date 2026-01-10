import type { FunctionalComponent } from 'preact';
import type { DebugInfo } from './review-screen-state';

export interface ReviewDebugInfoProps {
	info: DebugInfo;
}

export const ReviewDebugInfo: FunctionalComponent<ReviewDebugInfoProps> = ({ info }) => {
	return (
		<div
			style={{
				fontSize: '0.8em',
				color: 'var(--text-muted)',
				marginTop: '1rem',
				padding: '0.5rem',
				borderTop: '1px solid var(--background-modifier-border)',
				display: 'grid',
				gridTemplateColumns: 'repeat(2, 1fr)',
				gap: '0.25rem',
			}}
		>
			<div>Queue: {info.queue}</div>
			<div>Status: {info.status}</div>
			<div>Priority: {info.priority}</div>
			<div>Due: {info.due ? new Date(info.due).toLocaleDateString() : 'Now'}</div>
			<div>Stability: {info.stability.toFixed(2)}</div>
			<div>Difficulty: {info.difficulty.toFixed(2)}</div>
			<div>Reps: {info.reps}</div>
			<div>Lapses: {info.lapses}</div>
		</div>
	);
};
