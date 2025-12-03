const BASE_URL = 'https://app.addy.io/api/v1';

export interface AddyAccountDetails {
    id: string;
    username: string;
    default_alias_domain?: string;
    default_alias_format?: string;
    subscription?: string;
    // Add other fields as needed
}

export interface AddyDomainDetails {
    domain: string;
    catch_all: boolean;
    [key: string]: any;
}

export const verifyToken = async (token: string): Promise<AddyAccountDetails> => {
    const response = await fetch(`${BASE_URL}/account-details`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('Invalid token or network error');
    }

    const data = await response.json();
    return data.data;
};

export const SHARED_DOMAINS = [
    'anonaddy.com',
    'anonaddy.me',
    '4wrd.cc',
    'mailer.me',
    'addymail.com',
    'addy.io'
];

export const getDomainDetails = async (token: string, domain: string): Promise<AddyDomainDetails | null> => {
    try {
        console.log('[Addy] getDomainDetails - Fetching details for:', domain);

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // First, try to fetch custom domains
        const domainsResponse = await fetch(`${BASE_URL}/domains`, { headers });
        if (domainsResponse.ok) {
            const domainsData = await domainsResponse.json();
            console.log('[Addy] Custom domains fetched:', domainsData.data?.map((d: any) => ({ domain: d.domain, catch_all: d.catch_all })));

            // Try exact match in custom domains
            let domainData = domainsData.data?.find((d: any) => d.domain === domain);

            if (domainData) {
                console.log('[Addy] Found custom domain:', { domain: domainData.domain, catch_all: domainData.catch_all });
                return {
                    domain: domainData.domain,
                    catch_all: domainData.catch_all ?? true,
                    ...domainData
                };
            }
        }

        // If not found in custom domains, check if it's a username with shared domains (e.g., 0309.addy.io)
        // Extract potential username from the domain
        const parts = domain.split('.');
        console.log('[Addy] Parsing domain:', { domain, parts });
        if (parts.length >= 2) {
            const potentialUsername = parts[0];
            const potentialSharedDomain = parts.slice(1).join('.');
            console.log('[Addy] Extracted potential username and domain:', { potentialUsername, potentialSharedDomain });
            console.log('[Addy] Is potentialSharedDomain in SHARED_DOMAINS?', SHARED_DOMAINS.includes(potentialSharedDomain));

            // Check if the second part is a shared domain
            if (SHARED_DOMAINS.includes(potentialSharedDomain)) {
                console.log('[Addy] Detected username.shared domain format:', { username: potentialUsername, shared: potentialSharedDomain });

                // Fetch usernames to get catch_all status
                const usernamesResponse = await fetch(`${BASE_URL}/usernames`, { headers });
                if (usernamesResponse.ok) {
                    const usernamesData = await usernamesResponse.json();
                    console.log('[Addy] Usernames fetched:', usernamesData.data?.map((u: any) => ({ username: u.username, catch_all: u.catch_all })));

                    const usernameData = usernamesData.data?.find((u: any) => u.username === potentialUsername);

                    if (usernameData) {
                        console.log('[Addy] Found username:', { username: usernameData.username, catch_all: usernameData.catch_all });
                        return {
                            domain,
                            catch_all: usernameData.catch_all ?? true,
                            ...usernameData
                        };
                    }
                }

                // If username not found in the list, default to true for catch_all
                console.log('[Addy] Username not found in list, defaulting catch_all to true');
                return {
                    domain,
                    catch_all: true
                };
            }
        }

        // Check if it's a root shared domain (like anonaddy.com, anonaddy.me, etc.)
        if (SHARED_DOMAINS.includes(domain)) {
            console.log('[Addy] Domain is a root shared domain:', domain);
            return {
                domain,
                catch_all: false
            };
        }

        console.log('[Addy] Domain not found and not a recognized pattern:', domain);
        return null;

    } catch (error) {
        console.error('[Addy] Failed to fetch domain details for', domain, ':', error);
        return null;
    }
};

export const getDomains = async (token: string): Promise<string[]> => {
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // 1. Fetch Account Details (for main username)
        const accountRes = await fetch(`${BASE_URL}/account-details`, { headers });
        const accountData = await accountRes.json();
        const mainUsername = accountData.data?.username;

        // 2. Fetch Additional Usernames
        const usernamesRes = await fetch(`${BASE_URL}/usernames`, { headers });
        const usernamesData = usernamesRes.ok ? await usernamesRes.json() : { data: [] };
        const additionalUsernames = usernamesData.data?.map((u: any) => u.username) || [];

        const allUsernames = [mainUsername, ...additionalUsernames].filter(Boolean);

        // 3. Fetch Custom Domains
        const domainsRes = await fetch(`${BASE_URL}/domains`, { headers });
        const domainsData = domainsRes.ok ? await domainsRes.json() : { data: [] };
        const customDomains = domainsData.data?.map((d: any) => d.domain) || [];

        // 4. Construct the full list
        let fullList: string[] = [];

        // Add User Subdomains (username.shareddomain)
        for (const username of allUsernames) {
            for (const shared of SHARED_DOMAINS) {
                fullList.push(`${username}.${shared}`);
            }
        }

        // Add Custom Domains
        fullList.push(...customDomains);

        // Add Shared Domains (Root) - Added back as per request, to be shown as optional
        fullList.push(...SHARED_DOMAINS);

        return fullList;

    } catch (error) {
        console.error('Failed to fetch domains', error);
        // Fallback
        return ['addy.io', 'anonaddy.com', 'anonaddy.me'];
    }
};

export const getDomainId = async (token: string, domainName: string): Promise<number | null> => {
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        console.log('[Addy] getDomainId - Looking up ID for domain:', domainName);

        // Fetch custom domains to get the domain ID
        const domainsRes = await fetch(`${BASE_URL}/domains`, { headers });
        if (domainsRes.ok) {
            const domainsData = await domainsRes.json();
            const domainData = domainsData.data?.find((d: any) => d.domain === domainName);
            if (domainData && domainData.id) {
                console.log('[Addy] Found domain ID:', domainData.id);
                return domainData.id;
            }
        }

        console.log('[Addy] Domain ID not found for:', domainName);
        return null;
    } catch (error) {
        console.error('[Addy] Error fetching domain ID:', error);
        return null;
    }
};
