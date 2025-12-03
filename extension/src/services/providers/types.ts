export interface AliasProvider {
    id: string;
    name: string;
    verifyToken(token: string): Promise<boolean>;
    getDomains(token: string): Promise<string[]>;
    generateAddress(localPart: string, domain: string): string;
    createAlias?(alias: string, token: string): Promise<{ success: boolean; error?: string }>;
}

export interface ProviderConfig {
    id: string;
    enabled: boolean;
    token: string;
    defaultDomain?: string;
    activeFormat?: string; // 'uuid', 'random', 'domain', 'custom'
    customRule?: CustomRule;
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
