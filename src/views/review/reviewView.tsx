import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { MarkdownBlock } from './MarkdownBlock';
import { GradeBar } from './GradeBar';
import { ReviewItemView } from './ReviewItemView';
import type { QueueStats } from '../../scheduling/queue';
import type { SessionStats } from './ReviewItemView';
import { getBreadcrumbs } from '../../utils/breadcrumbs';
import type { App, TFile } from 'obsidian';

export function ReviewView(props: {
	component: ReviewItemView;
	phase: 'question' | 'answer';
	onGrade: (n: number) => void;
	onShowAnswer: () => void;
	queueStats: QueueStats;
	sessionStats: SessionStats;
	upcomingInfo: { nextDue: Date | null; upcomingCount: number };
}): JSX.Element {
	const card = props.component.getCurrentCard();
	const app = props.component.getApp();
	const [breadcrumbs, setBreadcrumbs] = useState<TFile[]>([]);

	useEffect(() => {
		let cancelled = false;
		if (!card) {
			setBreadcrumbs([]);
			return;
		}
		void getBreadcrumbs(app, card).then((chain) => {
			if (cancelled) return;
			setBreadcrumbs(chain);
		});
		return () => {
			cancelled = true;
		};
	}, [app, card]);

	const statsText = useMemo(() => {
		return `Due: ${props.queueStats.due} | New: ${props.queueStats.new} | Done: ${props.sessionStats.reviewed}`;
	}, [props.queueStats.due, props.queueStats.new, props.sessionStats.reviewed]);

	const emptyState = !card;

	return (
		<div className="ir-review-root">
			<div className="ir-review-header">
				<div className="ir-review-breadcrumbs">
					{breadcrumbs.length ? (
						breadcrumbs.map((file, idx) => (
							<button
								key={file.path}
								className="ir-review-crumb"
								onClick={() => openFile(app, file)}
								type="button"
							>
								{file.basename}
								{idx < breadcrumbs.length - 1 ? ' > ' : ''}
							</button>
						))
					) : (
						'Review'
					)}
				</div>
				<div className="ir-review-stats">{statsText}</div>
				<div className="ir-review-phase">Phase: {props.phase}</div>
			</div>
			<div className="ir-review-scroll">
				{emptyState ? (
					<div className="ir-review-empty">
						<div className="ir-review-empty-title">Congratulations!</div>
						<div className="ir-review-empty-body">No more cards due for review.</div>
						{props.upcomingInfo.nextDue ? (
							<div className="ir-review-empty-next">
								Next review: {formatDateTime(props.upcomingInfo.nextDue)}
								{props.upcomingInfo.upcomingCount > 0 ? ` (${props.upcomingInfo.upcomingCount} cards)` : ''}
							</div>
						) : null}
					</div>
				) : (
					<MarkdownBlock component={props.component} emptyText="No #extract notes found." />
				)}
			</div>
			{emptyState ? null : (
				<div className="ir-review-footer">
					<GradeBar
						phase={props.phase}
						onGrade={props.onGrade}
						onShowAnswer={props.onShowAnswer}
					/>
				</div>
			)}
		</div>
	);
}

function formatDateTime(value: Date): string {
	const year = value.getFullYear();
	const month = String(value.getMonth() + 1).padStart(2, '0');
	const day = String(value.getDate()).padStart(2, '0');
	const hours = String(value.getHours()).padStart(2, '0');
	const minutes = String(value.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function openFile(app: App, file: TFile): void {
	const leaf = app.workspace.getLeaf(false);
	void leaf.openFile(file, { active: true });
}
