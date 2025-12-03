import type { AliasProvider } from './types';
import { AddyProvider } from './addy.provider';
import { SimpleLoginProvider } from './simplelogin.provider';

class ProviderRegistry {
    private providers: Map<string, AliasProvider> = new Map();

    constructor() {
        this.register(new AddyProvider());
        this.register(new SimpleLoginProvider());
    }

    register(provider: AliasProvider) {
        this.providers.set(provider.id, provider);
    }

    get(id: string): AliasProvider | undefined {
        return this.providers.get(id);
    }

    getAll(): AliasProvider[] {
        return Array.from(this.providers.values());
    }
}

export const providerRegistry = new ProviderRegistry();
