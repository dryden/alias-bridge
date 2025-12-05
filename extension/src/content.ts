import { logger } from './services/logger';

logger.debug('content', 'Alias Bridge content script loaded');


// Function to create and inject the icon
function injectIcon(input: HTMLInputElement) {
    // Check if icon already exists
    if (input.dataset.aliasBridgeIcon) return;

    const iconContainer = document.createElement('div');
    iconContainer.setAttribute('data-alias-bridge-icon-container', 'true');
    iconContainer.style.position = 'absolute';
    // Top and Left will be calculated dynamically
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

    // Append to body to avoid layout issues and z-index wars
    document.body.appendChild(iconContainer);

    // Position icon using getBoundingClientRect for accuracy
    const updateIconPosition = () => {
        // Check if input is still in DOM
        if (!input.isConnected) {
            iconContainer.remove();
            return;
        }

        const rect = input.getBoundingClientRect();
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Check if input is visible
        if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(input).display === 'none') {
            iconContainer.style.display = 'none';
            return;
        } else {
            iconContainer.style.display = 'flex';
        }

        iconContainer.style.top = `${rect.top + scrollTop + (rect.height / 2)}px`;
        // Position 10px from the right edge of the input
        iconContainer.style.left = `${rect.left + scrollLeft + rect.width - 30}px`;
    };

    // Initial position update
    updateIconPosition();

    // Update position on window resize and scroll
    window.addEventListener('resize', updateIconPosition);
    window.addEventListener('scroll', updateIconPosition, { capture: true, passive: true });

    // Observe input resize
    const resizeObserver = new ResizeObserver(() => {
        updateIconPosition();
    });
    resizeObserver.observe(input);

    // Store cleanup function on the input for removal later
    (input as any)._aliasBridgeCleanup = () => {
        window.removeEventListener('resize', updateIconPosition);
        window.removeEventListener('scroll', updateIconPosition, { capture: true });
        resizeObserver.disconnect();
        iconContainer.remove();
        delete (input as any)._aliasBridgeCleanup;
    };

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

                    // Copy to clipboard (non-fatal)
                    try {
                        await navigator.clipboard.writeText(alias);
                    } catch (clipboardError) {
                        logger.warn('content', 'Failed to copy alias to clipboard (non-fatal):', clipboardError);
                    }

                    // Show success feedback
                    iconContainer.innerHTML = originalContent;
                    return; // Success
                } else {
                    logger.warn('content', 'Failed to generate alias', response?.error);
                    throw new Error(response?.error || 'No alias generated');
                }
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                logger.warn('content', `Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

                // Check if error is "context invalidated"
                if (lastError.message.includes('context invalidated')) {
                    logger.warn('content', 'Extension context invalidated. Stopping retries.');
                    alert('Alias Bridge has been updated. Please reload this page to continue using the extension.');
                    break; // Stop retrying immediately
                }

                // For other errors, retry if attempts remain
                if (attempt < maxRetries) {
                    logger.debug('content', `Retrying in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue; // Retry
                }
            }
        }

        // All attempts failed
        logger.error('content', 'Error requesting alias after retries:', lastError);
        iconContainer.innerHTML = originalContent;
    });
}


// Helper to check if an element is an email input
function isEmailInput(element: Element): boolean {
    if (!(element instanceof HTMLInputElement)) return false;

    const type = element.type.toLowerCase();
    // Ignore non-text inputs
    if (['hidden', 'submit', 'button', 'image', 'reset', 'checkbox', 'radio'].includes(type)) return false;

    const name = element.name.toLowerCase();
    const id = element.id.toLowerCase();
    const placeholder = (element.placeholder || '').toLowerCase();
    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
    const autocomplete = (element.autocomplete || '').toLowerCase();

    return type === 'email' ||
        name.includes('email') ||
        id.includes('email') ||
        placeholder.includes('email') ||
        ariaLabel.includes('email') ||
        autocomplete.includes('email');
}

// Track observed shadow roots to prevent duplicate observers
let observedRoots = new WeakSet<Node>();

function scanAndInject(root: Node) {
    if (!(root instanceof Element || root instanceof Document || root instanceof ShadowRoot)) return;

    // Check the root itself if it's an element
    if (root instanceof Element && isEmailInput(root)) {
        injectIcon(root as HTMLInputElement);
    }

    // Find all descendants
    const elements = (root as Element | Document | ShadowRoot).querySelectorAll('*');
    elements.forEach(el => {
        if (isEmailInput(el)) {
            injectIcon(el as HTMLInputElement);
        }

        // Check for shadow root
        if (el.shadowRoot && !observedRoots.has(el.shadowRoot)) {
            observeDOM(el.shadowRoot);
        }
    });
}

function observeDOM(root: Node) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);

    observer.observe(root, {
        childList: true,
        subtree: true
    });

    // Initial scan of the new root
    scanAndInject(root);
}

// Observer to handle dynamic content and Shadow DOM
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            scanAndInject(node);
        });
    });
});

let isObserverActive = false;

// Function to remove all injected icons (including in Shadow DOM)
function removeAllIcons(root: Node = document) {
    if (root instanceof Element || root instanceof Document || root instanceof ShadowRoot) {
        const inputs = (root as Element | Document | ShadowRoot).querySelectorAll('[data-alias-bridge-icon]');
        inputs.forEach((input) => {
            // Remove the data attribute so it can be re-added later
            delete (input as HTMLElement).dataset.aliasBridgeIcon;

            // Call cleanup function if it exists
            if ((input as any)._aliasBridgeCleanup) {
                (input as any)._aliasBridgeCleanup();
            } else {
                // Fallback cleanup if no cleanup function (shouldn't happen with new logic)
                const parent = input.parentElement;
                if (parent) {
                    const iconContainer = parent.querySelector('div[data-alias-bridge-icon-container]');
                    if (iconContainer) iconContainer.remove();
                }
                // Also check body for orphaned icons (though we don't have a direct link without the cleanup fn)
                document.querySelectorAll('div[data-alias-bridge-icon-container]').forEach(el => el.remove());
            }
        });

        // Recurse into shadow roots
        const allElements = (root as Element | Document | ShadowRoot).querySelectorAll('*');
        allElements.forEach(el => {
            if (el.shadowRoot) removeAllIcons(el.shadowRoot);
        });
    }
}

// Function to inject/remove icons based on settings
function updateIconVisibility() {
    try {
        // Check if runtime is still valid before sending
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
            logger.debug('content', 'Extension context invalid, skipping updateIconVisibility');
            return;
        }

        chrome.runtime.sendMessage({ action: 'shouldShowIcon' }, (response) => {
            // Check for runtime error (including context invalidated)
            if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message;
                if (errorMsg && errorMsg.includes('Extension context invalidated')) {
                    logger.warn('content', 'Extension context invalidated. Please reload the page.');
                    // Disconnect observer to prevent further errors
                    if (isObserverActive) {
                        observer.disconnect();
                        isObserverActive = false;
                    }
                    return;
                }
                // Log other errors but don't crash
                logger.debug('content', 'Error checking icon visibility:', errorMsg);
                return;
            }

            if (response && response.shouldShow) {
                // Icons should be shown
                // Reset observed roots to ensure we re-scan everything
                observedRoots = new WeakSet<Node>();

                scanAndInject(document);

                // Start observing if not already started
                if (!isObserverActive) {
                    observeDOM(document.body);
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
    } catch (error) {
        // Catch synchronous errors (though sendMessage is usually async or callback-based)
        logger.warn('content', 'Error in updateIconVisibility:', error);
    }
}

// Initial check - inject icon on all email inputs
// Wrap in a small timeout to ensure extension context is ready
setTimeout(updateIconVisibility, 100);

// Listen for storage changes to update icon visibility
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.multiProviderSettings) {
        logger.debug('content', 'Settings changed, updating icon visibility');
        updateIconVisibility();
    }
});

// Helper to find deep active element
function getDeepActiveElement(): Element | null {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
        el = el.shadowRoot.activeElement;
    }
    return el;
}

// Helper to find email input deeply
function findEmailInputDeep(root: Node = document): HTMLInputElement | null {
    if (root instanceof Element || root instanceof Document || root instanceof ShadowRoot) {
        // 1. Check root itself
        if (root instanceof Element && isEmailInput(root)) {
            return root as HTMLInputElement;
        }

        // 2. Check children
        const elements = (root as Element | Document | ShadowRoot).querySelectorAll('*');
        for (const el of elements) {
            if (isEmailInput(el)) return el as HTMLInputElement;

            if (el.shadowRoot) {
                const found = findEmailInputDeep(el.shadowRoot);
                if (found) return found;
            }
        }
    }
    return null;
}

// Helper function to find and fill input
function fillInput(alias: string, shouldCopyOnFailure: boolean = true): boolean {
    let targetElement = getDeepActiveElement() as HTMLInputElement;

    // If active element is not a valid input, try to find one
    if (!targetElement || targetElement === document.body || (targetElement.tagName !== 'INPUT' && targetElement.tagName !== 'TEXTAREA')) {
        // 1. Try to find email input deeply
        const emailInput = findEmailInputDeep();
        if (emailInput) {
            targetElement = emailInput;
        } else {
            // 2. Try first valid input
            const firstInput = document.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
            if (firstInput) {
                targetElement = firstInput as HTMLInputElement;
            }
        }
    }

    if (targetElement && (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
        // Clear and fill input
        targetElement.value = alias;

        // Trigger events
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
        targetElement.focus();
        return true;
    } else {
        // Fallback: Copy to clipboard if no active input and allowed
        if (shouldCopyOnFailure) {
            navigator.clipboard.writeText(alias).catch(err => {
                // Downgrade to warning as this is expected in some contexts (e.g. no user gesture)
                logger.warn('content', 'Failed to copy to clipboard (fallback)', err);
            });
        }
        return false;
    }
}

// Listen for messages from background script (Context Menu) and Popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "insertAlias" && request.alias) {
        // From Context Menu: Try to fill, fallback to copy (true)
        const success = fillInput(request.alias, true);
        sendResponse({ success });
    } else if (request.action === "fillAliasFromPopup" && request.alias) {
        // From Popup: Try to fill, DO NOT copy on failure (false) because Popup already copied it
        const success = fillInput(request.alias, false);
        sendResponse({ success });
    }
});
