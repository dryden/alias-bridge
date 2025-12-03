console.log("Alias Bridge content script loaded");


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
                } else {
                    console.warn('Alias Bridge: Failed to generate alias', response?.error);
                    // Revert icon
                    iconContainer.innerHTML = originalContent;
                    // Optional: Show error feedback (red)
                    const originalBg = iconContainer.style.backgroundColor;
                    iconContainer.style.backgroundColor = '#ef4444'; // Red
                    setTimeout(() => {
                        iconContainer.style.backgroundColor = originalBg;
                    }, 1000);
                }
            } catch (err) {
                console.error('Alias Bridge: Error requesting alias:', err);
                iconContainer.innerHTML = originalContent;
            }
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
chrome.runtime.sendMessage({ action: 'shouldShowIcon' }, (response) => {
    if (response && response.shouldShow) {
        // Initial scan
        document.querySelectorAll('input[type="email"]').forEach((input) => {
            injectIcon(input as HTMLInputElement);
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    } else {
        console.log('Alias Bridge: Icon injection disabled by settings');
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
