import { useState, useEffect } from 'react'

export function DeployAgentModal({ open, onClose }) {
  const [os, setOs] = useState('linux')
  const [copied, setCopied] = useState(false)
  const [server, setServer] = useState('YOUR_SERVER')
  const [token, setToken] = useState('')
  const [tokenStatus, setTokenStatus] = useState('empty')
  const [tokenCopied, setTokenCopied] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      setCopied(false)
      setTokenCopied(false)
      setTokenStatus('loading')

      const storedToken = localStorage.getItem('ozyshield_token')
      if (storedToken) {
        setToken(storedToken)
        setTokenStatus('ready')
      } else {
        setTokenStatus('error')
      }
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const fetchToken = () => {
    setTokenStatus('loading')
    const storedToken = localStorage.getItem('ozyshield_token')
    if (storedToken) {
      setToken(storedToken)
      setTokenStatus('ready')
    } else {
      setTokenStatus('error')
    }
  }

  const copyToken = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = token
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  if (!open) return null

  const linuxCmd = `curl -fsSL http://${server}:8080/v1/install.sh | bash -s -- --token ${token || 'YOUR_TOKEN'}`
  const windowsCmd = `powershell -Command "iwr -Uri http://${server}:8080/v1/install.ps1 -OutFile install.ps1; .\\install.ps1 -Token '${token || 'YOUR_TOKEN'}'"`
  const cmd = os === 'linux' ? linuxCmd : windowsCmd

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = cmd
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center border border-primary-container/20">
              <span className="material-symbols-outlined text-primary">download</span>
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-on-surface">Deploy OzyShield Agent</h3>
              <p className="text-[12px] text-on-surface-variant">Install on your server</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setOs('linux')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${os === 'linux' ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-surface-container-high text-on-surface-variant border border-[#1e2022] hover:bg-surface-variant'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
            Linux / macOS
          </button>
          <button onClick={() => setOs('windows')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${os === 'windows' ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-surface-container-high text-on-surface-variant border border-[#1e2022] hover:bg-surface-variant'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>computer</span>
            Windows
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] text-on-surface-variant font-medium block mb-1.5">Server Address</label>
            <input value={server} onChange={e => setServer(e.target.value)}
              className="w-full bg-background border border-[#1e2022] text-on-surface rounded-lg px-3 py-2 text-[13px] font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              placeholder="e.g. 192.168.1.100" />
          </div>
          <div className="min-w-0">
            <label className="text-[11px] text-on-surface-variant font-medium block mb-1.5">Auth Token</label>
            <div className="flex gap-1.5 overflow-hidden">
              <input value={token} onChange={e => { setToken(e.target.value); setTokenStatus(token ? 'ready' : 'empty') }}
                className={`min-w-0 flex-1 bg-background border text-on-surface rounded-lg px-3 py-2 text-[13px] font-mono outline-none transition-all ${
                  tokenStatus === 'error' ? 'border-error/50 text-error' :
                  token ? 'border-primary/50 text-primary' :
                  'border-[#1e2022] focus:border-primary focus:ring-1 focus:ring-primary'
                }`}
                placeholder={tokenStatus === 'loading' ? 'Loading...' : tokenStatus === 'error' ? 'Not available' : 'Enter or fetch token'}
                readOnly={tokenStatus === 'loading'} />
              <button onClick={fetchToken} disabled={tokenStatus === 'loading'}
                className={`px-2 py-2 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 flex-shrink-0 ${
                  tokenStatus === 'loading' ? 'bg-surface-variant text-on-surface-variant cursor-wait' :
                  token ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30' :
                  'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant border border-[#1e2022]'
                }`}>
                {tokenStatus === 'loading' ? (
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>refresh</span>
                ) : token ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>key_off</span>
                )}
                {tokenStatus === 'loading' ? '' : token ? '' : ''}
              </button>
            </div>
            {token && (
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={copyToken}
                  className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{tokenCopied ? 'check' : 'content_copy'}</span>
                  {tokenCopied ? 'Copied!' : 'Copy token'}
                </button>
                <span className="text-[11px] text-on-surface-variant/40">|</span>
                <button onClick={() => { setToken(''); setTokenStatus('empty') }}
                  className="text-[11px] text-on-surface-variant hover:text-error transition-colors">
                  Clear
                </button>
              </div>
            )}
            {tokenStatus === 'error' && (
              <p className="text-[11px] text-error mt-1.5">No active session. Please login first to use the token.</p>
            )}
          </div>
        </div>

        <div className="bg-black border border-[#1e2022] rounded-lg p-4 relative">
          <code className="text-[13px] text-primary break-all leading-relaxed font-mono block pr-10">{cmd}</code>
          <button onClick={handleCopy}
            className="absolute top-3 right-3 p-2 rounded-md bg-surface-container-high hover:bg-surface-container-highest transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>{copied ? 'check' : 'content_copy'}</span>
          </button>
        </div>
        {copied && <p className="text-[12px] text-green-400 mt-2">Copied to clipboard!</p>}

        <div className="mt-4 p-3 rounded-lg bg-surface-container-low border border-[#1e2022]">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: 16 }}>info</span>
            <div className="text-[12px] text-on-surface-variant">
              {os === 'linux' ? (
                <p>Requires <span className="text-on-surface font-medium">curl</span> and <span className="text-on-surface font-medium">bash</span>. Works on Ubuntu, Debian, CentOS, Fedora, and macOS.</p>
              ) : (
                <p>Requires <span className="text-on-surface font-medium">PowerShell 5.1+</span>. Run as Administrator for system-wide installation.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
