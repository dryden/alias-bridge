import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent } from './components/ui/card'
import { Label } from './components/ui/label'
import { Badge } from './components/ui/badge'
import { Checkbox } from './components/ui/checkbox'
import { verifyToken, getDomains } from './services/addy'
import { verifyLicense } from './services/license'
import {
    Key,
    ExternalLink, Eye, EyeOff, Check, ChevronDown,
    Fingerprint, Shuffle, Globe, PenTool
} from 'lucide-react'
import { cn } from './lib/utils'
import confetti from 'canvas-confetti'


interface CustomRule {
    prefixType: string;
    prefixText: string;
    suffixType: string;
    suffixText: string;
    separator: boolean;
}

const DEFAULT_CUSTOM_RULE: CustomRule = {
    prefixType: 'none',
    prefixText: '',
    suffixType: 'none',
    suffixText: '',
    separator: true
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
]

function SettingsPage() {
    // Global State
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [token, setToken] = useState('')
    const [showToken, setShowToken] = useState(false)
    const [userData, setUserData] = useState<any>(null)

    // Settings State
    const [defaultDomain, setDefaultDomain] = useState('addy.io')
    const [defaultFormat, setDefaultFormat] = useState('uuid')

    // Custom Rule State
    const [customRule, setCustomRule] = useState<CustomRule>(DEFAULT_CUSTOM_RULE)
    const [previewCustomSettings, setPreviewCustomSettings] = useState(false)

    // Data
    const [availableDomains, setAvailableDomains] = useState<string[]>(['addy.io', 'anonaddy.com', 'anonaddy.me'])

    // UI State
    const [expandedSection, setExpandedSection] = useState<'domain' | 'format' | null>(null)

    // License State
    const [isPro, setIsPro] = useState(false)
    const [licenseKey, setLicenseKey] = useState('')
    const [licenseStatus, setLicenseStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle')
    const [licenseError, setLicenseError] = useState<string>('')



    useEffect(() => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['addyToken', 'userData', 'licenseKey', 'isPro', 'autoCopy', 'defaultDomain', 'defaultFormat', 'customRule'], (result) => {
                if (result.addyToken) {
                    setToken(result.addyToken as string)
                    setStatus('success')
                    if (result.userData) setUserData(result.userData)

                    // Fetch domains if we have a token
                    fetchDomains(result.addyToken as string)
                }

                if (result.licenseKey) {
                    setLicenseKey(result.licenseKey as string)
                    setIsPro(!!result.isPro)
                    if (result.isPro) setLicenseStatus('valid')
                }

                if (result.defaultDomain) {
                    setDefaultDomain(result.defaultDomain as string)
                }

                if (result.defaultFormat) {
                    setDefaultFormat(result.defaultFormat as string)
                }

                if (result.customRule) {
                    setCustomRule(result.customRule as CustomRule)
                }
            })
        } else {
            // Dev mode
            const saved = localStorage.getItem('addyToken')
            if (saved) {
                setToken(saved)
                setStatus('success')
                setUserData({ username: 'dev_user' })
                fetchDomains(saved)
            }

            const savedLicense = localStorage.getItem('licenseKey')
            if (savedLicense) {
                setLicenseKey(savedLicense)
                setIsPro(localStorage.getItem('isPro') === 'true')
                if (localStorage.getItem('isPro') === 'true') setLicenseStatus('valid')
            }
        }
    }, [])

    const fetchDomains = async (apiToken: string) => {
        const domains = await getDomains(apiToken)
        if (domains && domains.length > 0) {
            // Filter out 'anonaddy.com' and 'addy.io'
            const filtered = domains.filter((d: string) => d !== 'anonaddy.com' && d !== 'addy.io')
            setAvailableDomains(filtered)

            // If current defaultDomain is 'addy.io' or not in list, set to first available
            if (filtered.length > 0 && (defaultDomain === 'addy.io' || !filtered.includes(defaultDomain))) {
                handleDefaultDomainChange(filtered[0])
            }
        }
    }

    // Save settings when changed
    const handleDefaultDomainChange = (domain: string) => {
        setDefaultDomain(domain)
        setExpandedSection(null) // Close after selection
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ defaultDomain: domain })
        }
    }

    const handleDefaultFormatChange = (format: string) => {
        if ((format === 'domain' || format === 'custom') && !isPro) return;

        setDefaultFormat(format)
        // Don't close if custom is selected, so user can see config
        if (format !== 'custom') {
            setExpandedSection(null)
        }
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ defaultFormat: format })
        }
    }

    const handleCustomRuleChange = (newRule: Partial<CustomRule>) => {
        const updated = { ...customRule, ...newRule }
        setCustomRule(updated)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ customRule: updated })
        }
    }

    const handleVerify = async () => {
        setStatus('loading')
        try {
            const data = await verifyToken(token)
            setUserData(data)
            setStatus('success')
            fetchDomains(token)
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ addyToken: token, userData: data })
            } else {
                localStorage.setItem('addyToken', token)
            }
        } catch (error) {
            console.error(error)
            setStatus('error')
        }
    }

    const handleRemoveToken = () => {
        setToken('')
        setStatus('idle')
        setUserData(null)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(['addyToken', 'userData'])
        } else {
            localStorage.removeItem('addyToken')
        }
    }

    const handleLicenseVerify = async () => {
        setLicenseStatus('verifying')
        const result = await verifyLicense(licenseKey)

        if (result.valid) {
            setLicenseStatus('valid')
            setIsPro(true)

            // Trigger confetti
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ licenseKey, isPro: true })
            } else {
                localStorage.setItem('licenseKey', licenseKey)
                localStorage.setItem('isPro', 'true')
            }
        } else {
            setLicenseStatus('invalid')
            setLicenseError(result.error || 'Invalid license key')
            setIsPro(false)
        }
    }

    const toggleSection = (section: 'domain' | 'format') => {
        if (expandedSection === section) {
            setExpandedSection(null)
        } else {
            setExpandedSection(section)
        }
    }

    const getFormatLabel = (format: string) => {
        switch (format) {
            case 'uuid': return 'UUID';
            case 'random': return 'Random Words';
            case 'domain': return 'Domain Name';
            case 'custom': return 'Custom Domain Name';
            default: return format;
        }
    }

    const getFormatExample = (format: string) => {

        const domain = defaultDomain;

        switch (format) {
            case 'uuid': return `4fe29644-cb30-4d94...@${domain}`;
            case 'random': return `v6e02crb@${domain}`;
            case 'domain': return `google@${domain}`;
            case 'custom': {
                // Construct custom example
                // Hardcoded example for better visual as requested: google-20261231@009.addy.io
                // But we should respect the dynamic parts if possible, or just force the requested example.
                // The user asked for: google-20261231@009.addy.io
                // Let's try to make it dynamic but look similar to request if custom rule matches.
                // Actually, the user request is specific about the example text.

                const now = new Date();
                const pad = (n: number) => n.toString().padStart(2, '0');
                const yyyy = now.getFullYear();
                const mm = pad(now.getMonth() + 1);
                const dd = pad(now.getDate());
                const hh = pad(now.getHours());
                const min = pad(now.getMinutes());

                const getPart = (type: string, text: string) => {
                    const sep = customRule.separator ? '-' : '';
                    switch (type) {
                        case 'none': return '';
                        case 'yyyy': return `${yyyy}${sep}`;
                        case 'yyyymm': return `${yyyy}${mm}${sep}`;
                        case 'yyyymmdd': return `${yyyy}${mm}${dd}${sep}`;
                        case 'yyyymmddhhmm': return `${yyyy}${mm}${dd}${hh}${min}${sep}`;
                        case 'random': return `v6e02crb${sep}`;
                        case 'uuid': return `4fe29644-cb30-4d94-8967-1b185402dfa4${sep}`;
                        case 'text': return text ? `${text}${sep}` : '';
                        default: return '';
                    }
                }

                const getSuffixPart = (type: string, text: string) => {
                    const sep = customRule.separator ? '-' : '';
                    switch (type) {
                        case 'none': return '';
                        case 'yyyy': return `${sep}${yyyy}`;
                        case 'yyyymm': return `${sep}${yyyy}${mm}`;
                        case 'yyyymmdd': return `${sep}${yyyy}${mm}${dd}`;
                        case 'yyyymmddhhmm': return `${sep}${yyyy}${mm}${dd}${hh}${min}`;
                        case 'random': return `${sep}v6e02crb`;
                        case 'uuid': return `${sep}4fe29644-cb30-4d94-8967-1b185402dfa4`;
                        case 'text': return text ? `${sep}${text}` : '';
                        default: return '';
                    }
                }

                const prefix = getPart(customRule.prefixType, customRule.prefixText);
                const suffix = getSuffixPart(customRule.suffixType, customRule.suffixText);

                return `${prefix}google${suffix}@${domain}`;
            }
            default: return '';
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
            {/* Navbar */}
            <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">

                    <div className="flex items-center gap-2">
                        <img src="icon.ico" className="w-5 h-5" alt="Logo" />
                        <h1 className="text-base font-semibold">Settings</h1>
                    </div>
                    <Button variant="ghost" className="text-blue-500 hover:text-blue-400 font-medium" onClick={() => window.close()}>
                        Done
                    </Button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 space-y-8 pb-20">

                {/* Addy.io Configuration */}
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-400 px-1">Addy.io Configuration</h2>
                    <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                        <CardContent className="p-0">
                            {status === 'success' ? (
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                            <Key className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-slate-200 truncate">
                                                API Key: •••••••• {token.slice(-4)}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                Connected as {userData?.username}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleRemoveToken}
                                        className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-4 space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="token" className="text-slate-300">Addy.io Access Token</Label>
                                        <div className="relative">
                                            <Input
                                                id="token"
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
                                        <a href="https://app.addy.io/settings/api" target="_blank" className="text-xs text-blue-500 hover:text-blue-400 hover:underline inline-block">
                                            Log in to Addy.io and create a new API key
                                        </a>
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
                    </Card>
                </section>

                {/* General */}
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-400 px-1">General</h2>
                    <Card className="bg-slate-900 border-slate-800 overflow-hidden divide-y divide-slate-800">


                        {/* Default Alias Domain */}
                        <div className="flex flex-col">
                            <button
                                onClick={() => toggleSection('domain')}
                                className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
                            >
                                <span className="text-sm font-medium text-slate-200">Default Alias Domain</span>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <span className="text-sm">{defaultDomain}</span>
                                    {expandedSection === 'domain' ? <ChevronDown className="w-4 h-4 rotate-180 transition-transform" /> : <ChevronDown className="w-4 h-4 transition-transform" />}
                                </div>
                            </button>

                            {expandedSection === 'domain' && (
                                <div className="bg-slate-950/50 border-t border-slate-800/50 max-h-60 overflow-y-auto custom-scrollbar">
                                    {availableDomains.map((domain) => (
                                        <button
                                            key={domain}
                                            onClick={() => handleDefaultDomainChange(domain)}
                                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-500/10 transition-colors text-left group border-b border-slate-800/30 last:border-0"
                                        >
                                            <span className={cn("text-sm", defaultDomain === domain ? "text-blue-400 font-medium" : "text-slate-300")}>
                                                {domain}
                                            </span>
                                            {defaultDomain === domain && <Check className="w-4 h-4 text-blue-500" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Alias Format Rules */}
                        <div className="flex flex-col">
                            <button
                                onClick={() => toggleSection('format')}
                                className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
                            >
                                <span className="text-sm font-medium text-slate-200">Alias Format Rules</span>
                                <div className="flex items-center gap-2 text-slate-500">
                                    <span className="text-sm">{getFormatLabel(defaultFormat)}</span>
                                    {expandedSection === 'format' ? <ChevronDown className="w-4 h-4 rotate-180 transition-transform" /> : <ChevronDown className="w-4 h-4 transition-transform" />}
                                </div>
                            </button>

                            {expandedSection === 'format' && (
                                <div className="bg-slate-950/50 border-t border-slate-800/50">
                                    {[
                                        { id: 'uuid', label: 'UUID', example: getFormatExample('uuid'), icon: Fingerprint },
                                        { id: 'random', label: 'Random Words', example: getFormatExample('random'), icon: Shuffle },
                                        { id: 'domain', label: 'Domain Name', example: getFormatExample('domain'), isPro: true, icon: Globe },
                                        { id: 'custom', label: 'Custom Domain Name', example: getFormatExample('custom'), isPro: true, icon: PenTool },
                                    ].map((format) => (
                                        <div key={format.id}>
                                            <button
                                                onClick={() => {
                                                    if (format.isPro && !isPro) {
                                                        if (format.id === 'custom') {
                                                            setPreviewCustomSettings(!previewCustomSettings)
                                                        }
                                                    } else {
                                                        handleDefaultFormatChange(format.id)
                                                    }
                                                }}
                                                className={cn(
                                                    "w-full px-4 py-3 flex items-center justify-between transition-colors text-left group",
                                                    defaultFormat === format.id ? "bg-blue-500/10" : "hover:bg-slate-800/30",
                                                    format.isPro && !isPro && format.id !== 'custom' && "opacity-50 cursor-not-allowed"
                                                )}
                                                disabled={format.isPro && !isPro && format.id !== 'custom'}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "mt-0.5 p-1.5 rounded-md",
                                                        defaultFormat === format.id ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-400 group-hover:text-slate-300"
                                                    )}>
                                                        <format.icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("text-sm font-medium", defaultFormat === format.id ? "text-blue-400" : "text-slate-200")}>
                                                                {format.label}
                                                            </span>
                                                            {format.isPro && (
                                                                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] px-1 py-0 h-4">PRO</Badge>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-slate-500 font-mono">
                                                            e.g. <span className="text-slate-300">{format.example}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                {defaultFormat === format.id && <Check className="w-4 h-4 text-blue-500" />}
                                            </button>

                                            {/* Custom Rule Config */}
                                            {format.id === 'custom' && (defaultFormat === 'custom' || (previewCustomSettings && !isPro)) && (
                                                <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800/50 space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-slate-400">Prefix (Before)</Label>
                                                            <select
                                                                className="w-full h-8 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                value={customRule.prefixType}
                                                                onChange={(e) => handleCustomRuleChange({ prefixType: e.target.value })}
                                                                disabled={!isPro}
                                                            >
                                                                {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                            </select>
                                                            {customRule.prefixType === 'text' && (
                                                                <Input
                                                                    className="h-8 text-xs bg-slate-900 border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    placeholder="Max 10 chars"
                                                                    maxLength={10}
                                                                    value={customRule.prefixText}
                                                                    onChange={(e) => handleCustomRuleChange({ prefixText: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                                                                    disabled={!isPro}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-slate-400">Suffix (After)</Label>
                                                            <select
                                                                className="w-full h-8 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                value={customRule.suffixType}
                                                                onChange={(e) => handleCustomRuleChange({ suffixType: e.target.value })}
                                                                disabled={!isPro}
                                                            >
                                                                {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                            </select>
                                                            {customRule.suffixType === 'text' && (
                                                                <Input
                                                                    className="h-8 text-xs bg-slate-900 border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    placeholder="Max 10 chars"
                                                                    maxLength={10}
                                                                    value={customRule.suffixText}
                                                                    onChange={(e) => handleCustomRuleChange({ suffixText: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                                                                    disabled={!isPro}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <Checkbox
                                                            id="separator"
                                                            checked={!!customRule.separator}
                                                            onCheckedChange={(checked) => handleCustomRuleChange({ separator: !!checked })}
                                                            className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            disabled={!isPro}
                                                        />
                                                        <Label htmlFor="separator" className="text-xs text-slate-300">Use separator (-)</Label>
                                                    </div>
                                                    <div className="text-sm text-slate-400 font-mono bg-slate-900/50 p-3 rounded border border-slate-800/50 text-center break-all">
                                                        Preview: <span className="text-blue-300 font-medium">{getFormatExample('custom')}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </section>

                {/* Pro Features */}
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-400 px-1">Pro Features</h2>
                    <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                        <CardContent className="p-5 space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <span className="text-sm font-medium text-slate-200">License Status</span>
                                <span className={cn("text-sm font-medium", isPro ? "text-green-500" : "text-slate-400")}>
                                    {isPro ? "Pro Version" : "Free Version"}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div className="text-xs font-bold text-slate-100 uppercase tracking-wider">Free</div>
                                    <ul className="space-y-2">
                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                            <span>Unlimited aliases</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                            <span>API Integration</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="space-y-3">
                                    <div className="text-xs font-bold text-amber-500 uppercase tracking-wider">Pro</div>
                                    <ul className="space-y-2">
                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <Check className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                            <span>Unlimited aliases</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <Check className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                            <span>API Integration</span>
                                        </li>

                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <Check className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                            <span>Custom Format Rules</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <Check className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                            <span>Priority Support</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <Check className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                            <span>More features coming soon</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                                            <a href="https://aliasbridge.userjot.com/" target="_blank" className="text-blue-500 hover:text-blue-400 hover:underline">Feature Request</a>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {!isPro && (
                                <div className="space-y-3 pt-2">
                                    <Button
                                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                                        onClick={() => window.open('https://buy.polar.sh/polar_cl_PFI9AO6jGDqXB5ZvrRtnQBJ7nqccnijY9Y3Kv07QS6E', '_blank')}
                                    >
                                        Get Pro License
                                    </Button>
                                    <div className="space-y-2">
                                        <Label htmlFor="license" className="text-slate-300">Activate License Key</Label>
                                        <Input
                                            id="license"
                                            placeholder="Enter your Polar License Key"
                                            className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600"
                                            value={licenseKey}
                                            onChange={(e) => setLicenseKey(e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                                        onClick={handleLicenseVerify}
                                        disabled={licenseStatus === 'verifying' || !licenseKey}
                                    >
                                        {licenseStatus === 'verifying' ? 'Verifying...' : 'Activate License'}
                                    </Button>
                                    {licenseStatus === 'invalid' && (
                                        <div className="text-xs text-red-500 font-medium text-center">
                                            {licenseError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>

                {/* About */}
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-400 px-1">About</h2>
                    <Card className="bg-slate-900 border-slate-800 overflow-hidden divide-y divide-slate-800">
                        <div className="p-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-200">Version</span>
                            <span className="text-sm text-slate-500">1.0.0 (1)</span>
                        </div>
                        <a href="#" className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left group">
                            <span className="text-sm font-medium text-slate-200">Send Feedback</span>
                            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                        </a>
                        <a href="https://github.com/dryden/alias-bridge" target="_blank" className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left group">
                            <span className="text-sm font-medium text-slate-200">View on GitHub</span>
                            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                        </a>
                    </Card>
                </section>

            </div>
        </div>
    )
}

export default SettingsPage
