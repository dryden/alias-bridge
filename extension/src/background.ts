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

// Core Alias Generation Logic - Simplified for background/icon/context menu use
// This uses a simpler approach than the popup to avoid Service Worker context issues
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

        // For SimpleLogin: Always create via API
        if (providerId === 'simplelogin' && provider.createAlias) {
            console.log('Background: SimpleLogin - creating alias via API');
            const result = await provider.createAlias(alias, config.token);
            if (result.success && result.createdAlias) {
                console.log('Background: SimpleLogin alias created:', result.createdAlias);
                return result.createdAlias;
            } else {
                console.warn('Background: SimpleLogin creation failed:', result.error);
                // Still return the locally generated alias as fallback
                return alias;
            }
        }

        // For Addy: Return the locally generated alias
        // The popup handles catch-all checking and server generation
        // Icon/context menu use the simple approach
        if (providerId === 'addy') {
            console.log('Background: Addy - returning locally generated alias');
            return alias;
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
        // For Addy, hide UI if catch-all is disabled for the default domain
        // Because icon/context menu generate invalid aliases that won't work
        if (config.defaultDomain) {
            // Check cached catch-all status
            if (config.domainCatchAllStatus && config.domainCatchAllStatus[config.defaultDomain] !== undefined) {
                const isCatchAllDisabled = config.domainCatchAllStatus[config.defaultDomain] === false;
                if (isCatchAllDisabled) {
                    console.log('[Background] Hiding UI - catch-all is disabled for domain (cached):', config.defaultDomain);
                    return false;
                }
            }
        }

        // Check waitServerConfirmation setting
        // If it's true, the UI should be hidden (context menu won't work for catch-all disabled domains)
        if (config.waitServerConfirmation === true) {
            console.log('[Background] Hiding UI - waitServerConfirmation is true (catch-all likely disabled)');
            return false;
        }
    }

    if (providerId === 'simplelogin') {
        // SimpleLogin always uses server confirmation, so hide context menu
        console.log('[Background] Hiding UI - SimpleLogin requires server confirmation');
        return false;
    }

    return true;
}

// Update Context Menu Visibility
async function updateContextMenu() {
    const show = await shouldShowUI();
    console.log('[Background] Updating context menu visibility:', show);
    chrome.contextMenus.update("generate-alias", { visible: show }, () => {
        if (chrome.runtime.lastError) {
            console.log('[Background] Context menu item does not exist, creating it');
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
    if (area === 'local') {
        console.log('[Background] Storage changed, keys:', Object.keys(changes));
        // Update context menu on any storage change related to providers
        if (changes.multiProviderSettings || changes.licenseKey || changes.isPro) {
            console.log('[Background] Updating context menu due to settings change');
            updateContextMenu();
        }
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
