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
    Key, ChevronRight,
    ExternalLink, Eye, EyeOff, Check, ChevronDown
} from 'lucide-react'
import { cn } from './lib/utils'
import confetti from 'canvas-confetti'

interface CustomRule {
    prefixType: string;
    prefixText: string;
    suffixType: string;
    suffixText: string;
}

const DEFAULT_CUSTOM_RULE: CustomRule = {
    prefixType: 'none',
    prefixText: '',
    suffixType: 'none',
    suffixText: ''
}

const DATE_FORMATS = [
    { value: 'none', label: 'None' },
    { value: 'yyyy', label: 'YYYY' },
    { value: 'yyyymm', label: 'YYYYMM' },
    { value: 'yyyymmdd', label: 'YYYYMMDD' },
    { value: 'yyyymmddhhmm', label: 'YYYYMMDDHHMM' },
    { value: 'text', label: 'Custom Text' },
]

function SettingsPage() {
    // Global State
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [token, setToken] = useState('')
    const [showToken, setShowToken] = useState(false)
    const [userData, setUserData] = useState<any>(null)

    // Settings State
    const [autoCopy, setAutoCopy] = useState(true)
    const [defaultDomain, setDefaultDomain] = useState('addy.io')
    const [defaultFormat, setDefaultFormat] = useState('uuid')

    // Custom Rule State
    const [customRule, setCustomRule] = useState<CustomRule>(DEFAULT_CUSTOM_RULE)

    // Data
    const [availableDomains, setAvailableDomains] = useState<string[]>(['addy.io', 'anonaddy.com', 'anonaddy.me'])

    // UI State
    const [expandedSection, setExpandedSection] = useState<'domain' | 'format' | null>(null)

    // License State
    const [isPro, setIsPro] = useState(false)
    const [licenseKey, setLicenseKey] = useState('')
    const [licenseStatus, setLicenseStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle')

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

                if (result.autoCopy !== undefined) {
                    setAutoCopy(!!result.autoCopy)
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
            setAvailableDomains(domains)
        }
    }

    // Save settings when changed
    const handleAutoCopyChange = (checked: boolean) => {
        setAutoCopy(checked)
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ autoCopy: checked })
        }
    }

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
        const user = userData?.username || 'username';
        const domain = defaultDomain;

        switch (format) {
            case 'uuid': return `3a1b2c3d-4e5f...@${domain}`;
            case 'random': return `blue.dog.apple@${domain}`;
            case 'domain': return `spotify@${user}.${domain}`;
            case 'custom': {
                // Construct custom example
                const now = new Date();
                const pad = (n: number) => n.toString().padStart(2, '0');
                const yyyy = now.getFullYear();
                const mm = pad(now.getMonth() + 1);
                const dd = pad(now.getDate());
                const hh = pad(now.getHours());
                const min = pad(now.getMinutes());

                const getPart = (type: string, text: string) => {
                    switch (type) {
                        case 'none': return '';
                        case 'yyyy': return `${yyyy}-`;
                        case 'yyyymm': return `${yyyy}${mm}-`;
                        case 'yyyymmdd': return `${yyyy}${mm}${dd}-`;
                        case 'yyyymmddhhmm': return `${yyyy}${mm}${dd}${hh}${min}-`;
                        case 'text': return text ? `${text}-` : '';
                        default: return '';
                    }
                }

                const getSuffixPart = (type: string, text: string) => {
                    switch (type) {
                        case 'none': return '';
                        case 'yyyy': return `-${yyyy}`;
                        case 'yyyymm': return `-${yyyy}${mm}`;
                        case 'yyyymmdd': return `-${yyyy}${mm}${dd}`;
                        case 'yyyymmddhhmm': return `-${yyyy}${mm}${dd}${hh}${min}`;
                        case 'text': return text ? `-${text}` : '';
                        default: return '';
                    }
                }

                const prefix = getPart(customRule.prefixType, customRule.prefixText);
                const suffix = getSuffixPart(customRule.suffixType, customRule.suffixText);

                return `${prefix}spotify${suffix}@${user}.${domain}`;
            }
            default: return '';
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
            {/* Navbar */}
            <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={() => window.history.back()}>
                        <ChevronRight className="w-6 h-6 rotate-180" />
                    </Button>
                    <h1 className="text-base font-semibold">Settings</h1>
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
                                            How to get your token
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
                        {/* Auto-copy */}
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={cn("text-sm font-medium", !isPro ? "text-slate-400" : "text-slate-200")}>
                                    Auto-copy generated email
                                </span>
                                <Badge className="bg-yellow-900/40 text-yellow-400 hover:bg-yellow-900/60 border-yellow-700/50 text-[10px] px-1.5 py-0 h-5 font-bold tracking-wide">
                                    PRO
                                </Badge>
                            </div>
                            <Checkbox
                                checked={autoCopy}
                                onCheckedChange={handleAutoCopyChange}
                                disabled={!isPro}
                                className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                        </div>

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
                                        { id: 'uuid', label: 'UUID', example: getFormatExample('uuid') },
                                        { id: 'random', label: 'Random Words', example: getFormatExample('random') },
                                        { id: 'domain', label: 'Domain Name', example: getFormatExample('domain'), isPro: true },
                                        { id: 'custom', label: 'Custom Domain Name', example: getFormatExample('custom'), isPro: true },
                                    ].map((format) => (
                                        <div key={format.id}>
                                            <button
                                                onClick={() => handleDefaultFormatChange(format.id)}
                                                disabled={format.isPro && !isPro}
                                                className={cn(
                                                    "w-full px-4 py-3 flex items-center justify-between transition-colors text-left group",
                                                    defaultFormat === format.id ? "bg-blue-500/10" : "hover:bg-slate-800/30",
                                                    format.isPro && !isPro && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
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
                                                        e.g. {format.example}
                                                    </span>
                                                </div>
                                                {defaultFormat === format.id && <Check className="w-4 h-4 text-blue-500" />}
                                            </button>

                                            {/* Custom Rule Config */}
                                            {format.id === 'custom' && defaultFormat === 'custom' && isPro && (
                                                <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800/50 space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-slate-400">Prefix (Before)</Label>
                                                            <select
                                                                className="w-full h-8 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                value={customRule.prefixType}
                                                                onChange={(e) => handleCustomRuleChange({ prefixType: e.target.value })}
                                                            >
                                                                {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                            </select>
                                                            {customRule.prefixType === 'text' && (
                                                                <Input
                                                                    className="h-8 text-xs bg-slate-900 border-slate-800"
                                                                    placeholder="Max 10 chars"
                                                                    maxLength={10}
                                                                    value={customRule.prefixText}
                                                                    onChange={(e) => handleCustomRuleChange({ prefixText: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-slate-400">Suffix (After)</Label>
                                                            <select
                                                                className="w-full h-8 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                value={customRule.suffixType}
                                                                onChange={(e) => handleCustomRuleChange({ suffixType: e.target.value })}
                                                            >
                                                                {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                            </select>
                                                            {customRule.suffixType === 'text' && (
                                                                <Input
                                                                    className="h-8 text-xs bg-slate-900 border-slate-800"
                                                                    placeholder="Max 10 chars"
                                                                    maxLength={10}
                                                                    value={customRule.suffixText}
                                                                    onChange={(e) => handleCustomRuleChange({ suffixText: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm text-slate-400 font-mono bg-slate-900/50 p-3 rounded border border-slate-800/50 text-center break-all">
                                                        Preview: <span className="text-blue-400">{getFormatExample('custom')}</span>
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
                                            <span>Auto-copy to clipboard</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <Check className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                            <span>Custom Format Rules</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-xs text-slate-400">
                                            <Check className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                            <span>Priority Support</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {!isPro && (
                                <div className="space-y-3 pt-2">
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
                                        {licenseStatus === 'verifying' ? 'Verifying...' : 'Get Lifetime Access'}
                                    </Button>
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
