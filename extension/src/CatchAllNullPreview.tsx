import { RefreshCw } from 'lucide-react'
import { cn } from './lib/utils'

export default function CatchAllNullPreview() {
  const isCatchAllEnabled = null // Simulate unknown catch-all status
  const generatedAlias = 'a1b2c3d4-e5f6-4789-a0bc-def123456789'
  const activeTab = 'uuid'
  const isPro = true

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
              <button
                className={cn(
                  "w-full h-9 rounded-lg border text-xs text-left pl-3 pr-3 flex items-center justify-between transition-colors gap-2",
                  "bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                )}
              >
                <span className="truncate flex-1">example.com</span>
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            </div>
            <button
              className={cn(
                "p-2 rounded-lg transition-colors",
                "text-slate-500 hover:text-white hover:bg-slate-800"
              )}
              title="Refresh domains"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs - Visible when catch-all is unknown */}
        {isCatchAllEnabled !== false && (
          <div className="bg-slate-950/50 p-1 rounded-lg flex mb-6">
            {['uuid', 'random', 'domain', 'custom'].map((tab) => {
              const isDisabledByPro = ['domain', 'custom'].includes(tab) && !isPro
              const isDisabled = isDisabledByPro

              return (
                <button
                  key={tab}
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
                  {['domain', 'custom'].includes(tab) && isDisabledByPro && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500/50 rounded-full"></span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Generated Alias Input - Unknown Catch-all State */}
        <div className="space-y-2 mb-2">
          {isCatchAllEnabled === null && (
            <>
              {/* Unknown Catch-all Status Mode Label */}
              <div className="flex items-center gap-2 ml-1">
                <div className="w-2 h-2 bg-amber-400 rounded-full shadow-lg shadow-amber-400/50"></div>
                <label className="text-xs font-semibold text-amber-300">Catch-all Status Unknown</label>
              </div>

              {/* Info message for unknown catch-all status */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-200 leading-relaxed">
                  Unable to fetch catch-all status from Addy.io. If you have catch-all enabled for this domain, you can safely generate a custom email below.
                </p>
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

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mt-auto mb-2 px-5">
        <button
          className={cn(
            "flex-1 h-12 rounded-xl text-sm font-semibold shadow-lg transition-all",
            "bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          Copy & Fill
        </button>
        <button
          className={cn(
            "w-12 h-12 rounded-xl border border-slate-700/50 transition-all flex items-center justify-center p-0",
            "bg-slate-800 hover:bg-slate-700 text-slate-200 hover:scale-[1.02] active:scale-[0.98]"
          )}
          title="Copy Only"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-slate-500 mt-auto pt-2 px-5 pb-3">
        <button
          className="p-2 hover:text-white transition-colors rounded-lg hover:bg-slate-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <div className="flex items-center gap-2 text-xs font-medium text-amber-500/80">
          <svg className="w-3.5 h-3.5 fill-amber-500/20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  )
}
