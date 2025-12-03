import { generateLocalPart, DEFAULT_CUSTOM_RULE, type CustomRule } from './lib/aliasGenerator';

console.log("Alias Bridge content script loaded");

// --- Minimal Provider Logic for Content Script ---
// Since we can't easily import the full provider service/registry due to dependencies,
// we'll implement a lightweight version here that matches the logic in the main extension.

interface ProviderConfig {
    id: string;
    enabled: boolean;
    token: string;
    defaultDomain?: string;
    activeFormat?: string;
    customRule?: CustomRule;
}

interface MultiProviderSettings {
    providers: Record<string, ProviderConfig>;
    defaultProviderId: string;
}


const generateAddress = (providerId: string, localPart: string, domain: string): string => {
    if (providerId === 'simplelogin') {
        // Clean localPart for SimpleLogin (lowercase, alphanum + underscore only)
        let cleanLocal = localPart.toLowerCase().replace(/[^a-z0-9_]/g, '');
        // Ensure it starts with a letter (SimpleLogin requires leading letter)
        if (!/^[a-z]/.test(cleanLocal)) {
            cleanLocal = 'a' + cleanLocal;
        }
        // Limit length (max 20 chars for SimpleLogin) after ensuring leading letter
        if (cleanLocal.length > 20) {
            cleanLocal = cleanLocal.substring(0, 20);
        }
        if (!cleanLocal) {
            cleanLocal = 'alias';
        }
        cleanLocal = cleanLocal.replace(/^_+|_+$/g, '');
        // SimpleLogin logic: if domain contains @, it's a suffix, otherwise append @domain
        if (domain.includes('@')) {
            return `${cleanLocal}${domain}`;
        }
        return `${cleanLocal}@${domain}`;
    } else {
        // Addy.io logic (and default): localPart@domain
        return `${localPart}@${domain}`;
    }
};


// Function to create and inject the icon
function injectIcon(input: HTMLInputElement) {
    // Check if icon already exists
    if (input.dataset.aliasBridgeIcon) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = input.offsetWidth > 0 ? `${input.offsetWidth}px` : '100%';

    const iconContainer = document.createElement('div');
    iconContainer.style.position = 'absolute';
    iconContainer.style.top = '50%';
    iconContainer.style.right = '10px';
    iconContainer.style.transform = 'translateY(-50%)';
    iconContainer.style.cursor = 'pointer';
    iconContainer.style.zIndex = '1000';
    iconContainer.style.display = 'flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.justifyContent = 'center';
    iconContainer.style.width = '20px';
    iconContainer.style.height = '20px';
    iconContainer.style.backgroundColor = '#1e293b'; // Slate 800
    iconContainer.style.borderRadius = '4px';
    iconContainer.title = 'Generate Alias';

    // Custom Logo
    const logoUrl = chrome.runtime.getURL('icon-16.png');
    iconContainer.innerHTML = `<img src="${logoUrl}" style="width: 14px; height: 14px; display: block;" />`;

    const parent = input.parentElement;
    if (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'static') {
            parent.style.position = 'relative';
        }

        parent.appendChild(iconContainer);

        // Mark input as processed
        input.dataset.aliasBridgeIcon = 'true';

        // Click handler
        iconContainer.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Fetch settings
            chrome.storage.local.get(['multiProviderSettings', 'userData'], async (result) => {
                const settings = result.multiProviderSettings as MultiProviderSettings | undefined;

                if (!settings || !settings.defaultProviderId || !settings.providers[settings.defaultProviderId]) {
                    console.warn('Alias Bridge: No provider configured or default provider missing.');
                    // Fallback to legacy check or alert user?
                    // For now, let's just log. The popup handles the "setup required" state.
                    return;
                }

                const providerId = settings.defaultProviderId;
                const config = settings.providers[providerId];

                if (!config.enabled) {
                    console.warn('Alias Bridge: Default provider is disabled.');
                    return;
                }

                const defaultFormat = config.activeFormat || 'uuid';
                const defaultDomain = config.defaultDomain || '';
                const customRule = config.customRule || DEFAULT_CUSTOM_RULE;

                if (!defaultDomain) {
                    console.warn('Alias Bridge: No default domain configured for provider.');
                    return;
                }

                const localPart = generateLocalPart({
                    type: defaultFormat,
                    currentUrl: window.location.href,
                    customRule: customRule
                });

                const alias = generateAddress(providerId, localPart, defaultDomain);

                // Create alias on server if needed (SimpleLogin)
                if (providerId === 'simplelogin') {
                    try {
                        const BASE_URL = 'https://app.simplelogin.io/api';

                        // Parse alias
                        const atIndex = alias.indexOf('@');
                        const aliasLocalPart = alias.substring(0, atIndex);
                        const aliasDomainPart = alias.substring(atIndex + 1);

                        // Get mailboxes
                        const mailboxesRes = await fetch(`${BASE_URL}/v2/mailboxes`, {
                            headers: { 'Authentication': config.token }
                        });

                        if (!mailboxesRes.ok) {
                            console.warn('Failed to fetch mailboxes:', await mailboxesRes.text());
                            return;
                        }

                        const mailboxesData = await mailboxesRes.json();
                        if (!mailboxesData.mailboxes || mailboxesData.mailboxes.length === 0) {
                            console.warn('No mailboxes found');
                            return;
                        }

                        const mailboxId = mailboxesData.mailboxes[0].id;

                        // Get alias options
                        const optionsRes = await fetch(`${BASE_URL}/v5/alias/options`, {
                            headers: { 'Authentication': config.token }
                        });

                        if (!optionsRes.ok) {
                            console.warn('Failed to get options:', await optionsRes.text());
                            return;
                        }

                        const optionsData = await optionsRes.json();

                        // Find matching suffix
                        const fullSuffix = `@${aliasDomainPart}`;
                        const matchingSuffix = optionsData.suffixes?.find((s: any) => {
                            const suffixStr = typeof s === 'string' ? s : s.suffix;
                            return suffixStr === fullSuffix || (suffixStr.startsWith('.') && suffixStr.endsWith(fullSuffix));
                        });

                        if (matchingSuffix) {
                            // Suffix-based alias
                            const suffixStr = typeof matchingSuffix === 'string' ? matchingSuffix : matchingSuffix.suffix;
                            const signedSuffix = typeof matchingSuffix === 'string' ? matchingSuffix : matchingSuffix.signed_suffix;

                            let prefix = aliasLocalPart;
                            if (suffixStr.startsWith('.')) {
                                const suffixWord = suffixStr.substring(0, suffixStr.indexOf('@'));
                                if (aliasLocalPart.endsWith(suffixWord)) {
                                    prefix = aliasLocalPart.substring(0, aliasLocalPart.length - suffixWord.length);
                                }
                            }


                            // Clean prefix - SimpleLogin only accepts lowercase letters, numbers, and underscores
                            console.log('SimpleLogin: Original prefix:', prefix, 'Length:', prefix.length);

                            prefix = prefix.toLowerCase().replace(/[^a-z0-9_]/g, '');
                            console.log('SimpleLogin: After cleaning:', prefix, 'Length:', prefix.length);

                            // Limit length (SimpleLogin max 32 chars)
                            if (prefix.length > 32) {
                                prefix = prefix.substring(0, 32);
                            }

                            if (!prefix || prefix.length === 0) {
                                prefix = 'alias';
                            }

                            // Remove leading/trailing underscores
                            prefix = prefix.replace(/^_+|_+$/g, '');

                            console.log('SimpleLogin: Final prefix:', prefix, 'Length:', prefix.length);
                            console.log('Creating SimpleLogin alias with suffix:', { prefix, signedSuffix, suffixStr });

                            const createRes = await fetch(`${BASE_URL}/v3/alias/custom/new`, {
                                method: 'POST',
                                headers: {
                                    'Authentication': config.token,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    alias_prefix: prefix,
                                    signed_suffix: signedSuffix,
                                    mailbox_ids: [mailboxId],
                                    note: 'Created by Alias Bridge'
                                })
                            });

                            if (!createRes.ok && createRes.status !== 409) {
                                console.warn('Failed to create SimpleLogin alias:', await createRes.text());
                            }
                        } else {
                            // Custom domain alias
                            console.log('Creating SimpleLogin custom domain alias:', alias);
                            const createRes = await fetch(`${BASE_URL}/v2/alias/custom/new`, {
                                method: 'POST',
                                headers: {
                                    'Authentication': config.token,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    alias: alias,
                                    mailbox_ids: [mailboxId],
                                    note: 'Created by Alias Bridge'
                                })
                            });

                            if (!createRes.ok && createRes.status !== 409) {
                                console.warn('Failed to create SimpleLogin alias:', await createRes.text());
                            }
                        }
                    } catch (err) {
                        console.error('Error creating SimpleLogin alias:', err);
                    }
                }


                // Fill input
                input.value = alias;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));

                // Copy to clipboard
                try {
                    await navigator.clipboard.writeText(alias);
                    // Show feedback
                    const originalBg = iconContainer.style.backgroundColor;
                    iconContainer.style.backgroundColor = '#22c55e'; // Green
                    setTimeout(() => {
                        iconContainer.style.backgroundColor = originalBg;
                    }, 1000);
                } catch (err) {
                    console.error('Failed to copy', err);
                }
            });
        });
    }
}

// Observer to handle dynamic content
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
                const inputs = node.querySelectorAll('input[type="email"]');
                inputs.forEach((input) => injectIcon(input as HTMLInputElement));

                // Also check the node itself
                if (node instanceof HTMLInputElement && node.type === 'email') {
                    injectIcon(node);
                }
            }
        });
    });
});

// Initial check - inject icon on all email inputs
chrome.storage.local.get(['multiProviderSettings'], () => {
    // Initial scan
    document.querySelectorAll('input[type="email"]').forEach((input) => {
        injectIcon(input as HTMLInputElement);
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});

// Listen for messages from background script (Context Menu)
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "insertAlias" && request.alias) {
        const activeElement = document.activeElement as HTMLInputElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            // Clear and fill input
            activeElement.value = request.alias;

            // Trigger events
            activeElement.dispatchEvent(new Event('input', { bubbles: true }));
            activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            // Fallback: Copy to clipboard if no active input
            navigator.clipboard.writeText(request.alias).catch(err => console.error('Failed to copy', err));
        }
    }
});
