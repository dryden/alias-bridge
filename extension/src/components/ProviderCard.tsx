import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Eye, EyeOff, Check, ChevronDown, Fingerprint, Shuffle, Globe, PenTool, Key, RefreshCw, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import { providerService } from '../services/providers/provider.service';
import { providerRegistry } from '../services/providers/registry';
import type { ProviderConfig, CustomRule } from '../services/providers/types';
import { getDomainDetails as fetchDomainDetails } from '../services/addy';
import { groupDomainsByRoot } from '../lib/domainGrouper';

interface ProviderCardProps {
    providerId: string;
    isPro: boolean;
    onConfigChange?: () => void;
}

const DATE_FORMATS = [
    { value: 'none', label: 'None' },
    { value: 'yyyy', label: 'YYYY' },
    { value: 'yyyymm', label: 'YYYYMM' },
    { value: 'yyyymmdd', label: 'YYYYMMDD' },
    { value: 'yyyymmddhhmm', label: 'YYYYMMDDHHMM' },
    { value: 'random', label: 'Random Words' },
    { value: 'uuid', label: 'UUID' },
    { value: 'text', label: 'Custom Text' },
];


const DEFAULT_CUSTOM_RULE: CustomRule = {
    prefixType: 'none',
    prefixText: '',
    suffixType: 'none',
    suffixText: '',
    separator: true
};

export function ProviderCard({ providerId, isPro, onConfigChange }: ProviderCardProps) {
    const provider = providerRegistry.get(providerId);

    const [config, setConfig] = useState<ProviderConfig | null>(null);
    const [token, setToken] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [availableDomains, setAvailableDomains] = useState<string[]>([]);

    const [expandedSection, setExpandedSection] = useState<'domain' | 'format' | null>(null);
    const [previewCustomSettings, setPreviewCustomSettings] = useState(false);
    const [isRefreshingDomains, setIsRefreshingDomains] = useState(false);
    const [catchAllStatus, setCatchAllStatus] = useState<'enabled' | 'disabled' | null>(null);

    useEffect(() => {
        loadConfig();
    }, [providerId]);

    // Monitor default domain changes and check catch_all status for Addy
    useEffect(() => {
        if (providerId === 'simplelogin') {
            // SimpleLogin always requires server confirmation
            if (config && config.waitServerConfirmation !== true) {
                updateConfig({ waitServerConfirmation: true });
            }
        } else if (providerId === 'addy' && config?.defaultDomain && token) {
            // Check if the selected domain has catch_all disabled
            checkDomainCatchAllStatus(config.defaultDomain);
        }
    }, [config?.defaultDomain, providerId, token]);

    const checkDomainCatchAllStatus = async (domain: string) => {
        console.log('[ProviderCard] Checking catch_all status for domain:', domain);
        console.log('[ProviderCard] Token available:', !!token);
        try {
            const details = await fetchDomainDetails(token, domain);
            console.log('[ProviderCard] fetchDomainDetails returned:', details);
            if (details) {
                console.log('[ProviderCard] Domain details:', details);
                console.log('[ProviderCard] catch_all value:', details.catch_all);

                if (details.catch_all === true) {
                    // Catch-all enabled: user cannot use server confirmation
                    console.log('[ProviderCard] Auto-saving waitServerConfirmation: false due to catch_all=true');
                    setCatchAllStatus('enabled');
                    await updateConfig({ waitServerConfirmation: false });
                } else {
                    // Catch-all disabled: server confirmation is required
                    console.log('[ProviderCard] Auto-saving waitServerConfirmation: true due to catch_all=false');
                    setCatchAllStatus('disabled');
                    await updateConfig({ waitServerConfirmation: true });
                }
            } else {
                console.log('[ProviderCard] No details returned for domain:', domain);
                setCatchAllStatus(null);
            }
        } catch (error) {
            console.error('[ProviderCard] Error checking catch_all status:', error);
            setCatchAllStatus(null);
        }
    };

    const handleRefreshDomains = async () => {
        setIsRefreshingDomains(true);
        try {
            console.log('[ProviderCard] Refreshing domains...');
            await fetchDomains(token);
            console.log('[ProviderCard] Domains refreshed. Available domains:', availableDomains);
            // After refreshing domains, re-check the catch_all status for current domain
            if (config?.defaultDomain && providerId === 'addy') {
                console.log('[ProviderCard] Re-checking catch_all status for:', config.defaultDomain);
                await checkDomainCatchAllStatus(config.defaultDomain);
            }
        } finally {
            setIsRefreshingDomains(false);
        }
    };

    const loadConfig = async () => {
        const settings = await providerService.getSettings();
        const conf = settings.providers[providerId];
        if (conf) {
            setConfig(conf);
            setToken(conf.token);
            setStatus('success');
            fetchDomains(conf.token);
        } else {
            setConfig(null);
            setToken('');
            setStatus('idle');
        }
    };

    const fetchDomains = async (apiToken: string) => {
        const domains = await providerService.getProviderDomains(providerId, apiToken);
        if (domains && domains.length > 0) {
            // No filtering needed anymore, we handle grouping in render
            setAvailableDomains(domains);

            // If default domain is not set or invalid, set it
            if (config && (!config.defaultDomain || !domains.includes(config.defaultDomain))) {
                if (domains.length > 0) {
                    updateConfig({ defaultDomain: domains[0] });
                }
            }
        }
    };

    const updateConfig = async (updates: Partial<ProviderConfig>) => {
        if (!config) return;
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        await providerService.saveProviderConfig(newConfig);
        if (onConfigChange) onConfigChange();
    };

    const handleVerify = async () => {
        setStatus('loading');
        const isValid = await providerService.verifyProviderToken(providerId, token);
        if (isValid) {
            setStatus('success');
            const newConfig: ProviderConfig = {
                id: providerId,
                enabled: true,
                token: token,
                defaultDomain: config?.defaultDomain,
                activeFormat: config?.activeFormat || 'uuid',
                customRule: config?.customRule || DEFAULT_CUSTOM_RULE
            };
            setConfig(newConfig);
            await providerService.saveProviderConfig(newConfig);
            fetchDomains(token);
            if (onConfigChange) onConfigChange();
        } else {
            setStatus('error');
        }
    };

    const handleRemove = async () => {
        await providerService.removeProviderConfig(providerId);
        setConfig(null);
        setToken('');
        setStatus('idle');
        setAvailableDomains([]);
        if (onConfigChange) onConfigChange();
    };

    const toggleSection = (section: 'domain' | 'format') => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const handleToggleFavorite = async (domain: string) => {
        if (!config) return;

        const favorites = config.favoriteDomains || [];
        const isFavorited = favorites.includes(domain);

        const updatedFavorites = isFavorited
            ? favorites.filter(d => d !== domain) // Remove from favorites
            : [...favorites, domain].slice(0, 5) // Add to favorites, keep max 5

        const newConfig = { ...config, favoriteDomains: updatedFavorites };
        setConfig(newConfig);
        await providerService.saveProviderConfig(newConfig);

        console.log('[ProviderCard] Favorites updated:', updatedFavorites);
    };

    // Helper to generate example (simplified version of SettingsPage logic)
    const getFormatExample = (format: string) => {
        const domain = config?.defaultDomain || 'example.com';
        switch (format) {
            case 'uuid': return `4fe29644...@${domain}`;
            case 'random': return `v6e02crb@${domain}`;
            case 'domain': return `google@${domain}`;
            case 'custom': return getCustomFormatPreview();
            default: return '';
        }
    };

    const getCustomFormatPreview = () => {
        const domain = config?.defaultDomain || 'example.com';
        const rule = config?.customRule || DEFAULT_CUSTOM_RULE;

        // Generate prefix based on type
        let prefix = '';
        switch (rule.prefixType) {
            case 'yyyy':
                prefix = '2024';
                break;
            case 'yyyymm':
                prefix = '202403';
                break;
            case 'yyyymmdd':
                prefix = '20240315';
                break;
            case 'yyyymmddhhmm':
                prefix = '202403151430';
                break;
            case 'random':
                prefix = '7x2kpn';
                break;
            case 'uuid':
                prefix = 'a3f2d1c4';
                break;
            case 'text':
                prefix = rule.prefixText || '';
                break;
            case 'none':
            default:
                prefix = '';
        }

        // Generate suffix based on type
        let suffix = '';
        switch (rule.suffixType) {
            case 'yyyy':
                suffix = '2024';
                break;
            case 'yyyymm':
                suffix = '202403';
                break;
            case 'yyyymmdd':
                suffix = '20240315';
                break;
            case 'yyyymmddhhmm':
                suffix = '202403151430';
                break;
            case 'random':
                suffix = '4qrd7q';
                break;
            case 'uuid':
                suffix = 'b7e8c2a1';
                break;
            case 'text':
                suffix = rule.suffixText || '';
                break;
            case 'none':
            default:
                suffix = '';
        }

        // Combine with separator and add example website name
        const separator = (rule.separator && providerId !== 'simplelogin') ? '-' : '';
        const websiteExample = 'netflix'; // Example website name for preview

        let combined = '';
        if (prefix && suffix) {
            // Both prefix and suffix: prefix-website-suffix
            combined = separator
                ? `${prefix}${separator}${websiteExample}${separator}${suffix}`
                : `${prefix}${websiteExample}${suffix}`;
        } else if (prefix) {
            // Only prefix: prefix-website
            combined = separator
                ? `${prefix}${separator}${websiteExample}`
                : `${prefix}${websiteExample}`;
        } else if (suffix) {
            // Only suffix: website-suffix
            combined = separator
                ? `${websiteExample}${separator}${suffix}`
                : `${websiteExample}${suffix}`;
        } else {
            // No prefix or suffix
            combined = websiteExample;
        }

        return `${combined}@${domain}`;
    };

    const handleCustomRuleChange = async (newRule: Partial<CustomRule>) => {
        if (!config) return;
        const currentRule = config.customRule || DEFAULT_CUSTOM_RULE;
        const updatedRule = { ...currentRule, ...newRule };
        const newConfig = { ...config, customRule: updatedRule };
        setConfig(newConfig);
        await providerService.saveProviderConfig(newConfig);
        onConfigChange?.();
    };

    if (!provider) return null;

    return (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardContent className="p-0">
                {status === 'success' && config ? (
                    <div className="divide-y divide-slate-800">
                        {/* Header / Status */}
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                    <Key className="w-5 h-5 text-blue-500" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-slate-200 truncate">
                                        {provider.name} ••••••••{token.slice(-4)}
                                    </div>
                                    <div className="text-xs text-green-500 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Connected
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleRemove}
                                className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                            >
                                Remove
                            </Button>
                        </div>

                        {/* Default Domain */}
                        <div className="flex flex-col">
                            <div className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left group">
                                <button
                                    onClick={() => toggleSection('domain')}
                                    className="flex-1 flex items-center justify-between"
                                >
                                    <span className="text-sm font-medium text-slate-200">Default Domain</span>
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <span className="text-sm">{config.defaultDomain || 'Select...'}</span>
                                        <ChevronDown className={cn("w-4 h-4 transition-transform", expandedSection === 'domain' && "rotate-180")} />
                                    </div>
                                </button>
                                <button
                                    onClick={handleRefreshDomains}
                                    disabled={isRefreshingDomains}
                                    className={cn(
                                        "ml-2 p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors",
                                        isRefreshingDomains && "opacity-50 cursor-not-allowed"
                                    )}
                                    title="Refresh domains and catch-all settings"
                                >
                                    <RefreshCw className={cn("w-4 h-4", isRefreshingDomains && "animate-spin")} />
                                </button>
                            </div>
                            {expandedSection === 'domain' && (
                                <div className="bg-slate-950/50 border-t border-slate-800/50 max-h-96 overflow-y-auto custom-scrollbar">
                                    {isRefreshingDomains ? (
                                        <div className="p-4 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Loading domains...
                                        </div>
                                    ) : (
                                        <>
                                            {(() => {
                                                // Group domains and show favorites first
                                                const grouped = groupDomainsByRoot(availableDomains, config?.favoriteDomains);
                                                const favorites = grouped.favorites.length > 0 ? grouped.favorites : [];
                                                const favoritesSet = new Set(favorites);

                                                const handleStarClick = (e: React.MouseEvent, domain: string) => {
                                                    e.stopPropagation();

                                                    if (!isPro) {
                                                        alert('Manage Favorite Domains is a Pro feature. Please upgrade to Pro to unlock this functionality.');
                                                        return;
                                                    }

                                                    handleToggleFavorite(domain);
                                                };

                                                return (
                                                    <>
                                                        {/* Favorites Section */}
                                                        {favorites.length > 0 && (
                                                            <>
                                                                <div className="px-4 py-2 text-xs font-bold text-amber-400 bg-slate-900/95 sticky top-0 backdrop-blur-sm z-10">
                                                                    ⭐ Favorites
                                                                </div>
                                                                {favorites.map((domain) => (
                                                                    <button
                                                                        key={domain}
                                                                        onClick={() => {
                                                                            updateConfig({ defaultDomain: domain });
                                                                            setExpandedSection(null);
                                                                        }}
                                                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-500/10 transition-colors text-left group border-b border-slate-800/30 last:border-0"
                                                                    >
                                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                            <button
                                                                                onClick={(e) => handleStarClick(e, domain)}
                                                                                className="flex-shrink-0 p-1.5 text-amber-400 hover:text-amber-300 transition-colors"
                                                                                title="Remove from favorites"
                                                                            >
                                                                                <Star className="w-4 h-4 fill-current" />
                                                                            </button>
                                                                            <span className={cn("text-sm truncate", config.defaultDomain === domain ? "text-blue-400 font-medium" : "text-slate-300")}>
                                                                                {domain}
                                                                            </span>
                                                                        </div>
                                                                        {config.defaultDomain === domain && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                                                                    </button>
                                                                ))}
                                                            </>
                                                        )}

                                                        {/* Grouped by Root Domain (excluding favorites) */}
                                                        {grouped.groups.map(group => (
                                                            <div key={group.label}>
                                                                <div className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-900/95 sticky top-0 backdrop-blur-sm z-10 border-t border-slate-800/50">
                                                                    {group.label}
                                                                </div>
                                                                {group.domains.map((domain) => (
                                                                    !favoritesSet.has(domain) && (
                                                                        <button
                                                                            key={domain}
                                                                            onClick={() => {
                                                                                updateConfig({ defaultDomain: domain });
                                                                                setExpandedSection(null);
                                                                            }}
                                                                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-500/10 transition-colors text-left group border-b border-slate-800/30 last:border-0"
                                                                        >
                                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                                <button
                                                                                    onClick={(e) => handleStarClick(e, domain)}
                                                                                    className={cn(
                                                                                        "flex-shrink-0 p-1.5 transition-colors",
                                                                                        isPro
                                                                                            ? "text-slate-500 hover:text-amber-400"
                                                                                            : "text-slate-600 hover:text-slate-500 cursor-help"
                                                                                    )}
                                                                                    title={isPro ? "Add to favorites" : "Pro feature: Click to see details"}
                                                                                >
                                                                                    <Star className="w-4 h-4" />
                                                                                </button>
                                                                                <span className={cn("text-sm truncate", config.defaultDomain === domain ? "text-blue-400 font-medium" : "text-slate-300")}>
                                                                                    {domain}
                                                                                </span>
                                                                            </div>
                                                                            {config.defaultDomain === domain && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                                                                        </button>
                                                                    )
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </>
                                                )
                                            })()}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Domain Status Info */}
                        {providerId === 'addy' && (
                            <div className="px-4 py-4 border-t border-slate-800 space-y-2">
                                {catchAllStatus === 'disabled' && (
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-2">
                                        <div className="flex items-start gap-2.5">
                                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-blue-300 mb-1">Server Generation Mode</p>
                                                <p className="text-xs text-blue-200/80 leading-relaxed">
                                                    This domain doesn't support custom formats. The server will generate a random alias when you click "Copy & Fill".
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {catchAllStatus === 'enabled' && (
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                                        <div className="flex items-start gap-2.5">
                                            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Check className="w-3 h-3 text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-300 mb-1">Local Generation Mode</p>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    This domain supports all alias formats. You can choose your preferred format above.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {!catchAllStatus && (
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                                        <p className="text-xs text-slate-400 flex items-center gap-2">
                                            <div className="w-2 h-2 border border-slate-500 rounded-full animate-pulse"></div>
                                            Checking domain capabilities...
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SimpleLogin Note */}
                        {providerId === 'simplelogin' && (
                            <div className="px-4 py-4 border-t border-slate-800">
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 space-y-2">
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-blue-300 mb-1">Server Generation Required</p>
                                            <p className="text-xs text-blue-200/80 leading-relaxed">
                                                SimpleLogin requires server-side generation. Custom formats will be generated when you click "Copy & Fill".
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Alias Format */}
                        {!(providerId === 'addy' && catchAllStatus === 'disabled') && (
                            <div className="px-4 py-4 border-t border-slate-800">
                                <h3 className="text-sm font-semibold text-slate-200 mb-3">Alias Format</h3>
                                <div className="space-y-2.5">
                                    {[
                                        { id: 'uuid', label: 'UUID', icon: Fingerprint },
                                        { id: 'random', label: 'Random Words', icon: Shuffle },
                                        { id: 'domain', label: 'Domain Name', isPro: true, icon: Globe },
                                        { id: 'custom', label: 'Custom Domain Name', isPro: true, icon: PenTool },
                                    ].map((format) => {
                                        const isSelected = config.activeFormat === format.id;
                                        const isLocked = format.isPro && !isPro;

                                        return (
                                            <div key={format.id}>
                                                <button
                                                    onClick={() => {
                                                        if (isLocked) {
                                                            if (format.id === 'custom') setPreviewCustomSettings(!previewCustomSettings);
                                                            return;
                                                        }
                                                        updateConfig({ activeFormat: format.id });
                                                    }}
                                                    className={cn(
                                                        "w-full px-3 py-3 rounded-lg border transition-all",
                                                        isSelected
                                                            ? "bg-blue-500/15 border-blue-500/40 shadow-sm shadow-blue-500/10"
                                                            : isLocked
                                                                ? "bg-slate-900/40 border-slate-700/50 cursor-not-allowed"
                                                                : "bg-slate-900/60 border-slate-700 hover:bg-slate-900/80 hover:border-slate-600"
                                                    )}
                                                    disabled={isLocked && format.id !== 'custom'}
                                                >
                                                    <div className="flex items-start gap-3 justify-between">
                                                        <div className="flex items-start gap-3 flex-1">
                                                            <div className={cn(
                                                                "mt-0.5 p-1.5 rounded-md flex-shrink-0",
                                                                isSelected ? "bg-blue-500/30 text-blue-400" : isLocked ? "bg-slate-700 text-slate-500" : "bg-slate-800 text-slate-400"
                                                            )}>
                                                                <format.icon className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex flex-col gap-0.5 text-left min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={cn(
                                                                        "text-sm font-medium",
                                                                        isSelected ? "text-blue-300" : isLocked ? "text-slate-500" : "text-slate-200"
                                                                    )}>
                                                                        {format.label}
                                                                    </span>
                                                                    {isLocked && (
                                                                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] px-1 py-0 h-4">PRO</Badge>
                                                                    )}
                                                                </div>
                                                                <span className={cn(
                                                                    "text-xs font-mono truncate",
                                                                    isSelected ? "text-blue-200/80" : isLocked ? "text-slate-600" : "text-slate-400"
                                                                )}>
                                                                    e.g. {getFormatExample(format.id)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {isSelected && (
                                                            <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                                        )}
                                                    </div>
                                                </button>

                                                {/* Custom Rule Config - shown when selected */}
                                                {format.id === 'custom' && (isSelected || (previewCustomSettings && isLocked)) && (
                                                    <div className="mt-2 px-3 py-3 bg-slate-900/70 border border-slate-700 rounded-lg space-y-3">
                                                        <div className="grid grid-cols-2 gap-2.5">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs text-slate-400">Prefix</Label>
                                                                <select
                                                                    className="w-full h-8 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    value={config.customRule?.prefixType || 'none'}
                                                                    onChange={(e) => handleCustomRuleChange({ prefixType: e.target.value })}
                                                                    disabled={!isPro}
                                                                >
                                                                    {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                                </select>
                                                                {config.customRule?.prefixType === 'text' && (
                                                                    <Input
                                                                        className="h-8 text-xs bg-slate-950 border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        placeholder="Max 10 chars"
                                                                        maxLength={10}
                                                                        value={config.customRule?.prefixText || ''}
                                                                        onChange={(e) => handleCustomRuleChange({ prefixText: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                                                                        disabled={!isPro}
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs text-slate-400">Suffix</Label>
                                                                <select
                                                                    className="w-full h-8 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    value={config.customRule?.suffixType || 'none'}
                                                                    onChange={(e) => handleCustomRuleChange({ suffixType: e.target.value })}
                                                                    disabled={!isPro}
                                                                >
                                                                    {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                                </select>
                                                                {config.customRule?.suffixType === 'text' && (
                                                                    <Input
                                                                        className="h-8 text-xs bg-slate-950 border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        placeholder="Max 10 chars"
                                                                        maxLength={10}
                                                                        value={config.customRule?.suffixText || ''}
                                                                        onChange={(e) => handleCustomRuleChange({ suffixText: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                                                                        disabled={!isPro}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                        {providerId !== 'simplelogin' && (
                                                            <div className="flex items-center gap-2 pt-1 border-t border-slate-700/50">
                                                                <Checkbox
                                                                    id={`separator-${providerId}`}
                                                                    checked={config.customRule?.separator !== false}
                                                                    onCheckedChange={(checked) => handleCustomRuleChange({ separator: !!checked })}
                                                                    className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    disabled={!isPro}
                                                                />
                                                                <Label htmlFor={`separator-${providerId}`} className="text-xs text-slate-300">Use separator (-)</Label>
                                                            </div>
                                                        )}
                                                        <div className="pt-2 border-t border-slate-700/50">
                                                            <div className="text-xs text-slate-400 mb-1.5">Preview</div>
                                                            <div className="text-sm font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-700">
                                                                {getCustomFormatPreview()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor={`token-${providerId}`} className="text-slate-300">{provider.name} API Token</Label>
                            <div className="relative">
                                <Input
                                    id={`token-${providerId}`}
                                    type={showToken ? "text" : "password"}
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    placeholder="Paste your token here"
                                    className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowToken(!showToken)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {providerId === 'addy' && (
                                <a href="https://app.addy.io/settings/api" target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:text-blue-400 hover:underline inline-block">
                                    Log in to Addy.io and create a new API key
                                </a>
                            )}
                            {providerId === 'simplelogin' && (
                                <a href="https://app.simplelogin.io/dashboard/api_key" target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:text-blue-400 hover:underline inline-block">
                                    Log in to SimpleLogin and create a new API key
                                </a>
                            )}
                        </div>
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                            onClick={handleVerify}
                            disabled={status === 'loading' || !token}
                        >
                            {status === 'loading' ? 'Verifying...' : 'Connect'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card >
    );
}
