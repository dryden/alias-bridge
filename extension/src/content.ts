import { generateAlias, DEFAULT_CUSTOM_RULE, type CustomRule } from './lib/aliasGenerator';

console.log("Alias Bridge content script loaded");

// Function to create and inject the icon
function injectIcon(input: HTMLInputElement) {
    // Check if icon already exists
    if (input.dataset.aliasBridgeIcon) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = input.offsetWidth > 0 ? `${input.offsetWidth}px` : '100%';

    // Insert wrapper before input, then move input into wrapper
    // Note: This might break some layouts, a safer approach is to position absolute overlay
    // Let's try absolute positioning relative to the input's parent or body
    // But for simplicity in MVP, let's try to place an icon INSIDE the input on the right

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

    // We need a way to position this correctly. 
    // A common technique is to wrap the input, but that's invasive.
    // Another is to append to body and calculate position.

    // For this MVP, let's try to append to the input's parent and position absolute
    // ensuring the parent is relative.
    const parent = input.parentElement;
    if (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'static') {
            parent.style.position = 'relative';
        }

        // Adjust right position based on input padding/margin if needed
        // For now, just append
        parent.appendChild(iconContainer);

        // Mark input as processed
        input.dataset.aliasBridgeIcon = 'true';

        // Click handler
        iconContainer.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Fetch settings
            chrome.storage.local.get(['userData', 'defaultFormat', 'customRule', 'defaultDomain'], async (result) => {
                const userData = result.userData;
                const defaultFormat = result.defaultFormat || 'uuid';
                const customRule = result.customRule ? (result.customRule as CustomRule) : DEFAULT_CUSTOM_RULE;
                const defaultDomain = result.defaultDomain || 'anonaddy.com';

                if (!userData) {
                    console.error('User data not found');
                    return;
                }

                const alias = generateAlias({
                    type: defaultFormat as string,
                    domain: defaultDomain as string,
                    username: (userData as any).username,
                    currentUrl: window.location.href,
                    customRule: customRule
                });

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

// Initial check for API token
chrome.storage.local.get(['addyToken'], (result) => {
    if (result.addyToken) {
        // Initial scan
        document.querySelectorAll('input[type="email"]').forEach((input) => {
            injectIcon(input as HTMLInputElement);
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
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
