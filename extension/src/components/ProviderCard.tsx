import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Eye, EyeOff, Check, ChevronDown, Fingerprint, Shuffle, Globe, PenTool, Key, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { providerService } from '../services/providers/provider.service';
import { providerRegistry } from '../services/providers/registry';
import type { ProviderConfig, CustomRule } from '../services/providers/types';
import { SHARED_DOMAINS, getDomainDetails as fetchDomainDetails } from '../services/addy';

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
    const [isWaitServerConfirmationDisabled, setIsWaitServerConfirmationDisabled] = useState(false);
    const [isRefreshingDomains, setIsRefreshingDomains] = useState(false);

    useEffect(() => {
        loadConfig();
    }, [providerId]);

    // Monitor default domain changes and check catch_all status for Addy
    useEffect(() => {
        if (providerId === 'simplelogin') {
            // SimpleLogin always requires server confirmation
            setIsWaitServerConfirmationDisabled(true);
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
                const shouldDisable = !details.catch_all;
                console.log('[ProviderCard] Setting isWaitServerConfirmationDisabled to:', shouldDisable);
                // If catch_all is false, disable the checkbox and force save waitServerConfirmation: true
                setIsWaitServerConfirmationDisabled(shouldDisable);
                if (shouldDisable) {
                    console.log('[ProviderCard] Auto-saving waitServerConfirmation: true due to catch_all=false');
                    await updateConfig({ waitServerConfirmation: true });
                } else {
                    console.log('[ProviderCard] Auto-saving waitServerConfirmation: false (domain has catch_all=true)');
                    await updateConfig({ waitServerConfirmation: false });
                }
            } else {
                console.log('[ProviderCard] No details returned for domain:', domain);
                setIsWaitServerConfirmationDisabled(false);
            }
        } catch (error) {
            console.error('[ProviderCard] Error checking catch_all status:', error);
            setIsWaitServerConfirmationDisabled(false);
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

    const getFormatLabel = (format: string) => {
        switch (format) {
            case 'uuid': return 'UUID';
            case 'random': return 'Random Words';
            case 'domain': return 'Domain Name';
            case 'custom': return 'Custom Domain Name';
            default: return format;
        }
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
                prefix = 'clever_mountain';
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
                suffix = 'quiet_river';
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
                                <div className="bg-slate-950/50 border-t border-slate-800/50 max-h-60 overflow-y-auto custom-scrollbar">
                                    {providerId === 'addy' ? (
                                        <>
                                            {/* Recommended Group */}
                                            <div className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-900/95 sticky top-0 backdrop-blur-sm z-10">
                                                Recommended
                                            </div>
                                            {availableDomains.filter(d => !SHARED_DOMAINS.includes(d)).map((domain) => (
                                                <button
                                                    key={domain}
                                                    onClick={() => {
                                                        updateConfig({ defaultDomain: domain });
                                                        setExpandedSection(null);
                                                    }}
                                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-500/10 transition-colors text-left group border-b border-slate-800/30 last:border-0"
                                                >
                                                    <span className={cn("text-sm", config.defaultDomain === domain ? "text-blue-400 font-medium" : "text-slate-300")}>
                                                        {domain}
                                                    </span>
                                                    {config.defaultDomain === domain && <Check className="w-4 h-4 text-blue-500" />}
                                                </button>
                                            ))}

                                            {/* Optional Group */}
                                            <div className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-900/95 sticky top-0 backdrop-blur-sm z-10 border-t border-slate-800/50">
                                                Optional
                                            </div>
                                            {availableDomains.filter(d => SHARED_DOMAINS.includes(d)).map((domain) => (
                                                <button
                                                    key={domain}
                                                    onClick={() => {
                                                        updateConfig({ defaultDomain: domain });
                                                        setExpandedSection(null);
                                                    }}
                                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-500/10 transition-colors text-left group border-b border-slate-800/30 last:border-0"
                                                >
                                                    <span className={cn("text-sm", config.defaultDomain === domain ? "text-blue-400 font-medium" : "text-slate-300")}>
                                                        {domain}
                                                    </span>
                                                    {config.defaultDomain === domain && <Check className="w-4 h-4 text-blue-500" />}
                                                </button>
                                            ))}
                                        </>
                                    ) : (
                                        availableDomains.map((domain) => (
                                            <button
                                                key={domain}
                                                onClick={() => {
                                                    updateConfig({ defaultDomain: domain });
                                                    setExpandedSection(null);
                                                }}
                                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-500/10 transition-colors text-left group border-b border-slate-800/30 last:border-0"
                                            >
                                                <span className={cn("text-sm", config.defaultDomain === domain ? "text-blue-400 font-medium" : "text-slate-300")}>
                                                    {domain}
                                                </span>
                                                {config.defaultDomain === domain && <Check className="w-4 h-4 text-blue-500" />}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Wait for Server Confirmation Option */}
                        <div className={cn("px-4 py-4 space-y-2 border-t border-slate-800", isWaitServerConfirmationDisabled && "opacity-75 bg-slate-950/30")}>
                            <div className="flex items-start gap-3">
                                <div className="relative mt-1">
                                    <Checkbox
                                        id={`wait-confirm-${providerId}`}
                                        checked={isWaitServerConfirmationDisabled ? true : (config.waitServerConfirmation === true)}
                                        onCheckedChange={(checked) => {
                                            if (!isWaitServerConfirmationDisabled) {
                                                updateConfig({ waitServerConfirmation: !!checked });
                                            }
                                        }}
                                        disabled={isWaitServerConfirmationDisabled}
                                        className={cn(
                                            "border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600",
                                            isWaitServerConfirmationDisabled && "cursor-not-allowed opacity-50"
                                        )}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <Label
                                        htmlFor={`wait-confirm-${providerId}`}
                                        className={cn(
                                            "text-sm font-medium cursor-pointer inline-flex items-center gap-2",
                                            isWaitServerConfirmationDisabled ? "text-slate-400" : "text-slate-200"
                                        )}
                                    >
                                        Wait for server confirmation before applying email
                                        {isWaitServerConfirmationDisabled && (
                                            <span className="text-xs text-slate-500">(locked)</span>
                                        )}
                                    </Label>
                                    <div className="mt-2 space-y-2 text-xs text-slate-400">
                                        {providerId === 'addy' ? (
                                            <>
                                                <p>
                                                    <span className="text-slate-300">If unchecked (recommended):</span> The email will be created on the server and can be quickly generated and applied. Addy will create the email in the list after actually receiving the mail.
                                                </p>
                                                <p>
                                                    <span className="text-slate-300">If checked:</span> The email will be created in the Addy list at the same time it is generated.
                                                </p>
                                                {isWaitServerConfirmationDisabled && (
                                                    <p>
                                                        <span className="text-amber-400">⚠️ This option is locked:</span> The selected domain has the catch-all feature disabled, so the server confirmation is required.
                                                    </p>
                                                )}
                                                {!isWaitServerConfirmationDisabled && (
                                                    <p>
                                                        <span className="text-slate-300">Note:</span> If you disable the catch-all feature in Addy or create a Shared Domain Alias, this option will be automatically locked to enabled.
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p>
                                                <span className="text-slate-300">Note:</span> Due to SimpleLogin's mechanism, this option is always enabled and cannot be disabled.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Alias Format */}
                        <div className="flex flex-col">
                            <button
                                onClick={() => toggleSection('format')}
                                className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
                            >
                                <span className="text-sm font-medium text-slate-200">Alias Format</span>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <span className="text-sm">{getFormatLabel(config.activeFormat || 'uuid')}</span>
                                    <ChevronDown className={cn("w-4 h-4 transition-transform", expandedSection === 'format' && "rotate-180")} />
                                </div>
                            </button>
                            {expandedSection === 'format' && (
                                <div className="bg-slate-950/50 border-t border-slate-800/50">
                                    {[
                                        { id: 'uuid', label: 'UUID', icon: Fingerprint },
                                        { id: 'random', label: 'Random Words', icon: Shuffle },
                                        { id: 'domain', label: 'Domain Name', isPro: true, icon: Globe },
                                        { id: 'custom', label: 'Custom Domain Name', isPro: true, icon: PenTool },
                                    ].map((format) => (
                                        <div key={format.id}>
                                            <button
                                                onClick={() => {
                                                    if (format.isPro && !isPro) {
                                                        if (format.id === 'custom') setPreviewCustomSettings(!previewCustomSettings);
                                                        return;
                                                    }
                                                    updateConfig({ activeFormat: format.id });
                                                    if (format.id !== 'custom') setExpandedSection(null);
                                                }}
                                                className={cn(
                                                    "w-full px-4 py-3 flex items-center justify-between transition-colors text-left group",
                                                    config.activeFormat === format.id ? "bg-blue-500/10" : "hover:bg-slate-800/30",
                                                    format.isPro && !isPro && format.id !== 'custom' && "opacity-50 cursor-not-allowed"
                                                )}
                                                disabled={format.isPro && !isPro && format.id !== 'custom'}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "mt-0.5 p-1.5 rounded-md",
                                                        config.activeFormat === format.id ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-400 group-hover:text-slate-300"
                                                    )}>
                                                        <format.icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("text-sm font-medium", config.activeFormat === format.id ? "text-blue-400" : "text-slate-200")}>
                                                                {format.label}
                                                            </span>
                                                            {format.isPro && (
                                                                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] px-1 py-0 h-4">PRO</Badge>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-slate-500 font-mono">
                                                            e.g. <span className="text-slate-300">{getFormatExample(format.id)}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                {config.activeFormat === format.id && <Check className="w-4 h-4 text-blue-500" />}
                                            </button>

                                            {/* Custom Rule Config */}
                                            {format.id === 'custom' && (config.activeFormat === 'custom' || (previewCustomSettings && !isPro)) && (
                                                <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800/50 space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-slate-400">Prefix (Before)</Label>
                                                            <select
                                                                className="w-full h-8 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                value={config.customRule?.prefixType || 'none'}
                                                                onChange={(e) => handleCustomRuleChange({ prefixType: e.target.value })}
                                                                disabled={!isPro}
                                                            >
                                                                {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                            </select>
                                                            {config.customRule?.prefixType === 'text' && (
                                                                <Input
                                                                    className="h-8 text-xs bg-slate-900 border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    placeholder="Max 10 chars"
                                                                    maxLength={10}
                                                                    value={config.customRule?.prefixText || ''}
                                                                    onChange={(e) => handleCustomRuleChange({ prefixText: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                                                                    disabled={!isPro}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-slate-400">Suffix (After)</Label>
                                                            <select
                                                                className="w-full h-8 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                value={config.customRule?.suffixType || 'none'}
                                                                onChange={(e) => handleCustomRuleChange({ suffixType: e.target.value })}
                                                                disabled={!isPro}
                                                            >
                                                                {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                            </select>
                                                            {config.customRule?.suffixType === 'text' && (
                                                                <Input
                                                                    className="h-8 text-xs bg-slate-900 border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    placeholder="Max 10 chars"
                                                                    maxLength={10}
                                                                    value={config.customRule?.suffixText || ''}
                                                                    onChange={(e) => handleCustomRuleChange({ suffixText: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                                                                    disabled={!isPro}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Hide separator option for SimpleLogin as it doesn't support hyphens in alias_prefix */}
                                                    {providerId !== 'simplelogin' && (
                                                        <div className="flex items-center gap-2 pt-1">
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
                                                </div>
                                            )}

                                            {/* Preview for Custom format */}
                                            {format.id === 'custom' && config.activeFormat === 'custom' && (
                                                <div className="mt-4 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                                    <div className="text-xs text-slate-400 mb-1">Preview</div>
                                                    <div className="text-sm font-mono text-slate-300">
                                                        {getCustomFormatPreview()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
