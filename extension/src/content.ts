import { logger } from './services/logger';

logger.debug('content', 'Alias Bridge content script loaded');


// Function to create and inject the icon
function injectIcon(input: HTMLInputElement) {
    // Check if icon already exists
    if (input.dataset.aliasBridgeIcon) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = input.offsetWidth > 0 ? `${input.offsetWidth}px` : '100%';

    const iconContainer = document.createElement('div');
    iconContainer.setAttribute('data-alias-bridge-icon-container', 'true');
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
    iconContainer.style.backgroundColor = 'transparent';
    iconContainer.style.opacity = '0.6';
    iconContainer.style.transition = 'opacity 0.2s ease';
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

        // Hover effects
        iconContainer.addEventListener('mouseenter', () => {
            iconContainer.style.opacity = '1';
        });
        iconContainer.addEventListener('mouseleave', () => {
            iconContainer.style.opacity = '0.6';
        });

        // Click handler with retry logic
        iconContainer.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Show loading state
            const originalContent = iconContainer.innerHTML;
            iconContainer.innerHTML = '<div style="width: 10px; height: 10px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>';

            // Add spin animation style if not exists
            if (!document.getElementById('alias-bridge-spin-style')) {
                const style = document.createElement('style');
                style.id = 'alias-bridge-spin-style';
                style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
                document.head.appendChild(style);
            }

            const maxRetries = 3;
            const retryDelay = 500;
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Request alias from background script
                    const response = await chrome.runtime.sendMessage({
                        action: 'generateAlias',
                        url: window.location.href
                    });

                    if (response && response.alias) {
                        const alias = response.alias;

                        // Fill input
                        input.value = alias;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.focus();

                        // Copy to clipboard
                        await navigator.clipboard.writeText(alias);

                        // Show success feedback
                        iconContainer.innerHTML = originalContent;
                        const originalBg = iconContainer.style.backgroundColor;
                        iconContainer.style.backgroundColor = '#22c55e'; // Green
                        setTimeout(() => {
                            iconContainer.style.backgroundColor = originalBg;
                        }, 1000);
                        return; // Success
                    } else {
                        logger.warn('content', 'Failed to generate alias', response?.error);
                        throw new Error(response?.error || 'No alias generated');
                    }
                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err));
                    logger.warn('content', `Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

                    // Check if error is "context invalidated" which might be retryable
                    if (lastError.message.includes('context invalidated') && attempt < maxRetries) {
                        logger.debug('content', `Retrying in ${retryDelay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue; // Retry
                    }

                    // For other errors, don't retry
                    if (!lastError.message.includes('context invalidated')) {
                        break;
                    }
                }
            }

            // All attempts failed
            logger.error('content', 'Error requesting alias after retries:', lastError);
            iconContainer.innerHTML = originalContent;
            // Show error feedback (red)
            const originalBg = iconContainer.style.backgroundColor;
            iconContainer.style.backgroundColor = '#ef4444'; // Red
            setTimeout(() => {
                iconContainer.style.backgroundColor = originalBg;
            }, 1000);
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

let isObserverActive = false;

// Function to remove all injected icons
function removeAllIcons() {
    document.querySelectorAll('[data-alias-bridge-icon]').forEach((input) => {
        // Remove the data attribute so it can be re-added later
        delete (input as HTMLElement).dataset.aliasBridgeIcon;

        const parent = input.parentElement;
        if (parent) {
            // Find and remove the icon container
            const iconContainer = parent.querySelector('div[data-alias-bridge-icon-container]');
            if (iconContainer) {
                iconContainer.remove();
            }
        }
    });
}

// Function to inject/remove icons based on settings
function updateIconVisibility() {
    chrome.runtime.sendMessage({ action: 'shouldShowIcon' }, (response) => {
        if (response && response.shouldShow) {
            // Icons should be shown
            document.querySelectorAll('input[type="email"]').forEach((input) => {
                injectIcon(input as HTMLInputElement);
            });

            // Start observing if not already started
            if (!isObserverActive) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                isObserverActive = true;
            }
            logger.debug('content', 'Icons enabled');
        } else {
            // Icons should be hidden
            removeAllIcons();
            if (isObserverActive) {
                observer.disconnect();
                isObserverActive = false;
            }
            logger.debug('content', 'Icons disabled');
        }
    });
}

// Initial check - inject icon on all email inputs
updateIconVisibility();

// Listen for storage changes to update icon visibility
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.multiProviderSettings) {
        logger.debug('content', 'Settings changed, updating icon visibility');
        updateIconVisibility();
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
            navigator.clipboard.writeText(request.alias).catch(err => logger.error('content', 'Failed to copy', err));
        }
    }
});
