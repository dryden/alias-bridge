export function getDomainFromUrl(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        // Remove www. prefix if present
        return hostname.replace(/^www\./, '');
    } catch (e) {
        return '';
    }
}

export function generateUUIDAlias(domain: string = 'anonaddy.com'): string {
    const uuid = crypto.randomUUID().split('-')[0]; // Shorten for readability or use full
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
