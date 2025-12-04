import { getDomainFromUrl } from './domain';

export interface CustomRule {
    prefixType: string;
    prefixText: string;
    suffixType: string;
    suffixText: string;
    separator: boolean;
}

export const DEFAULT_CUSTOM_RULE: CustomRule = {
    prefixType: 'none',
    prefixText: '',
    suffixType: 'none',
    suffixText: '',
    separator: true
}

export interface AliasGeneratorOptions {
    type: string; // 'uuid' | 'random' | 'domain' | 'custom'
    domain: string;
    username: string;
    currentUrl: string;
    customRule?: CustomRule;
}

function safeUUID(): string {
    // Pure Math.random fallback to avoid any window/crypto issues in Service Worker
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function generateLocalPart(options: Omit<AliasGeneratorOptions, 'domain' | 'username'>): string {
    const { type, currentUrl, customRule = DEFAULT_CUSTOM_RULE } = options;

    switch (type) {
        case 'uuid': {
            return safeUUID();
        }
        case 'random': {
            return Math.random().toString(36).substring(2, 10);
        }
        case 'domain': {
            return getDomainFromUrl(currentUrl) || 'site';
        }
        case 'custom': {
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const yyyy = now.getFullYear();
            const mm = pad(now.getMonth() + 1);
            const dd = pad(now.getDate());
            const hh = pad(now.getHours());
            const min = pad(now.getMinutes());

            const safeSeparator = customRule.separator !== undefined ? customRule.separator : true;
            const sep = safeSeparator ? '-' : '';

            const getPart = (partType: string, text: string, isSuffix: boolean) => {
                switch (partType) {
                    case 'none': return '';
                    case 'yyyy': return isSuffix ? `${sep}${yyyy}` : `${yyyy}${sep}`;
                    case 'yyyymm': return isSuffix ? `${sep}${yyyy}${mm}` : `${yyyy}${mm}${sep}`;
                    case 'yyyymmdd': return isSuffix ? `${sep}${yyyy}${mm}${dd}` : `${yyyy}${mm}${dd}${sep}`;
                    case 'yyyymmddhhmm': return isSuffix ? `${sep}${yyyy}${mm}${dd}${hh}${min}` : `${yyyy}${mm}${dd}${hh}${min}${sep}`;
                    case 'random': {
                        const rand = Math.random().toString(36).substring(2, 8);
                        return isSuffix ? `${sep}${rand}` : `${rand}${sep}`;
                    }
                    case 'uuid': {
                        const uuid = safeUUID();
                        return isSuffix ? `${sep}${uuid}` : `${uuid}${sep}`;
                    }
                    case 'text': return text ? (isSuffix ? `${sep}${text}` : `${text}${sep}`) : '';
                    default: return '';
                }
            }

            const prefix = getPart(customRule.prefixType, customRule.prefixText, false);
            const suffix = getPart(customRule.suffixType, customRule.suffixText, true);
            const siteSlug = getDomainFromUrl(currentUrl) || 'site';

            return `${prefix}${siteSlug}${suffix}`;
        }
        default:
            return '';
    }
}

