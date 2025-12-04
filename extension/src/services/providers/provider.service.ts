import { providerRegistry } from './registry';
import type { MultiProviderSettings, ProviderConfig } from './types';

const STORAGE_KEY = 'multiProviderSettings';

export const providerService = {
    async getSettings(): Promise<MultiProviderSettings> {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([STORAGE_KEY], (result) => {
                    resolve((result[STORAGE_KEY] as MultiProviderSettings) || { providers: {}, defaultProviderId: '' });
                });
            } else {
                // If chrome.storage is unavailable, return default settings
                // (Service Worker doesn't have access to localStorage)
                resolve({ providers: {}, defaultProviderId: '' });
            }
        });
    },

    async saveSettings(settings: MultiProviderSettings): Promise<void> {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => resolve());
            } else {
                // If chrome.storage is unavailable, just resolve
                // (Service Worker doesn't have access to localStorage)
                resolve();
            }
        });
    },

    async getEnabledProviders(): Promise<ProviderConfig[]> {
        const settings = await this.getSettings();
        return Object.values(settings.providers).filter(p => p.enabled);
    },

    async getDefaultProvider(): Promise<ProviderConfig | null> {
        const settings = await this.getSettings();
        if (!settings.defaultProviderId) return null;
        return settings.providers[settings.defaultProviderId] || null;
    },

    async saveProviderConfig(config: ProviderConfig): Promise<void> {
        const settings = await this.getSettings();
        settings.providers[config.id] = config;

        // If this is the first provider, set as default
        if (!settings.defaultProviderId) {
            settings.defaultProviderId = config.id;
        }

        await this.saveSettings(settings);
    },

    async removeProviderConfig(providerId: string): Promise<void> {
        const settings = await this.getSettings();
        if (settings.providers[providerId]) {
            delete settings.providers[providerId];

            // If we removed the default provider, pick another one or clear
            if (settings.defaultProviderId === providerId) {
                const remaining = Object.keys(settings.providers);
                settings.defaultProviderId = remaining.length > 0 ? remaining[0] : '';
            }

            await this.saveSettings(settings);
        }
    },

    async setDefaultProvider(providerId: string): Promise<void> {
        const settings = await this.getSettings();
        if (settings.providers[providerId]) {
            settings.defaultProviderId = providerId;
            await this.saveSettings(settings);
        }
    },

    async verifyProviderToken(providerId: string, token: string): Promise<boolean> {
        const provider = providerRegistry.get(providerId);
        if (!provider) return false;
        return provider.verifyToken(token);
    },

    async getProviderDomains(providerId: string, token: string): Promise<string[]> {
        const provider = providerRegistry.get(providerId);
        if (!provider) return [];
        return provider.getDomains(token);
    }
};
