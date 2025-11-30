const BASE_URL = 'https://app.addy.io/api/v1';

export interface AddyAccountDetails {
    id: string;
    username: string;
    default_alias_domain?: string;
    default_alias_format?: string;
    subscription?: string;
    // Add other fields as needed
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

        // 4. Shared Domains (Hardcoded as they are standard for Addy.io)
        const sharedDomains = [
            'anonaddy.com',
            'anonaddy.me',
            '4wrd.cc',
            'mailer.me',
            'addymail.com',
            'addy.io'
        ];

        // 5. Construct the full list
        let fullList: string[] = [];

        // Add Shared Domains (Root) - REMOVED as per user request to filter out non-subdomain options
        // fullList.push(...sharedDomains);

        // Add User Subdomains (username.shareddomain)
        for (const username of allUsernames) {
            for (const shared of sharedDomains) {
                fullList.push(`${username}.${shared}`);
            }
        }

        // Add Custom Domains
        fullList.push(...customDomains);

        return fullList;

    } catch (error) {
        console.error('Failed to fetch domains', error);
        // Fallback
        return ['addy.io', 'anonaddy.com', 'anonaddy.me'];
    }
};
