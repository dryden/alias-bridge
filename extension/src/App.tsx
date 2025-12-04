import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'
import { generateLocalPart, DEFAULT_CUSTOM_RULE, type CustomRule } from './lib/aliasGenerator'
import { providerService } from './services/providers/provider.service'
import { providerRegistry } from './services/providers/registry'
import type { ProviderConfig } from './services/providers/types'
import { domainCacheService } from './services/domain-cache.service'
import { Shield, Settings, RefreshCw, Star, Crown, Copy, ChevronDown } from 'lucide-react'
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
  const [availableDomains, setAvailableDomains] = useState<string[]>([])

  // License State
  const [isPro, setIsPro] = useState(false)

  // UI State
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string | null>(null)
  const [isCatchAllEnabled, setIsCatchAllEnabled] = useState<boolean | null>(null)
  const [isRefreshingDomains, setIsRefreshingDomains] = useState(false)

  // Fetch domains when provider config changes (with caching)
  useEffect(() => {
    const fetchDomains = async () => {
      if (providerConfig && providerConfig.token) {
        try {
          // Try to get from cache first
          let domains = await domainCacheService.getCachedDomains(providerConfig.id, providerConfig.token)

          if (!domains) {
            // Cache miss, fetch from provider
            console.log('[App] Domain cache miss, fetching from provider')
            domains = await providerService.getProviderDomains(providerConfig.id, providerConfig.token)
            // Cache the result
            await domainCacheService.setCachedDomains(providerConfig.id, providerConfig.token, domains)
          } else {
            console.log('[App] Domain cache hit, using cached domains')
          }

          setAvailableDomains(domains)

          // Ensure defaultDomain is in the list, if not select the first one
          if (domains.length > 0 && (!defaultDomain || !domains.includes(defaultDomain))) {
            const newDefault = domains[0]
            setDefaultDomain(newDefault)

            // Update config in storage
            const newConfig = { ...providerConfig, defaultDomain: newDefault }
            setProviderConfig(newConfig)
            await providerService.saveProviderConfig(newConfig)
            console.log('[App] Auto-selected default domain:', newDefault)
          }
        } catch (error) {
          console.error('Failed to fetch domains:', error)
          setAvailableDomains([])
        }
      } else {
        setAvailableDomains([])
      }
    }
    fetchDomains()
  }, [providerConfig?.id, providerConfig?.token])

  // Refresh domains (invalidate cache and fetch fresh)
  const refreshDomains = async () => {
    if (!providerConfig || !providerConfig.token) return

    setIsRefreshingDomains(true)
    try {
      // Invalidate domain and catch-all cache
      await domainCacheService.invalidateCache(providerConfig.id, providerConfig.token)

      // Fetch fresh domains from provider
      const domains = await providerService.getProviderDomains(providerConfig.id, providerConfig.token)

      // Cache the result
      await domainCacheService.setCachedDomains(providerConfig.id, providerConfig.token, domains)

      setAvailableDomains(domains)

      // Reset catch-all status for current domain so it will be re-fetched on next alias generation
      setIsCatchAllEnabled(null)

      console.log('[App] Domains refreshed:', domains.length)
    } catch (error) {
      console.error('Failed to refresh domains:', error)
    } finally {
      setIsRefreshingDomains(false)
    }
  }

  // Handlers
  const openSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      console.log('Open Settings Page');
    }
  }

  const generateAlias = async () => {
    if (!providerConfig || !defaultDomain) return

    const provider = providerRegistry.get(providerConfig.id)
    if (!provider) return

    // For Addy, check if domain has catch-all enabled
    // If catch-all is disabled, don't show alias preview (it will be fetched from server)
    let shouldSkipAliasGeneration = false

    if (providerConfig.id === 'addy') {
      try {
        // Try to get catch-all status from cache first
        let isCatchAllEnabledValue = await domainCacheService.getCachedCatchAllStatus(providerConfig.id, providerConfig.token, defaultDomain)

        if (isCatchAllEnabledValue === null) {
          // Cache miss, fetch from provider
          console.log('[App] Catch-all status cache miss, fetching from provider')
          const { getDomainDetails } = await import('./services/addy')
          const domainDetails = await getDomainDetails(providerConfig.token, defaultDomain)
          console.log('[App] generateAlias - Domain details retrieved:', { domain: defaultDomain, details: domainDetails })

          if (domainDetails) {
            isCatchAllEnabledValue = domainDetails.catch_all === true
            // Cache the catch-all status
            await domainCacheService.setCachedCatchAllStatus(providerConfig.id, providerConfig.token, defaultDomain, isCatchAllEnabledValue)
            console.log('[App] Cached catch-all status:', { domain: defaultDomain, isCatchAllEnabled: isCatchAllEnabledValue })
          } else {
            console.log('[App] Domain details not found, generating alias normally')
            isCatchAllEnabledValue = null
          }
        } else {
          console.log('[App] Catch-all status cache hit:', { domain: defaultDomain, isCatchAllEnabled: isCatchAllEnabledValue })
        }

        console.log('[App] Setting isCatchAllEnabled to:', isCatchAllEnabledValue)
        setIsCatchAllEnabled(isCatchAllEnabledValue)

        if (isCatchAllEnabledValue === false) {
          // Catch-all disabled: show placeholder, will be fetched from server on Copy & Fill
          console.log('[App] Domain has catch-all disabled, showing placeholder')
          setGeneratedAlias('(Generating from server...)')
          shouldSkipAliasGeneration = true
        } else {
          console.log('[App] Domain has catch-all enabled, will generate alias normally')
        }
      } catch (error) {
        console.error('[App] Error checking domain catch-all status:', error)
        setIsCatchAllEnabled(null)
        // Continue with normal generation if error
      }
    } else {
      // For non-Addy providers, reset catch-all state
      setIsCatchAllEnabled(null)
    }

    // If catch-all is disabled, skip alias generation (placeholder is already set)
    if (shouldSkipAliasGeneration) {
      console.log('[App] Skipping alias generation for catch-all disabled domain')
      return
    }

    const localPart = generateLocalPart({
      type: activeTab,
      currentUrl: currentUrl,
      customRule: customRule
    })

    const alias = provider.generateAddress(localPart, defaultDomain)
    console.log('[App] Generated alias:', alias)
    setGeneratedAlias(alias)
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
    setIsProcessing(true);
    setProcessingStep(null);
    try {
      console.log('========== Alias Bridge: Copy & Fill Started ==========');
      console.log('Generated Alias:', generatedAlias);
      console.log('Provider ID:', providerConfig?.id);
      console.log('Wait Server Confirmation:', providerConfig?.waitServerConfirmation);

      // Track the alias to use (may be updated by server)
      let aliasToUse = generatedAlias;

      // Create alias on server if needed (Addy or SimpleLogin with waitServerConfirmation enabled)
      if (providerConfig) {
        const shouldWaitServerConfirmation = providerConfig.id === 'simplelogin' || providerConfig.waitServerConfirmation === true;

        if (shouldWaitServerConfirmation) {
          setProcessingStep('Creating alias on server...');
          console.log('[Step 1/3] Server Confirmation Required');
          console.log('  - Provider:', providerConfig.id);
          console.log('  - Creating alias on server...');

          const provider = providerRegistry.get(providerConfig.id);
          if (provider && provider.createAlias) {
            // If catch-all is disabled (Addy specific), we pass the domain but no alias
            // This triggers server-side generation in AddyProvider
            const aliasToCreate = (providerConfig.id === 'addy' && isCatchAllEnabled === false) ? '' : generatedAlias;
            const domainForCreation = (providerConfig.id === 'addy' && isCatchAllEnabled === false) ? defaultDomain : undefined;

            const result = await provider.createAlias(aliasToCreate, providerConfig.token, domainForCreation);
            if (result.success) {
              console.log('  ✓ Alias successfully created on server');
              // Use server-returned alias if available
              if (result.createdAlias) {
                console.log('  - Using server-created alias:', result.createdAlias);
                aliasToUse = result.createdAlias;
              }
            } else {
              console.error('  ✗ Failed to create alias on server:', result.error);
              // For Addy, only continue if it's a catch-all domain (where creation isn't needed)
              // For other providers or real API errors, throw immediately
              if (providerConfig.id === 'addy' && result.isCatchAllDomain) {
                console.log('  ℹ️ Catch-all domain detected, continuing without server confirmation');
              } else {
                throw new Error(`Failed to create alias: ${result.error}`);
              }
            }
          }
        } else {
          console.log('[Step 1/3] No Server Confirmation Required');
          console.log('  - waitServerConfirmation is disabled for Addy');
        }
      }

      setProcessingStep('Copying to clipboard...');
      console.log('[Step 2/3] Copying to clipboard');
      await navigator.clipboard.writeText(aliasToUse);
      console.log('  ✓ Alias copied to clipboard:', aliasToUse);

      setProcessingStep('Filling email field...');
      console.log('[Step 3/3] Filling email input field');
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: (email) => {
              console.log('  - Looking for email input field...');
              let activeElement = document.activeElement as HTMLInputElement;
              if (!activeElement || activeElement === document.body || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')) {
                const emailInput = document.querySelector('input[type="email"]');
                if (emailInput) {
                  activeElement = emailInput as HTMLInputElement;
                  console.log('  - Found email input field');
                } else {
                  const firstInput = document.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
                  if (firstInput) {
                    activeElement = firstInput as HTMLInputElement;
                    console.log('  - Found first input field (fallback)');
                  } else {
                    console.log('  ✗ No input field found on page');
                  }
                }
              }

              if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                console.log('  - Setting value to:', email);
                (activeElement as HTMLInputElement).value = email;
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                activeElement.dispatchEvent(new Event('change', { bubbles: true }));
                activeElement.focus();
                console.log('  ✓ Email filled and field focused');
              }
            },
            args: [aliasToUse]
          });
        }
      }

      console.log('========== Alias Bridge: Copy & Fill Completed Successfully ==========');
      setProcessingStep(null);
    } catch (err) {
      console.error('========== Alias Bridge: Copy & Fill Failed ==========');
      console.error('Error:', err);
      setProcessingStep(null);
    } finally {
      setIsProcessing(false);
    }
  }

  // Load initial state
  useEffect(() => {
    const init = async () => {
      console.log('[App] Initializing popup page, loading latest config from storage')
      // Load settings - always reload to get latest from storage
      const enabled = await providerService.getEnabledProviders()
      console.log('[App] Loaded enabled providers:', enabled)
      setProviders(enabled)

      if (enabled.length > 0) {
        // Determine default provider
        const defaultProvider = await providerService.getDefaultProvider()
        const initial = (defaultProvider && enabled.find(p => p.id === defaultProvider.id))
          ? defaultProvider
          : enabled[0]

        console.log('[App] Initial provider config:', initial)
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

  // Listen for storage changes to update provider config when settings change
  useEffect(() => {
    const handleStorageChange = async () => {
      console.log('[App] Storage changed, reloading provider config...')
      const enabled = await providerService.getEnabledProviders()
      setProviders(enabled)
      if (selectedProviderId) {
        const updated = enabled.find(p => p.id === selectedProviderId)
        if (updated) {
          setProviderConfig(updated)
          console.log('[App] Provider config updated:', updated)
        }
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.onChanged.addListener(handleStorageChange)
      return () => {
        chrome.storage.local.onChanged.removeListener(handleStorageChange)
      }
    }
  }, [selectedProviderId])

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

      {/* Main Card */}
      <div className="bg-slate-900 rounded-2xl p-4 shadow-lg border border-slate-800/50 mb-6 mx-5 mt-5">
        {/* Domain Selector */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={defaultDomain}
                onChange={async (e) => {
                  const newDomain = e.target.value
                  setDefaultDomain(newDomain)
                  if (providerConfig) {
                    const newConfig = { ...providerConfig, defaultDomain: newDomain }
                    setProviderConfig(newConfig)
                    await providerService.saveProviderConfig(newConfig)
                  }
                }}
                className="w-full h-9 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 pl-3 pr-10 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                disabled={availableDomains.length === 0}
              >
                {availableDomains.length === 0 && <option>Loading domains...</option>}
                {availableDomains.map(domain => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <button
              onClick={refreshDomains}
              disabled={isRefreshingDomains || availableDomains.length === 0}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isRefreshingDomains || availableDomains.length === 0
                  ? "text-slate-600 cursor-not-allowed"
                  : "text-slate-500 hover:text-white hover:bg-slate-800"
              )}
              title="Refresh domains"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshingDomains && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Tabs - Hidden when catch-all is disabled */}
        {isCatchAllEnabled !== false && (
          <div className="bg-slate-950/50 p-1 rounded-lg flex mb-6">
            {['uuid', 'random', 'domain', 'custom'].map((tab) => {
              // Disable ALL tabs if catch-all is disabled (isCatchAllEnabled === false)
              // Note: isCatchAllEnabled is null for non-Addy providers or when not yet determined
              const isDisabledByPro = ['domain', 'custom'].includes(tab) && !isPro
              const isDisabled = isDisabledByPro

              return (
                <button
                  key={tab}
                  onClick={() => !isDisabled && handleTabChange(tab)}
                  disabled={isDisabled}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize relative",
                    isDisabled
                      ? "opacity-40 cursor-not-allowed text-slate-600"
                      : activeTab === tab
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {tab === 'uuid' ? 'UUID' : tab}
                  {/* Lock icon for pro features */}
                  {['domain', 'custom'].includes(tab) && isDisabledByPro && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500/50 rounded-full"></span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Generated Alias Input */}
        <div className="space-y-2 mb-2">
          {isCatchAllEnabled === false ? (
            <>
              {/* Server Generation Mode Label */}
              <div className="flex items-center gap-2 ml-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"></div>
                <label className="text-xs font-semibold text-blue-300">Server Generation Mode</label>
              </div>

              {/* Info message for catch-all disabled domains */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-300 leading-relaxed">
                  This domain doesn't support catch-all aliases. The server will generate a random alias when you click "Copy & Fill".
                </p>
              </div>

              {/* Server Generation Placeholder with Animated Arrow */}
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-500/5 rounded-xl blur-sm group-hover:bg-blue-500/10 transition-all"></div>
                <div className="relative flex items-center justify-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden transition-colors group-hover:border-slate-700 min-h-[80px]">
                  <div className="flex flex-col items-center justify-center gap-3">
                    {/* Animated downward arrow */}
                    <div className="flex flex-col items-center gap-1">
                      <svg className="w-5 h-5 text-blue-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                    <p className="text-xs text-blue-300 font-medium">Click "Copy & Fill" to generate</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
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
                  <div className="absolute right-2 relative">
                    <button
                      onClick={generateAlias}
                      className="p-2 rounded-lg transition-colors text-slate-500 hover:text-white hover:bg-slate-800"
                      title="Regenerate alias"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Processing Status */}
      {isProcessing && processingStep && (
        <div className="mx-5 mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            {processingStep}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mt-auto mb-2 px-5">
        <Button
          className={cn(
            "flex-1 h-12 rounded-xl text-sm font-semibold shadow-lg transition-all",
            isProcessing
              ? "bg-blue-600/60 hover:bg-blue-600/60 text-white cursor-wait opacity-75"
              : "bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.02] active:scale-[0.98]"
          )}
          onClick={handleCopyAndFill}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing...
            </div>
          ) : (
            'Copy & Fill'
          )}
        </Button>
        <Button
          variant="secondary"
          className={cn(
            "w-12 h-12 rounded-xl border border-slate-700/50 transition-all flex items-center justify-center p-0",
            isProcessing
              ? "bg-slate-800/60 text-slate-500 cursor-not-allowed"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 hover:scale-[1.02] active:scale-[0.98]"
          )}
          onClick={() => navigator.clipboard.writeText(generatedAlias)}
          disabled={isProcessing}
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
