import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card'
import { Label } from './components/ui/label'
import { verifyToken } from './services/addy'

function App() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [userData, setUserData] = useState<any>(null)

  const handleVerify = async () => {
    setStatus('loading')
    try {
      const data = await verifyToken(token)
      setUserData(data)
      setStatus('success')
      // Save to storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ addyToken: token })
      } else {
        localStorage.setItem('addyToken', token)
      }
    } catch (error) {
      console.error(error)
      setStatus('error')
    }
  }

  useEffect(() => {
    // Load token
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['addyToken'], (result: { addyToken?: string }) => {
        if (result.addyToken) setToken(result.addyToken)
      })
    } else {
      const saved = localStorage.getItem('addyToken')
      if (saved) setToken(saved)
    }
  }, [])

  return (
    <div className="w-[400px] p-4 bg-slate-50 min-h-screen flex items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Alias Bridge</CardTitle>
          <CardDescription>Connect your Addy.io account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">API Token</Label>
            <Input
              id="token"
              type="password"
              value={token}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
              placeholder="Paste your token here"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleVerify}
            disabled={status === 'loading' || !token}
          >
            {status === 'loading' ? 'Verifying...' : 'Connect & Verify'}
          </Button>

          {status === 'success' && (
            <div className="p-2 bg-green-100 text-green-700 rounded text-sm">
              Connected as {userData?.username || 'User'}
            </div>
          )}

          {status === 'error' && (
            <div className="p-2 bg-red-100 text-red-700 rounded text-sm">
              Verification failed. Please check your token.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default App
