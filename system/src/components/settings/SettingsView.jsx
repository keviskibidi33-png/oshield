import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { api } from '../../lib/api'
import { DeployAgentModal } from '../shared/DeployAgentModal'

function Toggle({ enabled, onChange }) {
  return (
    <button onClick={onChange}
      className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ${enabled ? 'bg-primary-container' : 'bg-surface-variant'}`}>
      <div className={`w-5 h-5 bg-on-surface rounded-full shadow-md transform transition-transform duration-200 ${enabled ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function SettingsView() {
  const { user, isAdmin, config } = useAuth()
  const { permission, requestPermission } = useNotifications()
  const [activeSection, setActiveSection] = useState('server')
  const [showDeploy, setShowDeploy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [showToken, setShowToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)

  const [serverConfig, setServerConfig] = useState({
    port: '8080',
    enableRegister: false,
    seedData: false,
    defaultRole: 'member',
    reoccurrenceWindowMin: 1,
  })

  const [authConfig, setAuthConfig] = useState({
    authToken: '••••••••••••••••',
    adminEmail: user?.email || '',
  })

  const [notifConfig, setNotifConfig] = useState({
    desktopAlerts: permission === 'granted',
    criticalOnly: true,
    soundEnabled: true,
  })

  useEffect(() => {
    if (config) {
      setServerConfig(prev => ({
        ...prev,
        enableRegister: config.registration_enabled ?? false,
        defaultRole: config.default_role || 'member',
      }))
    }
  }, [config])

  useEffect(() => {
    api.get('/teams').then(setTeams).catch(() => {})
    api.get('/users').then(setUsers).catch(() => {})
  }, [])

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleNotifPermission = async () => {
    const p = await requestPermission()
    setNotifConfig(prev => ({ ...prev, desktopAlerts: p === 'granted' }))
  }

  const sections = [
    { id: 'server', icon: 'dns', label: 'Server' },
    { id: 'auth', icon: 'lock', label: 'Authentication' },
    { id: 'agent', icon: 'shield', label: 'Agent Deploy' },
    { id: 'notifications', icon: 'notifications', label: 'Notifications' },
    { id: 'about', icon: 'info', label: 'About' },
  ]

  return (
    <div className="max-w-[1280px] mx-auto flex flex-1 overflow-hidden h-full">
      <aside className="w-64 bg-transparent border-r border-[#1e2022] hidden md:flex flex-col h-full p-4 gap-1">
        <div className="px-3 py-4 mb-2">
          <p className="text-[12px] text-on-surface-variant uppercase tracking-widest font-medium">Configuration</p>
        </div>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-3 px-4 py-3 transition-colors duration-150 cursor-pointer rounded-lg ${activeSection === s.id ? 'text-primary bg-primary/5' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{s.icon}</span>
            <span className="text-[12px] font-medium">{s.label}</span>
          </button>
        ))}
        <div className="mt-auto border-t border-[#1e2022] pt-4">
          <div className="px-4 py-3">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium mb-2">System</p>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Teams</span>
                <span className="text-on-surface font-medium">{teams.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Users</span>
                <span className="text-on-surface font-medium">{users.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Role</span>
                <span className={`font-medium ${user?.role === 'admin' ? 'text-primary' : 'text-tertiary'}`}>{user?.role}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-surface-dim relative">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 opacity-10 pointer-events-none">
          <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        </div>
        <div className="px-8 pt-8 pb-12 space-y-8 relative z-10">

          {activeSection === 'server' && (
            <>
              <header className="space-y-1">
                <h2 className="text-[30px] font-semibold text-on-surface">Server Settings</h2>
                <p className="text-[14px] text-on-surface-variant">Configure server behavior and access policies.</p>
              </header>

              <section className="bg-surface-container border border-[#1e2022]/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#1e2022]/30 bg-surface-container-low flex justify-between items-center">
                  <div>
                    <h3 className="text-[20px] font-semibold text-on-surface">Access Control</h3>
                    <p className="text-[12px] text-on-surface-variant">Manage registration and default user settings.</p>
                  </div>
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-[#1e2022]/20">
                    <div className="space-y-1">
                      <h4 className="text-[16px] text-on-surface font-semibold">Public Registration</h4>
                      <p className="text-[14px] text-on-surface-variant">Allow new users to register without admin invitation.</p>
                    </div>
                    <Toggle enabled={serverConfig.enableRegister} onChange={() => setServerConfig(prev => ({ ...prev, enableRegister: !prev.enableRegister }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[12px] text-on-surface-variant font-medium">Server Port</label>
                      <input value={serverConfig.port} disabled
                        className="w-full bg-background border border-[#1e2022] text-on-surface-variant rounded-lg px-4 py-2.5 text-[14px] cursor-not-allowed opacity-60" />
                      <p className="text-[11px] text-on-surface-variant">Change via OZY_PORT env var</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] text-on-surface-variant font-medium">Default Role</label>
                      <select value={serverConfig.defaultRole} disabled
                        className="w-full bg-background border border-[#1e2022] text-on-surface-variant rounded-lg px-4 py-2.5 text-[14px] cursor-not-allowed opacity-60">
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <p className="text-[11px] text-on-surface-variant">Change via OZY_DEFAULT_ROLE env var</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-surface-container border border-[#1e2022]/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#1e2022]/30 bg-surface-container-low flex justify-between items-center">
                  <div>
                    <h3 className="text-[20px] font-semibold text-on-surface">Data Management</h3>
                    <p className="text-[12px] text-on-surface-variant">Control seed data and retention.</p>
                  </div>
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>database</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-[#1e2022]/20">
                    <div className="space-y-1">
                      <h4 className="text-[16px] text-on-surface font-semibold">Seed Demo Data</h4>
                      <p className="text-[14px] text-on-surface-variant">Load sample nodes and incidents on next startup.</p>
                    </div>
                    <Toggle enabled={serverConfig.seedData} onChange={() => setServerConfig(prev => ({ ...prev, seedData: !prev.seedData }))} />
                  </div>
                </div>
              </section>

              <section className="bg-surface-container border border-[#1e2022]/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#1e2022]/30 bg-surface-container-low flex justify-between items-center">
                  <div>
                    <h3 className="text-[20px] font-semibold text-on-surface">Incident Management</h3>
                    <p className="text-[12px] text-on-surface-variant">Configure reoccurrence detection behavior.</p>
                  </div>
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>replay</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-[#1e2022]/20">
                    <div className="space-y-1">
                      <h4 className="text-[16px] text-on-surface font-semibold">Reoccurrence Window</h4>
                      <p className="text-[14px] text-on-surface-variant">If the same error occurs within this window after resolution, the incident is reopened instead of creating a new one.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={serverConfig.reoccurrenceWindowMin}
                        onChange={(e) => setServerConfig(prev => ({ ...prev, reoccurrenceWindowMin: parseInt(e.target.value) || 1 }))}
                        className="w-20 bg-background border border-[#1e2022] text-on-surface rounded-lg px-3 py-2 text-[14px] text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      />
                      <span className="text-[13px] text-on-surface-variant">min</span>
                    </div>
                  </div>
                  <div className="p-4 bg-primary-container/10 border border-primary-container/20 rounded-lg flex gap-3 items-start">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>info</span>
                    <div>
                      <p className="text-[13px] text-primary font-semibold">How it works</p>
                      <p className="text-[12px] text-on-surface-variant">When an error matches a resolved incident's log signature within this time window, the original incident is reopened with a "Reopened" badge instead of creating a duplicate.</p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeSection === 'auth' && (
            <>
              <header className="space-y-1">
                <h2 className="text-[30px] font-semibold text-on-surface">Authentication</h2>
                <p className="text-[14px] text-on-surface-variant">Manage API tokens and admin credentials.</p>
              </header>

              <section className="bg-surface-container border border-[#1e2022]/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#1e2022]/30 bg-surface-container-low flex justify-between items-center">
                  <div>
                    <h3 className="text-[20px] font-semibold text-on-surface">API Token</h3>
                    <p className="text-[12px] text-on-surface-variant">Bearer token for dashboard API access.</p>
                  </div>
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>vpn_key</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="p-4 bg-black/40 border border-[#1e2022]/30 rounded-lg">
                    <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium block mb-2">Current Token</label>
                    <div className="flex items-center gap-3">
                      <code className="text-[14px] text-primary font-mono flex-1 select-all">
                        {showToken ? (localStorage.getItem('ozyshield_token') || '••••••••••••••••••••••••••••••••') : '••••••••••••••••••••••••••••••••'}
                      </code>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setShowToken(!showToken)}
                          className="p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
                          title={showToken ? 'Hide token' : 'Show token'}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showToken ? 'visibility_off' : 'visibility'}</span>
                        </button>
                        <button onClick={() => {
                            const token = localStorage.getItem('ozyshield_token') || ''
                            navigator.clipboard.writeText(token)
                            setTokenCopied(true)
                            setTimeout(() => setTokenCopied(false), 2000)
                          }}
                          className="p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
                          title="Copy token">
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{tokenCopied ? 'check' : 'content_copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-error-container/10 border border-error/20 rounded-lg flex gap-3 items-start">
                    <span className="material-symbols-outlined text-error" style={{ fontSize: 20 }}>warning</span>
                    <div>
                      <p className="text-[13px] text-error font-semibold">Security Notice</p>
                      <p className="text-[12px] text-on-error-container">Tokens are stored as environment variables and never exposed in the UI. Change OZY_AUTH_TOKEN in your .env file to rotate.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-surface-container border border-[#1e2022]/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#1e2022]/30 bg-surface-container-low flex justify-between items-center">
                  <div>
                    <h3 className="text-[20px] font-semibold text-on-surface">Admin Account</h3>
                    <p className="text-[12px] text-on-surface-variant">Current administrator credentials.</p>
                  </div>
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[12px] text-on-surface-variant font-medium">Email</label>
                      <input value={authConfig.adminEmail} disabled
                        className="w-full bg-background border border-[#1e2022] text-on-surface-variant rounded-lg px-4 py-2.5 text-[14px] cursor-not-allowed opacity-60" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] text-on-surface-variant font-medium">Password</label>
                      <input type="password" value="••••••••" disabled
                        className="w-full bg-background border border-[#1e2022] text-on-surface-variant rounded-lg px-4 py-2.5 text-[14px] cursor-not-allowed opacity-60" />
                    </div>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-3">Change via OZY_ADMIN_EMAIL and OZY_ADMIN_PASSWORD env vars.</p>
                </div>
              </section>
            </>
          )}

          {activeSection === 'agent' && (
            <>
              <header className="space-y-1">
                <h2 className="text-[30px] font-semibold text-on-surface">Agent Deployment</h2>
                <p className="text-[14px] text-on-surface-variant">Deploy monitoring agents to your infrastructure.</p>
              </header>

              <section className="bg-surface-container border border-[#1e2022]/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#1e2022]/30 bg-surface-container-low flex justify-between items-center">
                  <div>
                    <h3 className="text-[20px] font-semibold text-on-surface">Install Agent</h3>
                    <p className="text-[12px] text-on-surface-variant">One-line install for Linux, macOS, or Windows.</p>
                  </div>
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
                </div>
                <div className="p-6">
                  <button onClick={() => setShowDeploy(true)}
                    className="w-full flex items-center justify-between p-5 bg-primary-container text-on-primary-container rounded-xl hover:brightness-110 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-on-primary-container/10 flex items-center justify-center">
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>terminal</span>
                      </div>
                      <div className="text-left">
                        <p className="text-[16px] font-semibold">Open Deploy Wizard</p>
                        <p className="text-[13px] opacity-80">Choose OS and get the install command</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </button>
                </div>
              </section>

              <section className="bg-surface-container border border-[#1e2022]/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#1e2022]/30 bg-surface-container-low">
                  <h3 className="text-[20px] font-semibold text-on-surface">Supported Platforms</h3>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4">
                  {[
                    { os: 'Ubuntu / Debian', img: '/images/platforms/ubuntulog.png', cmd: 'curl + bash' },
                    { os: 'CentOS / Fedora', img: '/images/platforms/centlog.png', cmd: 'curl + bash' },
                    { os: 'macOS', img: '/images/platforms/macoslog.png', cmd: 'curl + bash' },
                    { os: 'Windows Server', img: '/images/platforms/winlog.png', cmd: 'PowerShell' },
                  ].map(p => (
                    <div key={p.os} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low border border-[#1e2022]/20">
                      <img src={p.img} alt={p.os} className="w-8 h-8 rounded object-contain" />
                      <div>
                        <p className="text-[13px] font-medium text-on-surface">{p.os}</p>
                        <p className="text-[11px] text-on-surface-variant">{p.cmd}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeSection === 'notifications' && (
            <>
              <header className="space-y-1">
                <h2 className="text-[30px] font-semibold text-on-surface">Notifications</h2>
                <p className="text-[14px] text-on-surface-variant">Configure how you receive alerts.</p>
              </header>

              <section className="bg-surface-container border border-[#1e2022]/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-[#1e2022]/30 bg-surface-container-low flex justify-between items-center">
                  <div>
                    <h3 className="text-[20px] font-semibold text-on-surface">Desktop Alerts</h3>
                    <p className="text-[12px] text-on-surface-variant">Browser push notifications for critical incidents.</p>
                  </div>
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-[#1e2022]/20">
                    <div className="space-y-1">
                      <h4 className="text-[16px] text-on-surface font-semibold">Desktop Notifications</h4>
                      <p className="text-[14px] text-on-surface-variant">Show native OS notifications for new incidents.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] px-2 py-1 rounded ${permission === 'granted' ? 'bg-primary/10 text-primary' : permission === 'denied' ? 'bg-error/10 text-error' : 'bg-surface-variant text-on-surface-variant'}`}>
                        {permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : 'Not set'}
                      </span>
                      {permission !== 'granted' && (
                        <button onClick={handleNotifPermission}
                          className="px-3 py-1.5 bg-primary-container text-on-primary-container rounded-lg text-[12px] font-medium hover:brightness-110 transition-all">
                          Enable
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-[#1e2022]/20">
                    <div className="space-y-1">
                      <h4 className="text-[16px] text-on-surface font-semibold">Critical Only</h4>
                      <p className="text-[14px] text-on-surface-variant">Only notify for critical severity incidents.</p>
                    </div>
                    <Toggle enabled={notifConfig.criticalOnly} onChange={() => setNotifConfig(prev => ({ ...prev, criticalOnly: !prev.criticalOnly }))} />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-[#1e2022]/20">
                    <div className="space-y-1">
                      <h4 className="text-[16px] text-on-surface font-semibold">Sound</h4>
                      <p className="text-[14px] text-on-surface-variant">Play a sound when notifications arrive.</p>
                    </div>
                    <Toggle enabled={notifConfig.soundEnabled} onChange={() => setNotifConfig(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))} />
                  </div>
                </div>
              </section>
            </>
          )}

          {activeSection === 'about' && (
            <>
              <header className="space-y-1">
                <h2 className="text-[30px] font-semibold text-on-surface">About</h2>
                <p className="text-[14px] text-on-surface-variant">System information and version details.</p>
              </header>

              <section className="bg-surface-container border border-[#1e2022]/30 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-primary-container/10 flex items-center justify-center border border-primary-container/20">
                      <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1", fontSize: 28 }}>security</span>
                    </div>
                    <div>
                      <h3 className="text-[24px] font-bold text-on-surface">OzyShield</h3>
                      <p className="text-[14px] text-on-surface-variant">Zero Trust Security Monitoring Dashboard</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Version', value: '1.0.0' },
                      { label: 'Build', value: 'production' },
                      { label: 'Server', value: `localhost:${serverConfig.port}` },
                      { label: 'Nodes', value: `${users.length} users, ${teams.length} teams` },
                    ].map(item => (
                      <div key={item.label} className="p-3 rounded-lg bg-surface-container-low border border-[#1e2022]/20">
                        <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">{item.label}</p>
                        <p className="text-[14px] text-on-surface font-medium mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

        </div>
      </main>

      <DeployAgentModal open={showDeploy} onClose={() => setShowDeploy(false)} />
    </div>
  )
}
