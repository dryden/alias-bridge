import { generateAlias, DEFAULT_CUSTOM_RULE, type CustomRule } from './lib/aliasGenerator';

console.log("Alias Bridge background script loaded");

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "generate-alias",
        title: "Generate Alias Bridge Email",
        contexts: ["editable", "selection"]
    });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "generate-alias" && tab?.id) {
        try {
            // Fetch settings
            const result = await chrome.storage.local.get(['userData', 'defaultFormat', 'customRule', 'defaultDomain']);
            const userData = result.userData;
            const defaultFormat = result.defaultFormat || 'uuid';
            const customRule = result.customRule ? (result.customRule as CustomRule) : DEFAULT_CUSTOM_RULE;
            const defaultDomain = result.defaultDomain || 'anonaddy.com';

            if (!userData) {
                console.error('User data not found');
                // Optionally alert the user to login
                return;
            }

            const alias = generateAlias({
                type: defaultFormat as string,
                domain: defaultDomain as string,
                username: (userData as any).username,
                currentUrl: tab.url || '',
                customRule: customRule
            });

            // Send message to content script to insert alias
            chrome.tabs.sendMessage(tab.id, {
                action: "insertAlias",
                alias: alias
            });

        } catch (error) {
            console.error("Error generating alias from context menu:", error);
        }
    }
});
