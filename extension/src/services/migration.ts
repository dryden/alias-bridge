import { providerService } from './providers/provider.service';
import type { ProviderConfig } from './providers/types';

export const migrateLegacyStorage = async () => {
    return new Promise<void>((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            resolve();
            return;
        }

        chrome.storage.local.get(['addyToken', 'defaultDomain', 'defaultFormat', 'multiProviderSettings'], async (result) => {
            // Check if migration already done
            if (result.multiProviderSettings) {
                resolve();
                return;
            }

            // Check if legacy data exists
            if (result.addyToken) {
                console.log('Migrating legacy Addy.io settings...');

                const addyConfig: ProviderConfig = {
                    id: 'addy',
                    enabled: true,
                    token: result.addyToken as string,
                    defaultDomain: (result.defaultDomain as string) || 'addy.io',
                    activeFormat: (result.defaultFormat as string) || 'uuid'
                };

                await providerService.saveProviderConfig(addyConfig);

                // We do NOT delete legacy keys yet for safety
                console.log('Migration complete.');
            }

            resolve();
        });
    });
};
