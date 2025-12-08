import { AddyProvider } from './addy.provider';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as AddyModule from '../addy';

// Mock global fetch
global.fetch = vi.fn();

// Mock addy module
vi.mock('../addy', async () => {
    return {
        verifyToken: vi.fn(),
        getDomains: vi.fn(),
        getDomainDetails: vi.fn(), // We'll mock return values in tests
        normalizeBaseUrl: (url: string) => url ? `${url}/api/v1` : 'https://app.addy.io/api/v1'
    }
});


describe('AddyProvider', () => {
    let provider: AddyProvider;
    const mockToken = 'mock-token';
    const mockBaseUrl = 'https://app.addy.io';

    beforeEach(() => {
        provider = new AddyProvider();
        vi.clearAllMocks();
    });

    describe('createAlias', () => {
        it('should use "uuid" api format when format is "uuid" in Server Generation Mode', async () => {
            // Setup mock response
            const mockResponse = {
                data: {
                    id: 'new-alias-id',
                    local_part: 'generated-uuid-alias',
                    domain: 'anonaddy.me',
                    email: 'generated-uuid-alias@anonaddy.me'
                }
            };
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            // Call createAlias with format='uuid' and empty alias (Server Generation)
            const result = await provider.createAlias('', mockToken, 'anonaddy.me', 'example.com', mockBaseUrl, 'uuid');

            // Verify
            expect(result.success).toBe(true);
            expect(result.createdAlias).toBe('generated-uuid-alias@anonaddy.me');

            // Check API call arguments
            expect(global.fetch).toHaveBeenCalledWith(
                `${mockBaseUrl}/api/v1/aliases`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        domain: 'anonaddy.me',
                        format: 'uuid',
                        description: 'Created by Alias Bridge for example.com'
                    })
                })
            );
        });

        it('should use "random_characters" api format when format is "random" in Server Generation Mode', async () => {
            // Setup mock response
            const mockResponse = {
                data: {
                    email: 'random@anonaddy.me'
                }
            };
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            // Call createAlias with format='random'
            await provider.createAlias('', mockToken, 'anonaddy.me', 'example.com', mockBaseUrl, 'random');

            // Check API call arguments
            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({
                        domain: 'anonaddy.me',
                        format: 'random_characters',
                        description: 'Created by Alias Bridge for example.com'
                    })
                })
            );
        });

        it('should default to "uuid" if format is missing or invalid in Server Generation Mode', async () => {
            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ data: { email: 'default@anonaddy.me' } })
            });

            // Call createAlias with undefined format
            await provider.createAlias('', mockToken, 'anonaddy.me', 'example.com', mockBaseUrl, undefined);

            // Check API call arguments - should default to uuid
            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({
                        domain: 'anonaddy.me',
                        format: 'uuid',
                        description: 'Created by Alias Bridge for example.com'
                    })
                })
            );
        });

        it('should use "custom" format when explicit alias is provided (Custom Alias Mode)', async () => {
            // Mock getDomainDetails to return catch_all: false
            const getDomainDetailsMock = vi.mocked(AddyModule.getDomainDetails);
            getDomainDetailsMock.mockResolvedValue({
                domain: 'anonaddy.me',
                catch_all: false
            });

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ data: { address: 'my-custom@anonaddy.me' } })
            });

            // Call createAlias with explicit alias 'my-custom'
            await provider.createAlias('my-custom@anonaddy.me', mockToken, 'anonaddy.me', 'example.com', mockBaseUrl);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: JSON.stringify({
                        local_part: 'my-custom',
                        domain: 'anonaddy.me',
                        format: 'custom',
                        description: 'Created by Alias Bridge for example.com'
                    })
                })
            );
        });
    });
});
