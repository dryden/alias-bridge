import { generateLocalPart, DEFAULT_CUSTOM_RULE } from './lib/aliasGenerator';
import { AddyProvider } from './services/providers/addy.provider';
import { SimpleLoginProvider } from './services/providers/simplelogin.provider';
import type { ProviderConfig, MultiProviderSettings } from './services/providers/types';

console.log("Alias Bridge background script loaded");

import { providerService } from './services/providers/provider.service';

// Initialize Providers
const providers = {
    addy: new AddyProvider(),
    simplelogin: new SimpleLoginProvider()
};

// Helper to get settings
async function getSettings(): Promise<{ config: ProviderConfig, providerId: string } | null> {
    const result = await chrome.storage.local.get(['multiProviderSettings']);
    const settings = result.multiProviderSettings as MultiProviderSettings | undefined;

    if (!settings || !settings.providers) {
        return null;
    }

    let providerId = settings.defaultProviderId;
    let config = providerId ? settings.providers[providerId] : undefined;

    // Fallback: if defaultProviderId is not set or invalid,
    // use the first enabled provider (same behavior as popup)
    if (!config || !config.enabled) {
        const firstEnabled = Object.entries(settings.providers).find(
            ([, providerConfig]) => providerConfig.enabled
        );

        if (!firstEnabled) {
            return null;
        }

        providerId = firstEnabled[0];
        config = firstEnabled[1];
    }

    return { config, providerId };
}

// Core Alias Generation Logic
async function handleGenerateAlias(url: string): Promise<string | null> {
    try {
        const settings = await getSettings();
        if (!settings) {
            console.warn('Settings not configured');
            return null;
        }

        const { config, providerId } = settings;
        const provider = providers[providerId as keyof typeof providers];

        if (!provider) {
            console.warn('Provider not found:', providerId);
            return null;
        }

        let defaultDomain = config.defaultDomain || '';
        if (!defaultDomain) {
            console.log('Background: No default domain configured, attempting to fetch...');
            try {
                const domains = await providerService.getProviderDomains(providerId, config.token);
                if (domains && domains.length > 0) {
                    defaultDomain = domains[0];
                    console.log('Background: Auto-selected default domain:', defaultDomain);

                    // Update config
                    const newConfig = { ...config, defaultDomain };
                    await providerService.saveProviderConfig(newConfig);

                    // Update local config variable for this execution
                    config.defaultDomain = defaultDomain;
                } else {
                    console.warn('Background: Failed to fetch domains or no domains available');
                    return null;
                }
            } catch (err) {
                console.error('Background: Error fetching domains:', err);
                return null;
            }
        }

        // Generate Local Part
        const localPart = generateLocalPart({
            type: config.activeFormat || 'uuid',
            currentUrl: url,
            customRule: config.customRule || DEFAULT_CUSTOM_RULE
        });

        // Generate initial alias string (client-side)
        let alias = provider.generateAddress(localPart, defaultDomain);

        // Handle Provider Specifics
        if (providerId === 'addy') {
            // Check Catch-all status via createAlias logic
            // We pass the domain and an empty alias (or placeholder) to trigger the check inside createAlias
            // If catch-all is disabled, createAlias will handle server-side generation

            // Note: We need to check if we should force server-side generation
            // Since we can't easily check catch-all status here without duplicating logic,
            // we rely on AddyProvider.createAlias to handle it.
            // However, AddyProvider.createAlias as implemented requires us to know if we should pass the domain.

            // Let's use a strategy:
            // 1. Try to create alias. If it's a catch-all domain, it might return success immediately or we might need to check.
            // Actually, the updated AddyProvider.createAlias handles the logic:
            // if we pass (alias, token, domain), it checks catch-all.

            // But wait, if catch-all is ENABLED, we just want to return the local alias without API call?
            // The user wants: "If catch-all disabled, go to server".
            // If catch-all enabled, we can just use the local alias.

            // To be safe and consistent with the requirement:
            // We can call createAlias with the generated alias. 
            // The provider should be smart enough.
            // But our provider implementation currently calls API if we pass an alias, unless it detects catch-all is enabled.
            // So calling createAlias is the right move.

            if (provider.createAlias) {
                // We pass the generated alias. The provider will check if it's a catch-all domain.
                // If it IS a catch-all domain, it returns success (and we use the alias).
                // If it is NOT a catch-all domain, it calls the API to create it.
                // Wait, if it is NOT a catch-all domain, we want the SERVER to generate it (UUID) or use our custom one?
                // The user requirement says: "Go Addy generated alias route".
                // This implies we should let Addy generate it if catch-all is disabled.

                // Let's look at AddyProvider.createAlias again.
                // It checks domain details.
                // If catch-all is TRUE -> returns { success: true, isCatchAllDomain: true } -> we use our local alias.
                // If catch-all is FALSE -> it proceeds to call API with the custom alias we passed.

                // BUT, if catch-all is FALSE, the user wants "Addy generated alias" (server side random), 
                // NOT "try to create this custom alias I just made".
                // Because "Custom aliases not supported".

                // So we need to know catch-all status BEFORE deciding what to pass to createAlias.
                // Or we modify createAlias to handle this "fallback to server generation" logic?
                // I already modified createAlias to support server generation if alias is empty.

                // So:
                // 1. Get domain details.
                // 2. If catch-all is false -> call createAlias('', token, domain)
                // 3. If catch-all is true -> return local alias.

                // To avoid duplicating "getDomainDetails" logic here, we can instantiate AddyProvider and use its internal methods if they were public,
                // but they are imported from '../addy'.
                // We can import getDomainDetails here too.

                const { getDomainDetails } = await import('./services/addy');
                const domainDetails = await getDomainDetails(config.token, defaultDomain);

                if (domainDetails && domainDetails.catch_all === false) {
                    console.log('Background: Catch-all disabled, requesting server generation');
                    const result = await provider.createAlias!('', config.token, defaultDomain);
                    if (result.success && result.createdAlias) {
                        return result.createdAlias;
                    }
                } else {
                    // Catch-all enabled or unknown, use local alias
                    // (Optional: we could still call createAlias to register it if needed, but for Addy catch-all it's not needed)
                    return alias;
                }
            }
        } else if (providerId === 'simplelogin') {
            // SimpleLogin always needs creation via API for custom aliases (or suffixes)
            if (provider.createAlias) {
                const result = await provider.createAlias(alias, config.token);
                if (result.success && result.createdAlias) {
                    return result.createdAlias;
                }
            }
        }

        return alias;

    } catch (error) {
        console.error('Error in handleGenerateAlias:', error);
        return null;
    }
}

// Helper to determine if UI should be shown
async function shouldShowUI(): Promise<boolean> {
    const settings = await getSettings();
    if (!settings) return true; // Default to true if no settings yet

    const { config, providerId } = settings;

    if (providerId === 'addy') {
        // If waitServerConfirmation is true, it means Catch-all is DISABLED (locked).
        // User wants to HIDE UI (Icon and Context Menu) in this case.
        if (config.waitServerConfirmation === true) {
            return false;
        }
    }
    return true;
}

// Update Context Menu Visibility
async function updateContextMenu() {
    const show = await shouldShowUI();
    chrome.contextMenus.update("generate-alias", { visible: show }, () => {
        if (chrome.runtime.lastError) {
            // Menu might not exist yet, try creating it if show is true
            if (show) {
                chrome.contextMenus.create({
                    id: "generate-alias",
                    title: "Generate Alias Bridge Email",
                    contexts: ["editable", "selection"]
                });
            }
        }
    });
}

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "generate-alias",
        title: "Generate Alias Bridge Email",
        contexts: ["editable", "selection"]
    });
    updateContextMenu();
});

// Update context menu on startup
chrome.runtime.onStartup.addListener(() => {
    updateContextMenu();
});

// Monitor settings changes to update UI visibility
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.multiProviderSettings) {
        updateContextMenu();
    }
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "generate-alias" && tab?.id) {
        const alias = await handleGenerateAlias(tab.url || '');

        if (alias) {
            const message = {
                action: "insertAlias",
                alias: alias
            };

            if (typeof info.frameId === 'number') {
                chrome.tabs.sendMessage(tab.id, message, { frameId: info.frameId });
            } else {
                chrome.tabs.sendMessage(tab.id, message);
            }
        }
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateAlias') {
        handleGenerateAlias(request.url || sender.tab?.url || '')
            .then(alias => {
                if (alias) {
                    sendResponse({ alias });
                } else {
                    // Provide a clearer error message when no alias was generated
                    sendResponse({
                        error: 'No alias generated. Please check that your provider is configured, enabled, and has a default domain set.'
                    });
                }
            })
            .catch(err => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
        return true; // Keep channel open for async response
    }

    if (request.action === 'shouldShowIcon') {
        shouldShowUI().then(show => {
            sendResponse({ shouldShow: show });
        });
        return true;
    }
});
