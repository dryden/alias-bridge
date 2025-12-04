import { useState, useEffect, useRef } from 'react'
import { Button } from './components/ui/button'
import { generateLocalPart, DEFAULT_CUSTOM_RULE, type CustomRule } from './lib/aliasGenerator'
import { providerService } from './services/providers/provider.service'
import { providerRegistry } from './services/providers/registry'
import type { ProviderConfig } from './services/providers/types'
import { domainCacheService } from './services/domain-cache.service'
import { checkAndUpdateCatchAllStatus } from './services/catchAll.helper'
import { Shield, Settings, RefreshCw, Star, Crown, Copy, ChevronDown, Check } from 'lucide-react'
import { cn } from './lib/utils'
import { groupDomainsByRoot } from './lib/domainGrouper'

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
  const [isDomainDropdownOpen, setIsDomainDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch domains when provider config changes (with caching)
  useEffect(() => {
    const fetchDomains = async () => {
      if (providerConfig && providerConfig.token) {
        try {
          // First, try to use cachedDomains from providerConfig if available
          let domains = providerConfig.cachedDomains && providerConfig.cachedDomains.length > 0
            ? providerConfig.cachedDomains
            : await domainCacheService.getCachedDomains(providerConfig.id, providerConfig.token)

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
          // Catch-all enabled or unknown: generate alias locally (clear any previous placeholder)
          console.log('[App] Domain has catch-all enabled or not determined, will generate alias normally')
          setGeneratedAlias('')
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
        // For Addy: only wait for server confirmation if catch-all is disabled
        // For SimpleLogin: always wait for server confirmation
        const shouldWaitServerConfirmation = providerConfig.id === 'simplelogin'
          || (providerConfig.id === 'addy' && isCatchAllEnabled === false);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDomainDropdownOpen(false)
      }
    }

    if (isDomainDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDomainDropdownOpen])

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
            <div className="relative flex-1" ref={dropdownRef}>
              <button
                onClick={() => setIsDomainDropdownOpen(!isDomainDropdownOpen)}
                disabled={availableDomains.length === 0}
                className={cn(
                  "w-full h-9 rounded-lg border text-xs text-left pl-3 pr-3 flex items-center justify-between transition-colors gap-2",
                  availableDomains.length === 0
                    ? "bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed"
                    : "bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                )}
              >
                <span className="truncate flex-1">{defaultDomain || 'Select domain...'}</span>
                <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform flex-shrink-0", isDomainDropdownOpen && "rotate-180")} />
              </button>

              {/* Grouped Dropdown Menu */}
              {isDomainDropdownOpen && availableDomains.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
                  {(() => {
                    const grouped = groupDomainsByRoot(availableDomains, providerConfig?.favoriteDomains)
                    const favorites = grouped.favorites.length > 0 ? grouped.favorites : []
                    const favoritesSet = new Set(favorites)

                    return (
                      <>
                        {/* Favorites Section */}
                        {favorites.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-bold text-amber-400 bg-slate-800 border-b border-slate-700/50">
                              ⭐
                            </div>
                            {favorites.map((domain) => (
                              <button
                                key={domain}
                                onClick={async () => {
                                  setDefaultDomain(domain)
                                  if (providerConfig) {
                                    let newConfig: ProviderConfig = { ...providerConfig, defaultDomain: domain }

                                    // For Addy, check if the domain has catch-all enabled
                                    if (providerConfig.id === 'addy' && providerConfig.token) {
                                      const result = await checkAndUpdateCatchAllStatus(providerConfig.id, providerConfig.token, domain, newConfig)
                                      newConfig = result.newConfig
                                    }

                                    setProviderConfig(newConfig)
                                    await providerService.saveProviderConfig(newConfig)
                                  }
                                  setIsDomainDropdownOpen(false)
                                }}
                                className={cn(
                                  "w-full px-3 py-2 text-xs text-left flex items-center justify-between hover:bg-blue-500/10 transition-colors border-b border-slate-800/30 last:border-0",
                                  defaultDomain === domain ? "bg-blue-500/15 text-blue-300" : "text-slate-300"
                                )}
                              >
                                <span className="truncate">{domain}</span>
                                {defaultDomain === domain && <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                              </button>
                            ))}
                          </>
                        )}

                        {/* Grouped Domains */}
                        {grouped.groups.map(group => (
                          <div key={group.label}>
                            <div className="px-3 py-2 text-xs font-bold text-slate-300 bg-slate-800 border-t border-slate-700/50">
                              • {group.label}
                            </div>
                            {group.domains.map((domain) => (
                              !favoritesSet.has(domain) && (
                                <button
                                  key={domain}
                                  onClick={async () => {
                                    setDefaultDomain(domain)
                                    if (providerConfig) {
                                      let newConfig: ProviderConfig = { ...providerConfig, defaultDomain: domain }

                                      // For Addy, check if the domain has catch-all enabled
                                      if (providerConfig.id === 'addy' && providerConfig.token) {
                                        const result = await checkAndUpdateCatchAllStatus(providerConfig.id, providerConfig.token, domain, newConfig)
                                        newConfig = result.newConfig
                                      }

                                      setProviderConfig(newConfig)
                                      await providerService.saveProviderConfig(newConfig)
                                    }
                                    setIsDomainDropdownOpen(false)
                                  }}
                                  className={cn(
                                    "w-full px-3 py-2 text-xs text-left flex items-center justify-between hover:bg-blue-500/10 transition-colors border-b border-slate-800/30 last:border-0",
                                    defaultDomain === domain ? "bg-blue-500/15 text-blue-300" : "text-slate-300"
                                  )}
                                >
                                  <span className="truncate">{domain}</span>
                                  {defaultDomain === domain && <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                                </button>
                              )
                            ))}
                          </div>
                        ))}
                      </>
                    )
                  })()}
                </div>
              )}
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

        {/* Tabs - Hidden only when catch-all is explicitly disabled */}
        {isCatchAllEnabled !== false && (
          <div className="bg-slate-950/50 p-1 rounded-lg flex mb-6">
            {['uuid', 'random', 'domain', 'custom'].map((tab) => {
              // Disable tabs only if catch-all is explicitly disabled (false)
              // Allow tabs for catch-all enabled (true) or unknown (null)
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
                  title={isCatchAllEnabled === null && tab !== 'uuid' && tab !== 'random' && !['domain', 'custom'].includes(tab) ? "Proceeding with caution - catch-all status is unknown" : ""}
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
          ) : isCatchAllEnabled === null ? (
            <>
              {/* Unknown Catch-all Status Mode Label */}
              <div className="flex items-center gap-2 ml-1 group">
                <div className="w-2 h-2 bg-amber-400 rounded-full shadow-lg shadow-amber-400/50"></div>
                <label className="text-xs font-semibold text-amber-300">Catch-all Status Unknown</label>
                {/* Info icon with tooltip */}
                <div className="relative">
                  <button
                    type="button"
                    className="p-0.5 text-amber-400/60 hover:text-amber-400 transition-colors"
                    title="Unable to fetch catch-all status from Addy.io. If you have catch-all enabled for this domain, you can safely generate a custom email below."
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                  </button>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 border border-slate-700 rounded-lg p-2 w-48 text-xs text-slate-200 z-10 pointer-events-none">
                    <p>Unable to fetch catch-all status from Addy.io. If you have catch-all enabled for this domain, you can safely generate a custom email below.</p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
              </div>

              {/* Normal alias generation UI with warning */}
              <label className="text-xs font-medium text-slate-400 ml-1">Generated Alias</label>

              <div className="relative group">
                <div className="absolute inset-0 bg-amber-500/5 rounded-xl blur-sm group-hover:bg-amber-500/10 transition-all"></div>
                <div className="relative flex items-center bg-slate-950 border border-amber-500/20 rounded-xl overflow-hidden transition-colors group-hover:border-amber-500/30">
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
