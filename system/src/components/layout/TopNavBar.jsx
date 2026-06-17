import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'
import { DeployAgentModal } from '../shared/DeployAgentModal'

export function TopNavBar() {
  const [showInstall, setShowInstall] = useState(false)
  const [showHelpMenu, setShowHelpMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAppearance, setShowAppearance] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const helpMenuRef = useRef(null)
  const userMenuRef = useRef(null)
  const notifRef = useRef(null)
  const navigate = useNavigate()
  const { user, isAdmin, switchUser, logout } = useAuth()
  const { notifications, unreadCount, showPanel, setShowPanel, markAsRead, markAllRead, clearAll, requestPermission, permission } = useNotifications()

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (helpMenuRef.current && !helpMenuRef.current.contains(e.target)) setShowHelpMenu(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
        setShowAppearance(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowPanel(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setShowPanel])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (permission === 'default') {
      requestPermission()
    }
  }, [permission, requestPermission])

  const handleSimulate = async () => {
    try {
      await api.post('/simulate-crash')
      navigate('/logs')
    } catch (e) { console.error(e) }
  }

  const handleDownload = () => {
    window.open('/v1/install.sh', '_blank')
  }

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const handleSwitchUser = async (userId) => {
    await switchUser(userId)
    setShowUserMenu(false)
  }

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'A'

  return (
    <header className="bg-surface-container-lowest border-b border-[#1e2022] fixed top-0 z-50 w-full">
      <div className="flex items-center justify-between px-8 h-16 max-w-[1280px] mx-auto">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
          <span className="text-[20px] font-bold text-on-surface-variant tracking-tight">OzyShield</span>
        </div>
        <nav className="hidden md:flex items-center justify-center gap-8 h-full">
          <NavLink to="/" end className={({ isActive }) =>
            `text-[14px] h-full flex items-center transition-colors ${isActive ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`
          }>Dashboard</NavLink>
          <NavLink to="/nodes" className={({ isActive }) =>
            `text-[14px] h-full flex items-center transition-colors ${isActive ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`
          }>Nodes</NavLink>
          <NavLink to="/logs" className={({ isActive }) =>
            `text-[14px] h-full flex items-center transition-colors ${isActive ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`
          }>Logs</NavLink>
          <NavLink to="/teams" className={({ isActive }) =>
            `text-[14px] h-full flex items-center transition-colors ${isActive ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`
          }>Teams</NavLink>
          <NavLink to="/settings" className={({ isActive }) =>
            `text-[14px] h-full flex items-center transition-colors ${isActive ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`
          }>Settings</NavLink>
        </nav>
        <div className="flex items-center gap-2">
          <div ref={notifRef} className="relative">
            <button onClick={() => setShowPanel(!showPanel)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors relative">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-error text-on-error text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showPanel && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container border border-[#1e2022] rounded-xl shadow-lg z-[100] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e2022] flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-on-surface">Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[11px] text-primary hover:text-primary/80 transition-colors">Mark all read</button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={clearAll} className="text-[11px] text-on-surface-variant hover:text-error transition-colors">Clear</button>
                    )}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant/30 block mb-2" style={{ fontSize: 32 }}>notifications_none</span>
                      <p className="text-[12px] text-on-surface-variant">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} onClick={() => markAsRead(n.id)}
                        className={`px-4 py-3 border-b border-[#1e2022] last:border-b-0 cursor-pointer hover:bg-surface-container-high transition-colors ${!n.read ? 'bg-primary/5' : ''}`}>
                        <div className="flex items-start gap-3">
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.severity === 'critical' ? 'bg-error' : n.type === 'invitation' ? 'bg-primary' : 'bg-tertiary'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-on-surface truncate">{n.title}</p>
                            <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">{n.body}</p>
                            <p className="text-[10px] text-on-surface-variant/60 mt-1">{new Date(n.timestamp).toLocaleTimeString()}</p>
                          </div>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={helpMenuRef} className="relative">
            <button onClick={() => { setShowHelpMenu(!showHelpMenu); setShowUserMenu(false) }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>help</span>
            </button>
            {showHelpMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-surface-container border border-[#1e2022] rounded-xl shadow-lg py-1 z-[100]">
                <a href="/DOCUMENTACION.md" target="_blank" rel="noopener noreferrer"
                  onClick={() => setShowHelpMenu(false)}
                  className="block px-4 py-2.5 text-[13px] text-on-surface hover:bg-surface-container-high transition-colors">Docs</a>
                <button onClick={() => { setShowHelpMenu(false); navigate('/settings') }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-on-surface hover:bg-surface-container-high transition-colors">Support</button>
                <button onClick={() => { setShowHelpMenu(false); handleDownload() }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-on-surface hover:bg-surface-container-high transition-colors">Download</button>
                <div className="border-t border-[#1e2022] my-1" />
                <button onClick={() => { setShowHelpMenu(false); setShowInstall(true) }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-on-surface hover:bg-surface-container-high transition-colors">Deploy Node</button>
                <button onClick={() => { setShowHelpMenu(false); handleSimulate() }}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-on-surface hover:bg-surface-container-high transition-colors">Simulate Incident</button>
              </div>
            )}
          </div>

          <div ref={userMenuRef} className="relative">
            <button onClick={() => { setShowUserMenu(!showUserMenu); setShowHelpMenu(false) }}
              className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white text-[14px] font-medium hover:opacity-90 transition-opacity">
              {userInitial}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-surface-container border border-[#1e2022] rounded-xl shadow-lg py-1 z-[100]">
                <div className="px-4 py-3 border-b border-[#1e2022]">
                  <p className="text-[14px] font-medium text-on-surface">{user?.name || 'Admin'}</p>
                  <p className="text-[12px] text-on-surface-variant">{user?.email || 'admin@ozyshield.local'}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${user?.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-tertiary/10 text-tertiary'}`}>
                    {user?.role || 'admin'}
                  </span>
                </div>
                {isAdmin && (
                  <div className="px-4 py-2 border-b border-[#1e2022]">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium mb-2">Switch User (Demo)</p>
                    <div className="space-y-1">
                      <button onClick={() => handleSwitchUser('admin-001')}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-surface-container-high transition-colors text-left">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center">A</span>
                        <span className="text-on-surface">Admin (Full Access)</span>
                      </button>
                      <button onClick={() => handleSwitchUser('user-sre-001')}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-surface-container-high transition-colors text-left">
                        <span className="w-5 h-5 rounded-full bg-tertiary/20 text-tertiary text-[9px] font-bold flex items-center justify-center">S</span>
                        <span className="text-on-surface">SRE Member</span>
                      </button>
                      <button onClick={() => handleSwitchUser('user-security-001')}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-surface-container-high transition-colors text-left">
                        <span className="w-5 h-5 rounded-full bg-error/20 text-error text-[9px] font-bold flex items-center justify-center">C</span>
                        <span className="text-on-surface">Security Member</span>
                      </button>
                    </div>
                  </div>
                )}
                <div className="relative">
                  <button onClick={() => setShowAppearance(!showAppearance)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-on-surface hover:bg-surface-container-high transition-colors">
                    Appearance
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                  </button>
                  {showAppearance && (
                    <div className="absolute left-full top-0 ml-1 w-40 bg-surface-container border border-[#1e2022] rounded-xl shadow-lg py-1">
                      {['dark', 'light', 'system'].map(t => (
                        <button key={t} onClick={() => { setTheme(t); setShowAppearance(false); setShowUserMenu(false) }}
                          className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-surface-container-high transition-colors capitalize ${theme === t ? 'text-primary' : 'text-on-surface'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t border-[#1e2022] my-1" />
                <button onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-[13px] text-on-surface hover:bg-surface-container-high transition-colors">Log out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DeployAgentModal open={showInstall} onClose={() => setShowInstall(false)} />
    </header>
  )
}
