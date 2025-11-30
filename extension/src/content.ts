import { getDomainFromUrl } from './lib/domain';

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

    // Simple SVG Icon
    iconContainer.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  `;

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

            // Generate alias (Mock for now, or fetch from storage settings)
            // In real app, we might want to open a mini popup or just fill immediately
            const domain = getDomainFromUrl(window.location.href);
            const random = Math.random().toString(36).substring(2, 8);
            const alias = `alias.${domain}.${random}@anonaddy.com`;

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

// Initial scan
document.querySelectorAll('input[type="email"]').forEach((input) => {
    injectIcon(input as HTMLInputElement);
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});
