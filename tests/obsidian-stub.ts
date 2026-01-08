import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

export function parseYaml(value: string): unknown {
	return yamlParse(value);
}

export function stringifyYaml(value: unknown): string {
	return yamlStringify(value);
}

function normalizePath(path: string): string {
	const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
	return normalized === '/' ? '' : normalized.replace(/\/+$/, '');
}

function splitFrontmatter(content: string): { frontmatter: string | null; body: string } {
	const lines = content.split('\n');
	if (!lines[0] || lines[0].trim() !== '---') {
		return { frontmatter: null, body: content };
	}
	let endIndex = -1;
	for (let i = 1; i < lines.length; i += 1) {
		if (lines[i]?.trim() === '---') {
			endIndex = i;
			break;
		}
	}
	if (endIndex === -1) {
		return { frontmatter: null, body: content };
	}
	const frontmatter = lines.slice(1, endIndex).join('\n');
	const body = lines.slice(endIndex + 1).join('\n');
	return { frontmatter, body };
}

class VaultAdapter {
	constructor(private vault: Vault) {}

	async exists(path: string): Promise<boolean> {
		return this.vault.getAbstractFileByPath(path) != null;
	}

	async read(path: string): Promise<string> {
		return this.vault.getContent(path);
	}

	async write(path: string, content: string): Promise<void> {
		const existing = this.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.vault.modify(existing, content);
			return;
		}
		await this.vault.create(path, content);
	}

	async remove(path: string): Promise<void> {
		this.vault.deletePath(path);
	}

	async mkdir(path: string): Promise<void> {
		await this.vault.createFolder(path);
	}
}

class TAbstractFile {
	path: string;
	name: string;
	parent: TFolder | null;

	constructor(path: string, parent: TFolder | null) {
		this.path = path;
		this.name = path.split('/').pop() ?? path;
		this.parent = parent;
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
}

export class TFile extends TAbstractFile {
	extension: string;
	basename: string;
	stat: { ctime: number; mtime: number };

	constructor(path: string, parent: TFolder | null) {
		super(path, parent);
		const name = this.name;
		const dot = name.lastIndexOf('.');
		if (dot >= 0) {
			this.extension = name.slice(dot + 1);
			this.basename = name.slice(0, dot);
		} else {
			this.extension = '';
			this.basename = name;
		}
		const now = Date.now();
		this.stat = { ctime: now, mtime: now };
	}
}

type VaultEntry = { file: TAbstractFile; content?: string };

export class Vault {
	private entries: Map<string, VaultEntry> = new Map();
	adapter: VaultAdapter;

	constructor() {
		this.adapter = new VaultAdapter(this);
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		const normalized = normalizePath(path);
		return this.entries.get(normalized)?.file ?? null;
	}

	getMarkdownFiles(): TFile[] {
		const files: TFile[] = [];
		for (const entry of this.entries.values()) {
			if (entry.file instanceof TFile && entry.file.extension === 'md') {
				files.push(entry.file);
			}
		}
		return files;
	}

	async create(path: string, content: string): Promise<TFile> {
		const normalized = normalizePath(path);
		const parentPath = normalized.split('/').slice(0, -1).join('/');
		const parent = parentPath ? this.ensureFolder(parentPath) : null;
		const file = new TFile(normalized, parent);
		this.entries.set(normalized, { file, content });
		if (parent) parent.children.push(file);
		return file;
	}

	async createFolder(path: string): Promise<TFolder> {
		return this.ensureFolder(path);
	}

	async read(file: TFile): Promise<string> {
		return this.getContent(file.path);
	}

	async modify(file: TFile, content: string): Promise<void> {
		this.entries.set(file.path, { file, content });
		file.stat.mtime = Date.now();
	}

	async append(file: TFile, content: string): Promise<void> {
		const existing = this.getContent(file.path);
		await this.modify(file, `${existing}${content}`);
	}

	getContent(path: string): string {
		const normalized = normalizePath(path);
		const entry = this.entries.get(normalized);
		return entry?.content ?? '';
	}

	setContent(path: string, content: string): void {
		const existing = this.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			this.entries.set(existing.path, { file: existing, content });
			return;
		}
		void this.create(path, content);
	}

	deletePath(path: string): void {
		const normalized = normalizePath(path);
		const entry = this.entries.get(normalized);
		if (!entry) return;
		this.entries.delete(normalized);
		if (entry.file.parent) {
			entry.file.parent.children = entry.file.parent.children.filter(
				(child) => child !== entry.file,
			);
		}
	}

	private ensureFolder(path: string): TFolder {
		const normalized = normalizePath(path);
		if (!normalized) {
			const root = this.entries.get('')?.file;
			if (root instanceof TFolder) return root;
			const folder = new TFolder('', null);
			this.entries.set('', { file: folder });
			return folder;
		}
		const existing = this.getAbstractFileByPath(normalized);
		if (existing instanceof TFolder) return existing;
		const segments = normalized.split('/');
		let currentPath = '';
		let parent: TFolder | null = null;
		for (const segment of segments) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;
			const currentExisting = this.getAbstractFileByPath(currentPath);
			if (currentExisting instanceof TFolder) {
				parent = currentExisting;
				continue;
			}
			const folder: TFolder = new TFolder(currentPath, parent);
			const entry: VaultEntry = { file: folder };
			this.entries.set(currentPath, entry);
			if (parent) parent.children.push(folder);
			parent = folder;
		}
		return parent ?? new TFolder(normalized, null);
	}
}

export class MetadataCache {
	constructor(private vault: Vault) {}

	getFileCache(file: TFile): { frontmatter: Record<string, unknown> } | null {
		const content = this.vault.getContent(file.path);
		if (!content) return null;
		const { frontmatter } = splitFrontmatter(content);
		if (!frontmatter) return null;
		const parsed = parseYaml(frontmatter);
		if (!parsed || typeof parsed !== 'object') return null;
		return { frontmatter: parsed as Record<string, unknown> };
	}
}

export class FileManager {
	constructor(private vault: Vault) {}

	async processFrontMatter(
		file: TFile,
		callback: (fm: Record<string, unknown>) => void,
	): Promise<void> {
		const content = this.vault.getContent(file.path);
		const { frontmatter, body } = splitFrontmatter(content);
		const parsed = frontmatter ? parseYaml(frontmatter) : null;
		const record =
			parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
		callback(record);
		const yaml = stringifyYaml(record).trim();
		const bodyClean = body.replace(/^\n+/, '');
		const parts = ['---', yaml, '---'];
		if (bodyClean) parts.push(bodyClean);
		this.vault.setContent(file.path, parts.join('\n'));
	}

	async trashFile(file: TFile): Promise<void> {
		this.vault.deletePath(file.path);
	}
}

export class WorkspaceLeaf {
	viewType: string | null = null;
	view: unknown = null;
	lastViewState: { type: string; active?: boolean } | null = null;

	async setViewState(state: { type: string; active?: boolean }): Promise<void> {
		this.viewType = state.type;
		this.lastViewState = state;
		return;
	}
}

export class Workspace {
	private leaves: WorkspaceLeaf[] = [];
	private activeFile: TFile | null = null;
	private activeView: unknown = null;

	getLeavesOfType(type: string): WorkspaceLeaf[] {
		return this.leaves.filter((leaf) => leaf.viewType === type);
	}

	getMostRecentLeaf(): WorkspaceLeaf | null {
		return this.leaves[0] ?? null;
	}

	async revealLeaf(_leaf: WorkspaceLeaf): Promise<void> {
		return;
	}

	getActiveFile(): TFile | null {
		return this.activeFile;
	}

	setActiveFile(file: TFile | null): void {
		this.activeFile = file;
	}

	getActiveViewOfType<T>(viewType: new (...args: unknown[]) => T): T | null {
		const view = this.activeView;
		if (view instanceof viewType) return view;
		return null;
	}

	setActiveView(view: unknown): void {
		this.activeView = view;
	}

	addLeaf(leaf: WorkspaceLeaf): void {
		this.leaves.push(leaf);
	}
}

export class App {
	vault: Vault;
	metadataCache: MetadataCache;
	fileManager: FileManager;
	workspace: Workspace;

	constructor() {
		this.vault = new Vault();
		this.metadataCache = new MetadataCache(this.vault);
		this.fileManager = new FileManager(this.vault);
		this.workspace = new Workspace();
	}
}

export class Plugin {
	app: App;
	commands: unknown[] = [];
	settingTabs: PluginSettingTab[] = [];
	editorExtensions: unknown[] = [];
	views: { type: string; creator: (leaf: WorkspaceLeaf) => unknown }[] = [];
	private storedData: unknown = null;

	constructor(app?: App) {
		this.app = app ?? new App();
	}

	addCommand(command: unknown): void {
		this.commands.push(command);
	}

	addSettingTab(tab: PluginSettingTab): void {
		this.settingTabs.push(tab);
	}

	registerEditorExtension(extension: unknown): void {
		this.editorExtensions.push(extension);
	}

	registerView(type: string, creator: (leaf: WorkspaceLeaf) => unknown): void {
		this.views.push({ type, creator });
	}

	registerEvent(_event: unknown): void {
		return;
	}

	registerDomEvent(_el: unknown, _type: string, _handler: unknown): void {
		return;
	}

	registerInterval(_id: number): void {
		return;
	}

	async loadData(): Promise<unknown> {
		return this.storedData;
	}

	async saveData(data: unknown): Promise<void> {
		this.storedData = data;
	}

	setData(data: unknown): void {
		this.storedData = data;
	}
}

export class FakeElement {
	children: FakeElement[] = [];
	innerHTML = '';
	textContent = '';
	classList = new Set<string>();
	className = '';
	tabIndex = 0;
	components: unknown[] = [];

	createEl(_tag: string, options?: { text?: string }): FakeElement {
		const el = new FakeElement();
		if (options?.text) el.textContent = options.text;
		this.children.push(el);
		return el;
	}

	createDiv(className?: string): FakeElement {
		const div = this.createEl('div');
		if (className) div.addClass(className);
		return div;
	}

	addClass(name: string): void {
		this.classList.add(name);
		this.className = Array.from(this.classList).join(' ');
	}

	empty(): void {
		this.children = [];
		this.innerHTML = '';
		this.textContent = '';
		this.classList.clear();
		this.className = '';
		this.components = [];
	}

	setCssProps(_props: Record<string, string>): void {
		return;
	}

	addEventListener(_type: string, _handler: unknown): void {
		return;
	}

	removeEventListener(_type: string, _handler: unknown): void {
		return;
	}

	focus(): void {
		return;
	}

	select(): void {
		return;
	}
}

export class Modal {
	contentEl = new FakeElement();

	constructor(public app: App) {}

	open(): void {
		this.onOpen();
	}

	close(): void {
		this.onClose();
	}

	onOpen(): void {
		return;
	}

	onClose(): void {
		return;
	}
}

export class ItemView {
	contentEl = new FakeElement();

	constructor(public leaf: WorkspaceLeaf) {}

	getViewType(): string {
		return 'stub';
	}

	getDisplayText(): string {
		return 'Stub';
	}
}

export class MarkdownView {
	editor: unknown = null;

	constructor(public file: TFile | null = null) {}
}

export class MarkdownFileInfo {
	constructor(public file: TFile | null = null) {}
}

export class MarkdownRenderer {
	static async render(
		_app: App,
		markdown: string,
		container: FakeElement | HTMLElement,
		_path: string,
		_source: unknown,
	): Promise<void> {
		// eslint-disable-next-line @microsoft/sdl/no-inner-html -- test stub rendering.
		container.innerHTML = markdown;
	}
}

export class PluginSettingTab {
	containerEl = new FakeElement();

	constructor(
		public app: App,
		public plugin: Plugin,
	) {}

	display(): void {
		return;
	}
}

export class Setting {
	static createdComponents: { type: string; component: unknown }[] = [];

	constructor(public containerEl: FakeElement) {}

	setName(_name: string): this {
		return this;
	}

	setDesc(_desc: string): this {
		return this;
	}

	addText(callback: (component: TextComponent) => void): this {
		const component = new TextComponent();
		Setting.createdComponents.push({ type: 'text', component });
		this.containerEl.components.push(component);
		callback(component);
		return this;
	}

	addSlider(callback: (component: SliderComponent) => void): this {
		const component = new SliderComponent();
		Setting.createdComponents.push({ type: 'slider', component });
		this.containerEl.components.push(component);
		callback(component);
		return this;
	}

	addToggle(callback: (component: ToggleComponent) => void): this {
		const component = new ToggleComponent();
		Setting.createdComponents.push({ type: 'toggle', component });
		this.containerEl.components.push(component);
		callback(component);
		return this;
	}

	addButton(callback: (component: ButtonComponent) => void): this {
		const component = new ButtonComponent();
		Setting.createdComponents.push({ type: 'button', component });
		this.containerEl.components.push(component);
		callback(component);
		return this;
	}

	static resetComponents(): void {
		Setting.createdComponents = [];
	}
}

export class SliderComponent {
	private onChangeHandler: ((value: number) => void) | null = null;
	private value = 0;

	setLimits(_min: number, _max: number, _step: number): this {
		return this;
	}

	setValue(value: number): this {
		this.value = value;
		return this;
	}

	getValue(): number {
		return this.value;
	}

	setDynamicTooltip(): this {
		return this;
	}

	onChange(handler: (value: number) => void): this {
		this.onChangeHandler = handler;
		return this;
	}

	triggerChange(value: number): void {
		this.value = value;
		this.onChangeHandler?.(value);
	}
}

export class ToggleComponent {
	private onChangeHandler: ((value: boolean) => void) | null = null;
	private value = false;

	setValue(value: boolean): this {
		this.value = value;
		return this;
	}

	getValue(): boolean {
		return this.value;
	}

	onChange(handler: (value: boolean) => void): this {
		this.onChangeHandler = handler;
		return this;
	}

	triggerChange(value: boolean): void {
		this.value = value;
		this.onChangeHandler?.(value);
	}
}

export class TextComponent {
	inputEl = new FakeElement();
	private onChangeHandler: ((value: string) => void) | null = null;

	setValue(value: string): this {
		this.inputEl.textContent = value;
		return this;
	}

	onChange(handler: (value: string) => void): this {
		this.onChangeHandler = handler;
		return this;
	}

	triggerChange(value: string): void {
		this.onChangeHandler?.(value);
	}
}

export class ButtonComponent {
	private onClickHandler: (() => void) | null = null;

	setButtonText(_text: string): this {
		return this;
	}

	setCta(): this {
		return this;
	}

	onClick(handler: () => void): this {
		this.onClickHandler = handler;
		return this;
	}

	triggerClick(): void {
		this.onClickHandler?.();
	}
}

export class Notice {
	static messages: string[] = [];

	constructor(message: string) {
		Notice.messages.push(message);
	}

	static clear(): void {
		Notice.messages = [];
	}
}

export class Editor {
	private text: string;
	private selectionStart: number;
	private selectionEnd: number;

	constructor(text: string, selectionStart = 0, selectionEnd?: number) {
		this.text = text;
		this.selectionStart = selectionStart;
		this.selectionEnd = selectionEnd ?? text.length;
	}

	getSelection(): string {
		return this.text.slice(this.selectionStart, this.selectionEnd);
	}

	replaceSelection(value: string): void {
		const before = this.text.slice(0, this.selectionStart);
		const after = this.text.slice(this.selectionEnd);
		this.text = `${before}${value}${after}`;
		this.selectionEnd = this.selectionStart + value.length;
	}

	getValue(): string {
		return this.text;
	}

	getCursor(which: 'from' | 'to'): { line: number; ch: number } {
		const index = which === 'from' ? this.selectionStart : this.selectionEnd;
		return this.indexToPos(index);
	}

	setSelection(from: { line: number; ch: number }, to: { line: number; ch: number }): void {
		this.selectionStart = this.posToIndex(from);
		this.selectionEnd = this.posToIndex(to);
	}

	setSelectionByOffset(start: number, end: number): void {
		this.selectionStart = start;
		this.selectionEnd = end;
	}

	setValue(value: string): void {
		this.text = value;
		this.selectionStart = 0;
		this.selectionEnd = value.length;
	}

	private indexToPos(index: number): { line: number; ch: number } {
		const lines = this.text.split('\n');
		let remaining = index;
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i] ?? '';
			if (remaining <= line.length) {
				return { line: i, ch: remaining };
			}
			remaining -= line.length + 1;
		}
		return { line: lines.length - 1, ch: (lines[lines.length - 1] ?? '').length };
	}

	private posToIndex(pos: { line: number; ch: number }): number {
		const lines = this.text.split('\n');
		let index = 0;
		for (let i = 0; i < pos.line && i < lines.length; i += 1) {
			index += (lines[i] ?? '').length + 1;
		}
		return index + pos.ch;
	}
}

export type MarkdownViewType = MarkdownView;
