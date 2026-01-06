import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { App } from 'obsidian';
import type IncrementalReadingPlugin from '../main';

export interface PluginContextValue {
	app: App;
	plugin: IncrementalReadingPlugin;
}

export const PluginContext = createContext<PluginContextValue | null>(null);

export function usePluginContext(): PluginContextValue {
	const ctx = useContext(PluginContext);
	if (!ctx) {
		throw new Error('usePluginContext must be used within PluginContext.Provider');
	}
	return ctx;
}

export function useApp(): App {
	return usePluginContext().app;
}

export function usePlugin(): IncrementalReadingPlugin {
	return usePluginContext().plugin;
}
