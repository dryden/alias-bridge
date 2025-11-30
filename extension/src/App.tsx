import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card'
import { Label } from './components/ui/label'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { Badge } from './components/ui/badge'
import { Switch } from './components/ui/switch'
import { verifyToken } from './services/addy'
import { verifyLicense } from './services/license'
import { getDomainFromUrl, generateUUIDAlias, generateRandomAlias, generateDomainAlias } from './lib/domain'

function App() {
  // Global State
  const [view, setView] = useState<'main' | 'settings' | 'upgrade'>('main')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  // Data State
  const [token, setToken] = useState('')
  const [userData, setUserData] = useState<any>(null)
  const [currentUrl, setCurrentUrl] = useState('')
  const [generatedAlias, setGeneratedAlias] = useState('')
  const [activeTab, setActiveTab] = useState('uuid')
  const [autoCopy, setAutoCopy] = useState(true)

  // License State
  const [isPro, setIsPro] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')
  const [licenseStatus, setLicenseStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle')

  // Load initial state
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['addyToken', 'userData', 'licenseKey', 'isPro', 'autoCopy'], (result) => {
        if (result.addyToken) {
          setToken(result.addyToken as string)
          setStatus('success')
          if (result.userData) setUserData(result.userData)
        } else {
          setView('settings') // Force settings if no token
        }

        if (result.licenseKey) {
          setLicenseKey(result.licenseKey as string)
          setIsPro(!!result.isPro)
          if (result.isPro) setLicenseStatus('valid')
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
        setToken(saved)
        setStatus('success')
        setUserData({ username: 'dev_user' })
      } else {
        setView('settings')
      }

      setCurrentUrl('https://netflix.com/signup')

      const savedLicense = localStorage.getItem('licenseKey')
      if (savedLicense) {
        setLicenseKey(savedLicense)
        setIsPro(localStorage.getItem('isPro') === 'true')
        if (localStorage.getItem('isPro') === 'true') setLicenseStatus('valid')
      }
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

  const handleVerify = async () => {
    setStatus('loading')
    try {
      const data = await verifyToken(token)
      setUserData(data)
      setStatus('success')
      setView('main')
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

  const handleLicenseVerify = async () => {
    setLicenseStatus('verifying')
    const result = await verifyLicense(licenseKey)

    if (result.valid) {
      setLicenseStatus('valid')
      setIsPro(true)
      setView('main') // Go back to main after success

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

      // Visual feedback could be added here
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  const handleTabChange = (value: string) => {
    if ((value === 'domain' || value === 'custom') && !isPro) {
      setView('upgrade')
      return
    }
    setActiveTab(value)
  }

  // --- VIEWS ---

  if (view === 'settings') {
    return (
      <div className="w-[350px] p-4 bg-slate-50 min-h-[400px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          {status === 'success' ? (
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setView('main')}>
              &larr; Back
            </Button>
          ) : <div className="w-8"></div>}
          <span className="font-semibold text-slate-900">Settings</span>
          <div className="w-8"></div>
        </div>

        <Card className="flex-1">
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="token">Addy.io API Token</Label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your token here"
              />
              <a href="https://app.addy.io/settings/api" target="_blank" className="text-xs text-blue-600 hover:underline block">
                Create new API token &rarr;
              </a>
            </div>

            <Button
              className="w-full bg-slate-900 hover:bg-slate-800"
              onClick={handleVerify}
              disabled={status === 'loading' || !token}
            >
              {status === 'loading' ? 'Verifying...' : 'Save & Verify'}
            </Button>

            {status === 'error' && (
              <div className="p-2 bg-red-100 text-red-700 rounded text-sm text-center">
                Verification failed. Check your token.
              </div>
            )}

            {status === 'success' && (
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Connected as:</span>
                  <Badge variant="outline">{userData?.username}</Badge>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Pro License</span>
                {isPro ? <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Active</Badge> : <Badge variant="secondary">Free</Badge>}
              </div>
              {!isPro && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setView('upgrade')}>
                  Enter License Key
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-center text-[10px] text-slate-400">
          Alias Bridge v1.0.0
        </div>
      </div>
    )
  }

  if (view === 'upgrade') {
    return (
      <div className="w-[350px] bg-slate-50 min-h-[400px] p-4 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setView('main')}>
            &larr; Back
          </Button>
          <span className="font-semibold text-slate-900">Upgrade to Pro</span>
          <div className="w-8"></div>
        </div>

        <Card className="flex-1 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">Unlock Premium Features</CardTitle>
            <CardDescription className="text-amber-700">
              Get access to Domain-based aliases, Custom formats, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-amber-800">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Domain-based Aliases
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Custom Formats
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Priority Support
              </li>
            </ul>

            <div className="space-y-2 pt-4">
              <Label htmlFor="license" className="text-amber-900">License Key</Label>
              <Input
                id="license"
                placeholder="Enter your Polar license key"
                className="bg-white border-amber-200"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
              />
            </div>

            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleLicenseVerify}
              disabled={licenseStatus === 'verifying' || !licenseKey}
            >
              {licenseStatus === 'verifying' ? 'Verifying...' : 'Activate License'}
            </Button>

            {licenseStatus === 'invalid' && (
              <div className="text-xs text-red-600 text-center">
                Invalid license key. Please try again.
              </div>
            )}

            <div className="text-center pt-2">
              <a href="#" className="text-xs text-amber-700 hover:underline">
                Don't have a key? Buy Lifetime Access
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main View
  return (
    <div className="w-[350px] bg-slate-50 min-h-[400px] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span className="font-semibold text-slate-900">Alias Bridge</span>
        </div>
        <div className="flex items-center gap-2">
          {isPro && (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200 text-[10px] px-1.5 py-0 h-5">
              PRO
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView('settings')}>
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} className="w-full flex-1" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="uuid" className="text-xs">UUID</TabsTrigger>
          <TabsTrigger value="random" className="text-xs">Rand</TabsTrigger>
          <TabsTrigger value="domain" className="text-xs relative">
            Dom
            {!isPro && <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>}
          </TabsTrigger>
          <TabsTrigger value="custom" className="text-xs relative">
            Cust
            {!isPro && <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>}
          </TabsTrigger>
        </TabsList>

        <div className="bg-white rounded-lg border p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Generated Alias</span>
            {getDomainFromUrl(currentUrl) && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {getDomainFromUrl(currentUrl)}
              </Badge>
            )}
          </div>
          <div className="relative">
            <Input
              value={generatedAlias}
              readOnly
              className="pr-8 font-mono text-sm bg-slate-50 border-slate-200"
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={generateAlias}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 h-10" onClick={handleCopyAndFill}>
            Copy & Fill
          </Button>
          <Button variant="secondary" className="w-full h-10" onClick={() => navigator.clipboard.writeText(generatedAlias)}>
            Copy Only
          </Button>
        </div>
      </Tabs>

      <div className="mt-auto pt-6 flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <Switch id="auto-copy" checked={autoCopy} onCheckedChange={setAutoCopy} />
          <Label htmlFor="auto-copy" className="text-xs text-slate-600">Auto-copy</Label>
        </div>
      </div>
    </div>
  )
}

export default App
