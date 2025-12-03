import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'


import { generateAlias as generateAliasString, DEFAULT_CUSTOM_RULE, type CustomRule } from './lib/aliasGenerator'
import { Shield, Settings, RefreshCw, Star, Crown } from 'lucide-react'
import { cn } from './lib/utils'




function App() {
  // Data State
  const [userData, setUserData] = useState<any>(null)
  const [hasToken, setHasToken] = useState(false)
  const [currentUrl, setCurrentUrl] = useState('')
  const [generatedAlias, setGeneratedAlias] = useState('')
  const [activeTab, setActiveTab] = useState('uuid')
  const [autoCopy, setAutoCopy] = useState(true)
  const [customRule, setCustomRule] = useState<CustomRule>(DEFAULT_CUSTOM_RULE)
  const [defaultDomain, setDefaultDomain] = useState('anonaddy.com')

  // License State
  const [isPro, setIsPro] = useState(false)



  // Load initial state
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['addyToken', 'userData', 'licenseKey', 'isPro', 'autoCopy', 'customRule', 'defaultFormat', 'defaultDomain'], (result) => {
        if (result.addyToken) {
          setHasToken(true)
          if (result.userData) setUserData(result.userData)
        } else {
          setHasToken(false)
        }
        // Removed auto-open settings logic

        if (result.licenseKey) {
          setIsPro(!!result.isPro)
        }

        if (result.autoCopy !== undefined) {
          setAutoCopy(!!result.autoCopy)
        }

        if (result.defaultFormat) {
          setActiveTab(result.defaultFormat as string)
        }

        if (result.customRule) {
          setCustomRule(result.customRule as CustomRule)
        }

        if (result.defaultDomain) {
          setDefaultDomain(result.defaultDomain as string)
        }
      })

      // Get current tab URL
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          setCurrentUrl(tabs[0].url)
        }
      })
    } else {
      // Dev mode fallback
      const saved = localStorage.getItem('addyToken')
      if (saved) {
        setHasToken(true)
        setUserData({ username: 'dev_user' })
      }

      setCurrentUrl('https://netflix.com/signup')
      setIsPro(localStorage.getItem('isPro') === 'true')
    }
  }, [])

  // Generate alias when tab or url changes
  useEffect(() => {
    generateAlias()
  }, [activeTab, currentUrl, userData, customRule])

  // Save autoCopy preference
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ autoCopy })
    }
  }, [autoCopy])

  const generateAlias = () => {
    if (!userData) return

    // const domain = 'anonaddy.com' // Removed hardcoded domain
    // Note: In a real scenario, we should use the selected default domain from settings if available.
    // However, the current App.tsx doesn't load defaultDomain. Let's assume 'anonaddy.com' for now or update to load it.

    // Let's use the shared generator
    const alias = generateAliasString({
      type: activeTab,
      domain: defaultDomain,
      username: userData.username,
      currentUrl: currentUrl,
      customRule: customRule
    })

    setGeneratedAlias(alias)
  }

  const handleCopyAndFill = async () => {
    try {
      await navigator.clipboard.writeText(generatedAlias)

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: (email) => {
              // Try to find the active element first
              let activeElement = document.activeElement as HTMLInputElement;

              // If active element is body or not an input, try to find the first email input
              if (!activeElement || activeElement === document.body || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')) {
                const emailInput = document.querySelector('input[type="email"]');
                if (emailInput) {
                  activeElement = emailInput as HTMLInputElement;
                } else {
                  // Fallback to any visible input
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

  const openSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      console.log('Open Settings Page');
    }
  }

  const handleTabChange = (value: string) => {
    if ((value === 'domain' || value === 'custom') && !isPro) {
      openSettings() // Direct to settings/upgrade page
      return
    }
    setActiveTab(value)
  }

  // Main View
  if (!hasToken) {
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
              Please configure your Addy.io API key in settings to start generating aliases.
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

        {/* Domain Badge */}


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
      <div className="space-y-3 mt-auto mb-2 px-5">
        <Button
          className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 rounded-xl text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          onClick={handleCopyAndFill}
        >
          Copy & Fill
        </Button>
        <Button
          variant="secondary"
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 h-12 rounded-xl text-sm font-medium border border-slate-700/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          onClick={() => navigator.clipboard.writeText(generatedAlias)}
        >
          Copy Only
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
