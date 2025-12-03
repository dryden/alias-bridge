import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'
import { generateLocalPart, DEFAULT_CUSTOM_RULE, type CustomRule } from './lib/aliasGenerator'
import { providerService } from './services/providers/provider.service'
import { providerRegistry } from './services/providers/registry'
import type { ProviderConfig } from './services/providers/types'
import { Shield, Settings, RefreshCw, Star, Crown, Copy } from 'lucide-react'
import { cn } from './lib/utils'

function App() {
  // Data State
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null)

  const [currentUrl, setCurrentUrl] = useState('')
  const [generatedAlias, setGeneratedAlias] = useState('')
  const [activeTab, setActiveTab] = useState('uuid')
  const [autoCopy, setAutoCopy] = useState(true)
  const [customRule, setCustomRule] = useState<CustomRule>(DEFAULT_CUSTOM_RULE)
  const [defaultDomain, setDefaultDomain] = useState('')

  // License State
  const [isPro, setIsPro] = useState(false)

  // Handlers
  const openSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      console.log('Open Settings Page');
    }
  }

  const generateAlias = () => {
    if (!providerConfig || !defaultDomain) return

    const provider = providerRegistry.get(providerConfig.id)
    if (!provider) return

    const localPart = generateLocalPart({
      type: activeTab,
      currentUrl: currentUrl,
      customRule: customRule
    })

    const alias = provider.generateAddress(localPart, defaultDomain)
    setGeneratedAlias(alias)
  }

  const handleProviderChange = async (providerId: string) => {
    const config = providers.find(p => p.id === providerId)
    if (config) {
      setSelectedProviderId(providerId)
      setProviderConfig(config)
      setActiveTab(config.activeFormat || 'uuid')
      setDefaultDomain(config.defaultDomain || '')
      if (config.customRule) setCustomRule(config.customRule)
    }
  }

  const handleTabChange = async (value: string) => {
    if ((value === 'domain' || value === 'custom') && !isPro) {
      openSettings() // Direct to settings/upgrade page
      return
    }
    setActiveTab(value)

    // Save to provider config
    if (providerConfig) {
      const newConfig = { ...providerConfig, activeFormat: value }
      setProviderConfig(newConfig)
      await providerService.saveProviderConfig(newConfig)
    }
  }

  const handleCopyAndFill = async () => {
    try {
      // Create alias on server if needed (SimpleLogin)
      if (providerConfig && providerConfig.id === 'simplelogin') {
        const provider = providerRegistry.get(providerConfig.id);
        if (provider && provider.createAlias) {
          const result = await provider.createAlias(generatedAlias, providerConfig.token);
          if (!result.success) {
            console.error('Failed to create alias on SimpleLogin:', result.error);
            // Continue anyway - the alias might already exist or user can create it manually
          }
        }
      }

      await navigator.clipboard.writeText(generatedAlias)

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: (email) => {
              let activeElement = document.activeElement as HTMLInputElement;
              if (!activeElement || activeElement === document.body || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')) {
                const emailInput = document.querySelector('input[type="email"]');
                if (emailInput) {
                  activeElement = emailInput as HTMLInputElement;
                } else {
                  const firstInput = document.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
                  if (firstInput) {
                    activeElement = firstInput as HTMLInputElement;
                  }
                }
              }

              if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.value = email;
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                activeElement.dispatchEvent(new Event('change', { bubbles: true }));
                activeElement.focus();
              }
            },
            args: [generatedAlias]
          });
        }
      }
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  // Load initial state
  useEffect(() => {
    const init = async () => {
      // Load settings
      const enabled = await providerService.getEnabledProviders()
      setProviders(enabled)

      if (enabled.length > 0) {
        // Determine default provider
        const defaultProvider = await providerService.getDefaultProvider()
        const initial = (defaultProvider && enabled.find(p => p.id === defaultProvider.id))
          ? defaultProvider
          : enabled[0]

        setSelectedProviderId(initial.id)
        setProviderConfig(initial)
        setActiveTab(initial.activeFormat || 'uuid')
        setDefaultDomain(initial.defaultDomain || '')
        if (initial.customRule) setCustomRule(initial.customRule)
      }

      // Load global settings
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['licenseKey', 'isPro', 'autoCopy'], (result) => {
          if (result.licenseKey) setIsPro(!!result.isPro)
          if (result.autoCopy !== undefined) setAutoCopy(!!result.autoCopy)
        })
      } else {
        // Dev mode
        setIsPro(localStorage.getItem('isPro') === 'true')
      }

      // Get current tab URL
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.url) {
            setCurrentUrl(tabs[0].url)
          }
        })
      } else {
        setCurrentUrl('https://example.com/signup')
      }
    }
    init()
  }, [])

  // Generate alias when dependencies change
  useEffect(() => {
    generateAlias()
  }, [activeTab, currentUrl, defaultDomain, customRule, providerConfig])

  // Save autoCopy preference
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ autoCopy })
    }
  }, [autoCopy])

  // Main View
  if (providers.length === 0) {
    return (
      <div className="w-[350px] bg-slate-950 min-h-[500px] p-5 flex flex-col font-sans text-slate-100">
        <div className="flex items-center justify-center relative mb-8 mt-2">
          <div className="absolute left-0">
            <Shield className="w-6 h-6 text-slate-400" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Alias Bridge</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Settings className="w-8 h-8 text-blue-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-200">Setup Required</h2>
            <p className="text-sm text-slate-400 max-w-[250px]">
              Please configure a provider (Addy.io or SimpleLogin) in settings to start generating aliases.
            </p>
          </div>
          <Button
            onClick={openSettings}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            Open Settings
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[350px] bg-slate-950 min-h-[500px] flex flex-col font-sans text-slate-100">
      {/* Header */}
      <div className="h-14 flex items-center justify-center relative border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <img src="icon.ico" className="w-5 h-5" alt="Logo" />
          <h1 className="text-base font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Alias Bridge
          </h1>
        </div>
      </div>

      {/* Provider Selector */}
      {providers.length > 1 && (
        <div className="px-5 pt-3">
          <select
            value={selectedProviderId}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full h-9 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>{providerRegistry.get(p.id)?.name || p.id}</option>
            ))}
          </select>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-slate-900 rounded-2xl p-4 shadow-lg border border-slate-800/50 mb-6 mx-5 mt-5">
        {/* Tabs */}
        <div className="bg-slate-950/50 p-1 rounded-lg flex mb-6">
          {['uuid', 'random', 'domain', 'custom'].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize relative",
                activeTab === tab
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {tab === 'uuid' ? 'UUID' : tab}
              {/* Lock icon for pro features */}
              {['domain', 'custom'].includes(tab) && !isPro && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500/50 rounded-full"></span>
              )}
            </button>
          ))}
        </div>

        {/* Generated Alias Input */}
        <div className="space-y-2 mb-2">
          <label className="text-xs font-medium text-slate-400 ml-1">Generated Alias</label>
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500/5 rounded-xl blur-sm group-hover:bg-blue-500/10 transition-all"></div>
            <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden transition-colors group-hover:border-slate-700">
              <textarea
                value={generatedAlias}
                readOnly
                rows={3}
                className="w-full bg-transparent border-none py-3.5 pl-4 pr-10 text-xs font-mono text-slate-200 focus:ring-0 placeholder:text-slate-600 resize-none leading-relaxed break-all"
              />
              <button
                onClick={generateAlias}
                className="absolute right-2 p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mt-auto mb-2 px-5">
        <Button
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white h-12 rounded-xl text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          onClick={handleCopyAndFill}
        >
          Copy & Fill
        </Button>
        <Button
          variant="secondary"
          className="w-12 bg-slate-800 hover:bg-slate-700 text-slate-200 h-12 rounded-xl border border-slate-700/50 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center p-0"
          onClick={() => navigator.clipboard.writeText(generatedAlias)}
          title="Copy Only"
        >
          <Copy className="w-5 h-5" />
        </Button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-slate-500 mt-auto pt-2 px-5 pb-3">
        <button
          onClick={openSettings}
          className="p-2 hover:text-white transition-colors rounded-lg hover:bg-slate-900"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-medium text-amber-500/80">
          {isPro ? (
            <Crown className="w-3.5 h-3.5 fill-amber-500/20 text-amber-500" />
          ) : (
            <Star className="w-3.5 h-3.5 fill-amber-500/20" />
          )}
          <span>v{typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : '1.0.0'}</span>
        </div>
      </div>
    </div>
  )
}

export default App
