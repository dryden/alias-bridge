export interface AliasProvider {
    id: string;
    name: string;
    verifyToken(token: string): Promise<boolean>;
    getDomains(token: string): Promise<string[]>;
    generateAddress(localPart: string, domain: string): string;
    createAlias?(alias: string, token: string, domain?: string): Promise<{ success: boolean; error?: string; isCatchAllDomain?: boolean; createdAlias?: string }>;
}

export interface ProviderConfig {
    id: string;
    enabled: boolean;
    token: string;
    defaultDomain?: string;
    activeFormat?: string; // 'uuid', 'random', 'domain', 'custom'
    customRule?: CustomRule;
    waitServerConfirmation?: boolean; // Wait for server confirmation before applying email to field
    domainCatchAllStatus?: Record<string, boolean>; // Cache catch-all status per domain
    cachedDomains?: string[]; // Cache of available domains
    domainsCachedAt?: number; // Timestamp of when domains were cached
    favoriteDomains?: string[]; // Favorite domains shown at the top of selector
}

export interface CustomRule {
    prefixType: string;
    prefixText: string;
    suffixType: string;
    suffixText: string;
    separator: boolean;
}

export interface MultiProviderSettings {
    providers: Record<string, ProviderConfig>;
    defaultProviderId: string;
}
