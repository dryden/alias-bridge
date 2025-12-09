import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent } from './components/ui/card'
import { Label } from './components/ui/label'
import { verifyLicense } from './services/license'
import {
    ExternalLink, Check
} from 'lucide-react'
import { cn } from './lib/utils'
import confetti from 'canvas-confetti'
import { ProviderCard } from './components/ProviderCard'
import { providerService } from './services/providers/provider.service'
import { migrateLegacyStorage } from './services/migration'
import { logger } from './services/logger'
import packageJson from '../package.json'




function SettingsPage() {
    // Global State
    // Global State
    // const [multiSettings, setMultiSettings] = useState<MultiProviderSettings | null>(null)

    // License State
    const [isPro, setIsPro] = useState(false)
    const [licenseKey, setLicenseKey] = useState('')
    const [licenseStatus, setLicenseStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle')
    const [licenseError, setLicenseError] = useState<string>('')

    useEffect(() => {
        const init = async () => {
            await migrateLegacyStorage()
            await loadSettings()

            // Load license
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['licenseKey', 'isPro'], (result) => {
                    if (chrome.runtime.lastError) {
                        logger.error('SettingsPage', 'Failed to load license from storage:', chrome.runtime.lastError)
                        return
                    }
                    if (result.licenseKey) {
                        setLicenseKey(result.licenseKey as string)
                        setIsPro(!!result.isPro)
                        if (result.isPro) setLicenseStatus('valid')
                    }
                })
            } else {
                try {
                    const savedLicense = localStorage.getItem('licenseKey')
                    if (savedLicense) {
                        setLicenseKey(savedLicense)
                        setIsPro(localStorage.getItem('isPro') === 'true')
                        if (localStorage.getItem('isPro') === 'true') setLicenseStatus('valid')
                    }
                } catch (error) {
                    logger.error('SettingsPage', 'Failed to load license from localStorage:', error)
                }
            }
        }
        init()
    }, [])

    const loadSettings = async () => {
        await providerService.getSettings()
        // setMultiSettings(settings)
    }

    const handleConfigChange = () => {
        loadSettings()
    }

    // const handleDefaultProviderChange = async (providerId: string) => {
    //     await providerService.setDefaultProvider(providerId)
    //     loadSettings()
    // }

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

                {/* Default Service Selector - Hidden, only Addy.io available */}
                {/* <section className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-400 px-1">Default Service</Label>
                    <div className="relative">
                        <select
                            value={multiSettings?.defaultProviderId || ''}
                            onChange={(e) => handleDefaultProviderChange(e.target.value)}
                            className="w-full h-10 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 px-3 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {multiSettings && Object.values(multiSettings.providers).filter(p => p.enabled).map(p => (
                                <option key={p.id} value={p.id}>
                                    {providerRegistry.get(p.id)?.name || p.id}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                </section> */}

                {/* Providers */}
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-400 px-1">Providers</h2>
                    <div className="space-y-4">
                        <ProviderCard providerId="addy" isPro={isPro} onConfigChange={handleConfigChange} />
                        {/* SimpleLogin temporarily hidden - too many issues to resolve */}
                        {/* <ProviderCard providerId="simplelogin" isPro={isPro} onConfigChange={handleConfigChange} /> */}
                    </div>
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
                                            <span>Manage Favorite Domains</span>
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
                                        onClick={() => window.open('https://buy.polar.sh/polar_cl_Rmxq5UDVfgkNoQVZ26J4lsy1sOV8WXt72wHMA2VVg9k', '_blank')}
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
                            <span className="text-sm text-slate-500">{packageJson.version}</span>
                        </div>
                        <a href="https://aliasbridge.userjot.com/?cursor=1&order=top&limit=10" target="_blank" className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left group">
                            <span className="text-sm font-medium text-slate-200">Send Feedback</span>
                            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                        </a>
                    </Card>
                </section>

            </div>
        </div>
    )
}

export default SettingsPage
