export function getDomainFromUrl(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        // Remove www. prefix if present
        const cleanHostname = hostname.replace(/^www\./, '');

        // Split by dot
        const parts = cleanHostname.split('.');

        // If we have 2 parts (e.g. google.com), return the first part
        if (parts.length === 2) {
            return parts[0];
        }

        // If we have more than 2 parts (e.g. dashboard.rightnowai.co, mail.google.co.uk)
        // This is a naive implementation but covers many cases. 
        // Ideally we'd use a public suffix list library but that might be too heavy.
        // For now, let's try to grab the part before the last 1 or 2 parts depending on length.

        // Common 2-part TLDs (simplified list)
        const twoPartTlds = ['co.uk', 'co.jp', 'com.tw', 'org.uk', 'net.au'];
        const lastTwo = parts.slice(-2).join('.');

        if (twoPartTlds.includes(lastTwo)) {
            // e.g. google.co.uk -> parts: [google, co, uk] -> length 3. 
            // We want parts[length - 3]
            if (parts.length >= 3) {
                return parts[parts.length - 3];
            }
        }

        // Standard case: sub.domain.com -> domain
        // We generally want the SLD (Second Level Domain).
        // If parts > 2, usually the SLD is at index parts.length - 2.
        // e.g. dashboard.rightnowai.co -> rightnowai (parts: [dashboard, rightnowai, co])
        // e.g. sub.sub.domain.com -> domain (parts: [sub, sub, domain, com])

        return parts[parts.length - 2];

    } catch (e) {
        return '';
    }
}

function safeUUID(): string {
    // Pure Math.random fallback to avoid any window/crypto issues in Service Worker
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function generateUUIDAlias(domain: string = 'anonaddy.com'): string {
    const uuid = safeUUID();
    return `${uuid}@${domain}`;
}

export function generateRandomAlias(domain: string = 'anonaddy.com'): string {
    const random = Math.random().toString(36).substring(2, 10);
    return `${random}@${domain}`;
}

export function generateDomainAlias(url: string, username: string, domain: string = 'anonaddy.com'): string {
    const siteDomain = getDomainFromUrl(url).split('.')[0];
    return `${siteDomain}@${username}.${domain}`;
}
