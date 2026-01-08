import { Modal } from 'obsidian';
import type { App } from 'obsidian';
import { loadReviewItems } from '../../data/review-loader';
import { readAllReviews } from '../../data/revlog';
import {
	calculateAnswerDistribution,
	calculateRetention,
	buildForecastData,
	buildHeatmapData,
} from '../../stats/aggregations';
import { getStreakInfo, getTodayStats } from '../../data/review-stats';
import './StatsModal.css';

export class StatsModal extends Modal {
	constructor(
		app: App,
		private extractTag: string,
	) {
		super(app);
	}

	onOpen(): void {
		void this.render();
	}

	async render(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ir-stats-modal');
		contentEl.createEl('h2', { text: 'Statistics' });

		const reviews = await readAllReviews(this.app);
		const items = await loadReviewItems(this.app, this.extractTag);
		const todayStats = await getTodayStats(this.app);
		const streak = await getStreakInfo(this.app);

		const retention = calculateRetention(reviews);
		const distribution = calculateAnswerDistribution(reviews);
		const forecast = buildForecastData(items, 7, new Date());
		const heatmap = buildHeatmapData(reviews, 14, new Date());

		const summary = contentEl.createDiv('ir-stats-summary');
		summary.createEl('div', { text: `Reviews: ${reviews.length}` });
		summary.createEl('div', { text: `Retention: ${(retention * 100).toFixed(0)}%` });
		summary.createEl('div', { text: `Today: ${todayStats.reviewed} reviewed` });
		summary.createEl('div', { text: `Streak: ${streak.current} days` });

		const dist = contentEl.createDiv('ir-stats-block');
		dist.createEl('h3', { text: 'Answer distribution' });
		dist.createEl('div', { text: `Again: ${distribution.again}` });
		dist.createEl('div', { text: `Hard: ${distribution.hard}` });
		dist.createEl('div', { text: `Good: ${distribution.good}` });
		dist.createEl('div', { text: `Easy: ${distribution.easy}` });

		const forecastEl = contentEl.createDiv('ir-stats-block');
		forecastEl.createEl('h3', { text: '7-day forecast' });
		for (const entry of forecast) {
			forecastEl.createEl('div', { text: `${entry.date}: ${entry.count}` });
		}

		const heatmapEl = contentEl.createDiv('ir-stats-block');
		heatmapEl.createEl('h3', { text: 'Last 14 days' });
		for (const entry of heatmap) {
			heatmapEl.createEl('div', { text: `${entry.date}: ${entry.count}` });
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
