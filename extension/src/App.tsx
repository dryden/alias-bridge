import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'
import { Label } from './components/ui/label'
import { Switch } from './components/ui/switch'
import { getDomainFromUrl, generateUUIDAlias, generateRandomAlias, generateDomainAlias } from './lib/domain'
import { Shield, Settings, RefreshCw, Link as LinkIcon, Star } from 'lucide-react'
import { cn } from './lib/utils'

function App() {
  // Data State
  const [userData, setUserData] = useState<any>(null)
  const [currentUrl, setCurrentUrl] = useState('')
  const [generatedAlias, setGeneratedAlias] = useState('')
  const [activeTab, setActiveTab] = useState('uuid')
  const [autoCopy, setAutoCopy] = useState(true)

  // License State
  const [isPro, setIsPro] = useState(false)

  // Load initial state
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['addyToken', 'userData', 'licenseKey', 'isPro', 'autoCopy'], (result) => {
        if (result.addyToken) {
          if (result.userData) setUserData(result.userData)
        }
        // Removed auto-open settings logic

        if (result.licenseKey) {
          setIsPro(!!result.isPro)
        }

        if (result.autoCopy !== undefined) {
          setAutoCopy(!!result.autoCopy)
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
        setUserData({ username: 'dev_user' })
      }

      setCurrentUrl('https://netflix.com/signup')
      setIsPro(localStorage.getItem('isPro') === 'true')
    }
  }, [])

  // Generate alias when tab or url changes
  useEffect(() => {
    generateAlias()
  }, [activeTab, currentUrl, userData])

  // Save autoCopy preference
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ autoCopy })
    }
  }, [autoCopy])

  const generateAlias = () => {
    if (!userData) return

    const domain = 'anonaddy.com' // Should come from user settings/data
    let alias = ''

    switch (activeTab) {
      case 'uuid':
        alias = generateUUIDAlias(domain)
        break
      case 'random':
        alias = generateRandomAlias(domain)
        break
      case 'domain':
        alias = generateDomainAlias(currentUrl, userData.username, domain)
        break
      case 'custom':
        alias = `custom.${getDomainFromUrl(currentUrl)}@${userData.username}.${domain}`
        break
    }
    setGeneratedAlias(alias)
  }

  const handleCopyAndFill = async () => {
    try {
      await navigator.clipboard.writeText(generatedAlias)

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (email) => {
              const activeElement = document.activeElement as HTMLInputElement;
              if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.value = email;
                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                activeElement.dispatchEvent(new Event('change', { bubbles: true }));
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
  return (
    <div className="w-[350px] bg-slate-950 min-h-[500px] p-5 flex flex-col font-sans text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-center relative mb-8 mt-2">
        <div className="absolute left-0">
          <Shield className="w-6 h-6 text-slate-400" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">Alias Bridge</h1>
      </div>

      {/* Main Card */}
      <div className="bg-slate-900 rounded-2xl p-4 shadow-lg border border-slate-800/50 mb-6">
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
              {tab}
              {/* Lock icon for pro features */}
              {['domain', 'custom'].includes(tab) && !isPro && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500/50 rounded-full"></span>
              )}
            </button>
          ))}
        </div>

        {/* Domain Badge */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-950/30 border border-blue-900/30 text-blue-400 text-xs font-medium">
            <LinkIcon className="w-3 h-3" />
            <span>For {getDomainFromUrl(currentUrl) || 'current page'}</span>
          </div>
        </div>

        {/* Generated Alias Input */}
        <div className="space-y-2 mb-2">
          <label className="text-xs font-medium text-slate-400 ml-1">Generated Alias</label>
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500/5 rounded-xl blur-sm group-hover:bg-blue-500/10 transition-all"></div>
            <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden transition-colors group-hover:border-slate-700">
              <input
                type="text"
                value={generatedAlias}
                readOnly
                className="w-full bg-transparent border-none py-3.5 pl-4 pr-10 text-sm font-mono text-slate-200 focus:ring-0 placeholder:text-slate-600"
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
      <div className="space-y-3 mt-auto mb-8">
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
      <div className="flex items-center justify-between text-slate-500 mt-auto pt-4">
        <div className="flex items-center space-x-2">
          <Switch id="auto-copy" checked={autoCopy} onCheckedChange={setAutoCopy} className="data-[state=checked]:bg-blue-600" />
          <Label htmlFor="auto-copy" className="text-xs text-slate-400">Auto-copy</Label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openSettings}
            className="p-2 hover:text-white transition-colors rounded-lg hover:bg-slate-900"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs font-medium text-amber-500/80">
            <Star className="w-3.5 h-3.5 fill-amber-500/20" />
            <span>v1.2.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
