
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDomainDetails, normalizeBaseUrl, resetInstanceContextCache } from './addy';

// Mock logger to avoid clutter
vi.mock('../logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// We need to access the un-exported fetchInstanceContext roughly or indirectly.
// Since `getDomainDetails` calls `fetchInstanceContext` internally which calls `fetch`,
// we can test the behavior by mocking `fetch` responses.

// Debug wrapper for fetch
const actualFetch = vi.fn();
global.fetch = async (url: any, options: any) => {
    console.log(`[TEST FETCH] ${url}`);
    return actualFetch(url, options);
};
(global.fetch as any).mockResolvedValueOnce = (val: any) => actualFetch.mockResolvedValueOnce(val);

describe('addy.ts', () => {

    // Reset mocks before each test
    beforeEach(() => {
        vi.clearAllMocks();
        resetInstanceContextCache();
    });

    describe('getDomainDetails', () => {
        const mockToken = 'test-token';
        const mockBaseUrl = 'https://selfhosted.com/api/v1';

        it('should infer shared root domain from defaultAliasDomain heuristic', async () => {
            // Scene: Self-hosted instance where account-details returns empty active_shared_domains
            // But default_alias_domain is "unbox.at" (root), and user is "009".

            // Mock fetch responses
            // 1. Account Details (called by fetchInstanceContext)
            // 2. Custom Domains check (called first in getDomainDetails)
            // 3. Usernames check (called by getDomainDetails for "009.unbox.at")

            const accountResponse = {
                data: {
                    username: '009',
                    active_shared_domains: [], // Empty!
                    default_alias_domain: 'unbox.at'
                }
            };

            const customDomainsResponse = {
                data: []
            };

            const usernamesResponse = {
                data: [{ username: '009', catch_all: true }]
            };

            // Correct Order in getDomainDetails:
            // 1. /domains (Custom Domains)
            // 2. /account-details (via fetchInstanceContext)
            // 3. /usernames (if shared subdomain logic triggered)

            (global.fetch as any)
                .mockResolvedValueOnce({ // custom-domains (1)
                    ok: true,
                    json: async () => customDomainsResponse
                })
                .mockResolvedValueOnce({ // account-details (2)
                    ok: true,
                    json: async () => accountResponse
                })
                .mockResolvedValueOnce({ // usernames (3)
                    ok: true,
                    json: async () => usernamesResponse
                });

            // We test getting details for the USER SUBDOMAIN "009.unbox.at"
            // The logic should:
            // 1. Fetch context -> see empty shared list -> use heuristic to add "unbox.at" to shared list.
            // 2. Parse "009.unbox.at" -> split -> potential shared "unbox.at".
            // 3. Match potential shared "unbox.at" with the heuristic-added "unbox.at".
            // 4. Identify as shared subdomain.

            const result = await getDomainDetails(mockToken, '009.unbox.at', mockBaseUrl);

            expect(result).not.toBeNull();
            expect(result?.shared).toBe(true);
            expect(result?.domain).toBe('009.unbox.at');
            expect(result?.catch_all).toBe(true); // From usernames response
        });

        it('should return catch_all: null (Unknown) if username lookup fails', async () => {
            // Scene: Valid shared subdomain, but /usernames API fails
            const accountResponse = {
                data: {
                    username: 'user',
                    active_shared_domains: ['shared.com'],
                    default_alias_domain: 'shared.com'
                }
            };

            (global.fetch as any)
                .mockResolvedValueOnce({ // custom-domains
                    ok: true,
                    json: async () => ({ data: [] })
                })
                .mockResolvedValueOnce({ // account-details
                    ok: true,
                    json: async () => accountResponse
                })
                .mockResolvedValueOnce({ // usernames -> ERROR
                    ok: false,
                    status: 500
                });

            const result = await getDomainDetails(mockToken, 'user.shared.com', mockBaseUrl);

            expect(result).not.toBeNull();
            expect(result?.shared).toBe(true);
            expect(result?.catch_all).toBeNull(); // Should be null, not false!
        });
    });

    describe('normalizeBaseUrl', () => {
        it('should normalize urls correctly', () => {
            expect(normalizeBaseUrl('https://app.addy.io')).toBe('https://app.addy.io/api/v1');
            expect(normalizeBaseUrl('https://app.addy.io/')).toBe('https://app.addy.io/api/v1');
            expect(normalizeBaseUrl('https://app.addy.io/api')).toBe('https://app.addy.io/api/v1');
            expect(normalizeBaseUrl('https://app.addy.io/api/v1')).toBe('https://app.addy.io/api/v1');
        });
    });
});
