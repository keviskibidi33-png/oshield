import { useState, useCallback, useMemo, useEffect } from 'react'
import { usePolling } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext'

function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

function TeamDetail({ teamId }) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { addNotification, showDesktopNotification } = useNotifications()
  const [incidentFilter, setIncidentFilter] = useState('all')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')

  const anyModalOpen = showInvite || showAddMember

  useEffect(() => {
    if (anyModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [anyModalOpen])

  const fetchTeams = useCallback(() => api.get('/teams'), [])
  const fetchIncidents = useCallback(() => api.get('/incidents'), [])
  const fetchUsers = useCallback(() => api.get('/users'), [])
  const { data: teams, refetch: refetchTeams } = usePolling(fetchTeams)
  const { data: incidents } = usePolling(fetchIncidents, 3000)
  const { data: users } = usePolling(fetchUsers)

  const team = useMemo(() => {
    if (!teams) return null
    return teams.find(t => String(t.id) === String(teamId)) || null
  }, [teams, teamId])

  const teamIncidents = useMemo(() => {
    if (!incidents || !team) return []
    return incidents.filter(inc => inc.assigned_team === team.name)
  }, [incidents, team])

  const filteredIncidents = useMemo(() => {
    if (incidentFilter === 'all') return teamIncidents
    return teamIncidents.filter(inc => inc.status === incidentFilter)
  }, [teamIncidents, incidentFilter])

  const stats = useMemo(() => {
    const total = teamIncidents.length
    const resolved = teamIncidents.filter(i => i.status === 'resolved').length
    const acknowledged = teamIncidents.filter(i => i.status === 'acknowledged').length
    const critical = teamIncidents.filter(i => i.status === 'critical').length
    return { total, resolved, acknowledged, critical }
  }, [teamIncidents])

  const teamUsers = useMemo(() => {
    if (!users || !team) return []
    return users.filter(u => u.teams && u.teams.includes(team.name))
  }, [users, team])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    try {
      await api.post('/invitations', { email: inviteEmail, team_id: team.id })
      addNotification({ type: 'team', title: 'Invitation Sent', body: `Invitation sent to ${inviteEmail}`, severity: 'info' })
      showDesktopNotification('Invitation Sent', `Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setShowInvite(false)
    } catch (e) {
      addNotification({ type: 'error', title: 'Invitation Failed', body: e.message, severity: 'critical' })
    }
  }

  const handleAddMember = async () => {
    if (!selectedUser) return
    try {
      const user = users.find(u => String(u.id) === String(selectedUser))
      if (!user) return
      const updatedTeams = [...(user.teams || []), team.name]
      await api.put(`/users/${user.id}`, { teams: updatedTeams })
      addNotification({ type: 'team', title: 'Member Added', body: `${user.name} added to ${team.name}`, severity: 'info' })
      setSelectedUser('')
      setShowAddMember(false)
      refetchTeams()
    } catch (e) {
      addNotification({ type: 'error', title: 'Add Member Failed', body: e.message, severity: 'critical' })
    }
  }

  if (!team) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 pt-8 pb-12">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-surface-container rounded mb-4" />
          <div className="h-4 w-96 bg-surface-container rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 pt-8 pb-12">
      <button onClick={() => navigate('/teams')}
        className="flex items-center gap-1 text-on-surface-variant hover:text-primary text-[13px] mb-6 transition-colors">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Teams
      </button>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${team.color}20`, border: `1px solid ${team.color}40` }}>
            <span className="material-symbols-outlined" style={{ color: team.color, fontSize: 28 }}>group</span>
          </div>
          <div>
            <h1 className="text-[30px] font-semibold text-on-surface mb-1">{team.name}</h1>
            <p className="text-on-surface-variant text-[14px] mb-3">{team.description || 'No description'}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-on-surface/5 border border-[#1e2022] text-[12px] text-on-surface font-medium">
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>group</span>
                {teamUsers.length} Members
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-on-surface/5 border border-[#1e2022] text-[12px] text-on-surface font-medium">
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>receipt_long</span>
                {stats.total} Total Incidents
              </span>
              {stats.critical > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 border border-error/20 text-[12px] text-error font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  {stats.critical} Critical
                </span>
              )}
              {stats.resolved > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[12px] text-primary font-medium">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                  {stats.resolved} Resolved
                </span>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-medium text-[13px] hover:brightness-110 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>mail</span>
              Invite
            </button>
            <button onClick={() => setShowAddMember(true)}
              className="flex items-center gap-2 px-4 py-2 border border-[#1e2022] text-on-surface rounded-lg font-medium text-[13px] hover:bg-surface-container-high transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>
              Add Member
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-12 md:col-span-3 tonal-card p-5 rounded-xl flex flex-col justify-between hover:bg-surface-container-high transition-colors">
          <div>
            <span className="text-[12px] text-on-surface-variant flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>group</span>
              Team Members
            </span>
            <h3 className="text-[24px] font-semibold mt-4">{teamUsers.length}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e2022]">
            <span className="text-[12px] text-on-surface-variant">Active operators</span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 tonal-card p-5 rounded-xl flex flex-col justify-between hover:bg-surface-container-high transition-colors">
          <div>
            <span className="text-[12px] text-on-surface-variant flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
              Total Assigned
            </span>
            <h3 className="text-[24px] font-semibold mt-4">{stats.total}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e2022]">
            <span className="text-[12px] text-on-surface-variant">All time incidents</span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 tonal-card p-5 rounded-xl flex flex-col justify-between hover:bg-surface-container-high transition-colors">
          <div>
            <span className="text-[12px] text-on-surface-variant flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
              Resolved
            </span>
            <h3 className="text-[24px] font-semibold mt-4 text-primary">{stats.resolved}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e2022]">
            <div className="w-full h-1 bg-surface-dim rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 tonal-card p-5 rounded-xl flex flex-col justify-between hover:bg-surface-container-high transition-colors">
          <div>
            <span className="text-[12px] text-on-surface-variant flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>pending</span>
              In Progress
            </span>
            <h3 className="text-[24px] font-semibold mt-4 text-tertiary">{stats.acknowledged}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e2022]">
            <span className="text-[12px] text-on-surface-variant">{stats.critical} critical remaining</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4 tonal-card rounded-xl p-6 flex flex-col hover:bg-surface-container-high transition-colors">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>group</span>
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-on-surface">Team Members</h2>
              <p className="text-[12px] text-on-surface-variant">Operators in {team.name}</p>
            </div>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto max-h-[400px]">
            {teamUsers.length > 0 ? teamUsers.map(user => (
              <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low border border-[#1e2022] hover:bg-surface-container-high transition-colors">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-on-surface"
                  style={{ backgroundColor: `${team.color}30` }}>
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-on-surface truncate">{user.name}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">{user.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-on-surface/5 text-on-surface-variant'
                }`}>{user.role}</span>
              </div>
            )) : (
              <div className="text-center py-8 text-on-surface-variant text-[13px]">
                <span className="material-symbols-outlined block mb-2 text-on-surface-variant/30" style={{ fontSize: 32 }}>group</span>
                No members in this team
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 md:col-span-8 tonal-card rounded-xl overflow-hidden flex flex-col hover:bg-surface-container-high transition-colors">
          <div className="px-6 py-4 border-b border-[#1e2022] bg-surface-container-low flex justify-between items-center">
            <h3 className="text-[12px] uppercase tracking-widest text-on-surface-variant font-medium">Incident Activity</h3>
            <div className="flex items-center gap-2">
              {['all', 'critical', 'acknowledged', 'resolved', 'annulled'].map(f => (
                <button key={f} onClick={() => setIncidentFilter(f)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    incidentFilter === f
                      ? f === 'critical' ? 'bg-error/10 text-error' : f === 'resolved' ? 'bg-primary/10 text-primary' : f === 'acknowledged' ? 'bg-tertiary/10 text-tertiary' : f === 'annulled' ? 'bg-on-surface/5 text-on-surface-variant' : 'bg-on-surface/5 text-on-surface'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              <span className="text-[11px] text-on-surface-variant ml-2">{filteredIncidents.length} events</span>
            </div>
          </div>
          {filteredIncidents.length > 0 ? (
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-px bg-[#1e2022]" />
              {filteredIncidents.map((inc) => (
                <div key={inc.id} className="relative px-6 py-4 flex items-start gap-4 hover:bg-surface-container-high transition-colors cursor-pointer border-b border-[#1e2022] last:border-b-0"
                  onClick={() => navigate(`/incidents/${inc.id}`)}>
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    inc.status === 'critical' ? 'bg-error/20 border border-error/40' :
                    inc.status === 'resolved' ? 'bg-primary/20 border border-primary/40' :
                    inc.status === 'annulled' ? 'bg-on-surface/5 border border-[#1e2022]' :
                    'bg-tertiary/10 border border-tertiary/20'
                  }`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: inc.status === 'critical' ? 'var(--color-error)' : inc.status === 'resolved' ? 'var(--color-primary)' : inc.status === 'annulled' ? 'var(--color-on-surface-variant)' : 'var(--color-tertiary)' }}>
                      {inc.status === 'critical' ? 'warning' : inc.status === 'resolved' ? 'check_circle' : inc.status === 'annulled' ? 'block' : 'info'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-medium text-on-surface">{inc.node_id}</span>
                      <span className="text-on-surface-variant opacity-30">/</span>
                      <span className="text-[12px] text-on-surface-variant">{inc.service}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        inc.status === 'critical' ? 'text-error bg-error/10' :
                        inc.status === 'resolved' ? 'text-primary bg-primary/10' :
                        inc.status === 'annulled' ? 'text-on-surface-variant bg-on-surface/5' :
                        'text-tertiary bg-tertiary/10'
                      }`}>{inc.status}</span>
                      <span className="text-[11px] text-on-surface-variant">{timeAgo(inc.timestamp)}</span>
                    </div>
                    <p className="text-[13px] text-on-surface-variant truncate">{inc.log_line}</p>
                    {inc.diagnosis && (
                      <p className="text-[11px] text-primary mt-1 truncate">{inc.diagnosis}</p>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0 mt-1" style={{ fontSize: 18 }}>chevron_right</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-on-surface-variant text-[13px]">
              <span className="material-symbols-outlined block mb-2 text-primary/30" style={{ fontSize: 32 }}>check_circle</span>
              {teamIncidents.length === 0 ? 'No incidents assigned to this team yet' : 'No incidents match this filter'}
            </div>
          )}
        </div>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setShowInvite(false); setInviteEmail('') }} />
          <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-on-surface">Invite Member</h3>
              <button onClick={() => { setShowInvite(false); setInviteEmail('') }} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <div>
              <label className="text-[12px] text-on-surface-variant font-medium block mb-1.5">Email Address</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                className="w-full bg-background border border-[#1e2022] text-on-surface rounded-lg px-4 py-2.5 text-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="user@example.com"
                onKeyDown={e => e.key === 'Enter' && handleInvite()} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowInvite(false); setInviteEmail('') }}
                className="px-4 py-2.5 border border-[#1e2022] text-on-surface-variant rounded-lg text-[13px] font-medium hover:bg-surface-container-high transition-all">
                Cancel
              </button>
              <button onClick={handleInvite} disabled={!inviteEmail.trim()}
                className="px-6 py-2.5 bg-primary-container text-on-primary-container rounded-lg text-[13px] font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMember && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => { setShowAddMember(false); setSelectedUser('') }} />
          <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-on-surface">Add Team Member</h3>
              <button onClick={() => { setShowAddMember(false); setSelectedUser('') }} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <div>
              <label className="text-[12px] text-on-surface-variant font-medium block mb-1.5">Select User</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                className="w-full bg-background border border-[#1e2022] text-on-surface rounded-lg px-4 py-2.5 text-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all">
                <option value="">Choose a user...</option>
                {(users || []).filter(u => !u.teams || !u.teams.includes(team.name)).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowAddMember(false); setSelectedUser('') }}
                className="px-4 py-2.5 border border-[#1e2022] text-on-surface-variant rounded-lg text-[13px] font-medium hover:bg-surface-container-high transition-all">
                Cancel
              </button>
              <button onClick={handleAddMember} disabled={!selectedUser}
                className="px-6 py-2.5 bg-primary-container text-on-primary-container rounded-lg text-[13px] font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                Add to Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function TeamsView() {
  const navigate = useNavigate()
  const { id: teamId } = useParams()
  const { isAdmin } = useAuth()
  const { addNotification, showDesktopNotification } = useNotifications()

  const [showCreate, setShowCreate] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [deletingTeam, setDeletingTeam] = useState(null)
  const [form, setForm] = useState({ name: '', color: '#4CAF50', description: '' })
  const [activeTab, setActiveTab] = useState('teams')

  const [showCreateUser, setShowCreateUser] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'member', teams: [] })
  const [editingUser, setEditingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)

  const anyModalOpen = showCreate || editingTeam || deletingTeam || showCreateUser || editingUser || deletingUser

  useEffect(() => {
    if (anyModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [anyModalOpen])

  const fetchTeams = useCallback(() => api.get('/teams'), [])
  const fetchUsers = useCallback(() => api.get('/users'), [])
  const { data: teams, loading: teamsLoading, error: teamsError, refetch: refetchTeams } = usePolling(fetchTeams)
  const { data: users, loading: usersLoading, refetch: refetchUsers } = usePolling(fetchUsers)

  if (teamId) {
    return <TeamDetail teamId={teamId} />
  }

  const handleCreateTeam = async () => {
    if (!form.name.trim()) return
    try {
      await api.post('/teams', form)
      addNotification({ type: 'team', title: 'Team Created', body: `${form.name} has been created`, severity: 'info' })
      showDesktopNotification('Team Created', `${form.name} has been created`)
      await refetchTeams()
      setShowCreate(false)
      setForm({ name: '', color: '#4CAF50', description: '' })
    } catch (e) {
      addNotification({ type: 'error', title: 'Create Failed', body: e.message, severity: 'critical' })
    }
  }

  const handleUpdateTeam = async () => {
    if (!editingTeam || !form.name.trim()) return
    try {
      await api.put(`/teams/${editingTeam.id}`, form)
      addNotification({ type: 'team', title: 'Team Updated', body: `${form.name} has been updated`, severity: 'info' })
      await refetchTeams()
      setEditingTeam(null)
      setForm({ name: '', color: '#4CAF50', description: '' })
    } catch (e) {
      addNotification({ type: 'error', title: 'Update Failed', body: e.message, severity: 'critical' })
    }
  }

  const handleDeleteTeam = async () => {
    if (!deletingTeam) return
    try {
      await api.del(`/teams/${deletingTeam.id}`)
      addNotification({ type: 'team', title: 'Team Deleted', body: `${deletingTeam.name} has been deleted`, severity: 'warning' })
      await refetchTeams()
      setDeletingTeam(null)
    } catch (e) {
      addNotification({ type: 'error', title: 'Delete Failed', body: e.message, severity: 'critical' })
    }
  }

  const openEditTeam = (team) => {
    setEditingTeam(team)
    setForm({ name: team.name, color: team.color || '#4CAF50', description: team.description || '' })
  }

  const closeTeamModal = () => {
    setShowCreate(false)
    setEditingTeam(null)
    setForm({ name: '', color: '#4CAF50', description: '' })
  }

  const handleCreateUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) return
    try {
      await api.post('/users', userForm)
      addNotification({ type: 'user', title: 'User Created', body: `${userForm.name} has been created`, severity: 'info' })
      showDesktopNotification('User Created', `${userForm.name} has been created`)
      await refetchUsers()
      setShowCreateUser(false)
      setUserForm({ name: '', email: '', role: 'member', teams: [] })
    } catch (e) {
      addNotification({ type: 'error', title: 'Create Failed', body: e.message, severity: 'critical' })
    }
  }

  const handleUpdateUser = async () => {
    if (!editingUser || !userForm.name.trim()) return
    try {
      await api.put(`/users/${editingUser.id}`, userForm)
      addNotification({ type: 'user', title: 'User Updated', body: `${userForm.name} has been updated`, severity: 'info' })
      await refetchUsers()
      await refetchTeams()
      setEditingUser(null)
      setUserForm({ name: '', email: '', role: 'member', teams: [] })
    } catch (e) {
      addNotification({ type: 'error', title: 'Update Failed', body: e.message, severity: 'critical' })
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    try {
      await api.del(`/users/${deletingUser.id}`)
      addNotification({ type: 'user', title: 'User Deleted', body: `${deletingUser.name} has been deleted`, severity: 'warning' })
      await refetchUsers()
      await refetchTeams()
      setDeletingUser(null)
    } catch (e) {
      addNotification({ type: 'error', title: 'Delete Failed', body: e.message, severity: 'critical' })
    }
  }

  const openEditUser = (user) => {
    setEditingUser(user)
    setUserForm({ name: user.name || '', email: user.email || '', role: user.role || 'member', teams: user.teams || [] })
  }

  const closeUserModal = () => {
    setShowCreateUser(false)
    setEditingUser(null)
    setUserForm({ name: '', email: '', role: 'member', teams: [] })
  }

  const toggleUserTeam = (teamName) => {
    setUserForm(prev => {
      const has = prev.teams.includes(teamName)
      return { ...prev, teams: has ? prev.teams.filter(t => t !== teamName) : [...prev.teams, teamName] }
    })
  }

  if (teamsLoading) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 pt-8 pb-12">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-surface-container rounded mb-4" />
          <div className="h-4 w-96 bg-surface-container rounded mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="tonal-card p-6 rounded-xl h-48" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 pt-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[30px] font-semibold text-on-surface mb-2">Teams & Users</h1>
          <p className="text-on-surface-variant text-[14px] max-w-xl">
            Manage incident response teams and user assignments across your infrastructure.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {activeTab === 'teams' ? (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-medium text-[13px] hover:brightness-110 transition-all shadow-lg">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
                New Team
              </button>
            ) : (
              <button onClick={() => setShowCreateUser(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-medium text-[13px] hover:brightness-110 transition-all shadow-lg">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
                New User
              </button>
            )}
          </div>
        )}
      </header>

      <div className="flex items-center gap-1 mb-6 border-b border-[#1e2022]">
        <button onClick={() => setActiveTab('teams')}
          className={`px-4 py-3 text-[13px] font-medium transition-colors border-b-2 ${
            activeTab === 'teams'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}>
          <span className="material-symbols-outlined align-middle mr-1.5" style={{ fontSize: 18 }}>group</span>
          Teams
          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-on-surface/5 rounded-full">{teams?.length || 0}</span>
        </button>
        {isAdmin && (
          <button onClick={() => setActiveTab('users')}
            className={`px-4 py-3 text-[13px] font-medium transition-colors border-b-2 ${
              activeTab === 'users'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined align-middle mr-1.5" style={{ fontSize: 18 }}>person</span>
            Users
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-on-surface/5 rounded-full">{users?.length || 0}</span>
          </button>
        )}
      </div>

      {teamsError && (
        <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-center gap-3">
          <span className="material-symbols-outlined text-error" style={{ fontSize: 20 }}>error</span>
          <p className="text-[14px] text-error">Unable to load data. Make sure the backend is running.</p>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(teams || []).map(team => (
            <div key={team.id} className="tonal-card rounded-xl p-6 hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => navigate(`/teams/${team.id}`)}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${team.color}20`, border: `1px solid ${team.color}40` }}>
                    <span className="material-symbols-outlined" style={{ color: team.color, fontSize: 20 }}>group</span>
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-on-surface">{team.name}</h3>
                    <p className="text-[12px] text-on-surface-variant">{team.description || 'No description'}</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditTeam(team)} className="p-2 rounded-lg hover:bg-surface-container transition-colors">
                      <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>edit</span>
                    </button>
                    <button onClick={() => setDeletingTeam(team)} className="p-2 rounded-lg hover:bg-error/10 transition-colors">
                      <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-on-surface-variant">Members</span>
                  <span className="text-on-surface font-medium">{(users || []).filter(u => u.teams && u.teams.includes(team.name)).length}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-on-surface-variant">Color</span>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                    <span className="text-on-surface font-medium font-mono text-[12px]">{team.color}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {(!teams || teams.length === 0) && !teamsError && (
            <div className="col-span-full tonal-card rounded-xl p-12 text-center">
              <span className="material-symbols-outlined text-on-surface-variant block mb-4" style={{ fontSize: 48 }}>group</span>
              <h3 className="text-[16px] font-semibold text-on-surface mb-2">No Teams</h3>
              <p className="text-[13px] text-on-surface-variant mb-4">Create teams to assign incidents and organize your response workflow.</p>
              {isAdmin && (
                <button onClick={() => setShowCreate(true)}
                  className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-[13px] font-medium hover:brightness-110 transition-all">
                  Create First Team
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(users || []).map(user => (
            <div key={user.id} className="tonal-card rounded-xl p-6 hover:bg-surface-container-high transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold bg-primary/10 text-primary">
                    {user.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-on-surface">{user.name}</h3>
                    <p className="text-[12px] text-on-surface-variant">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditUser(user)} className="p-2 rounded-lg hover:bg-surface-container transition-colors">
                    <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>edit</span>
                  </button>
                  {user.role !== 'admin' && (
                    <button onClick={() => setDeletingUser(user)} className="p-2 rounded-lg hover:bg-error/10 transition-colors">
                      <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>delete</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-on-surface-variant">Role</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-on-surface/5 text-on-surface-variant'
                  }`}>{user.role}</span>
                </div>
                {user.teams && user.teams.length > 0 && (
                  <div className="text-[13px]">
                    <span className="text-on-surface-variant">Teams</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {user.teams.map(teamName => {
                        const teamData = (teams || []).find(t => t.name === teamName)
                        return (
                          <span key={teamName} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-[#1e2022]"
                            style={{ backgroundColor: teamData ? `${teamData.color}15` : undefined, color: teamData ? teamData.color : undefined }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: teamData?.color || '#888' }} />
                            {teamName}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                {(!user.teams || user.teams.length === 0) && (
                  <div className="text-[13px]">
                    <span className="text-on-surface-variant">Teams</span>
                    <p className="text-on-surface-variant/50 mt-1">No team assigned</p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {(!users || users.length === 0) && (
            <div className="col-span-full tonal-card rounded-xl p-12 text-center">
              <span className="material-symbols-outlined text-on-surface-variant block mb-4" style={{ fontSize: 48 }}>person</span>
              <h3 className="text-[16px] font-semibold text-on-surface mb-2">No Users</h3>
              <p className="text-[13px] text-on-surface-variant mb-4">Create users to assign them to teams.</p>
              <button onClick={() => setShowCreateUser(true)}
                className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-[13px] font-medium hover:brightness-110 transition-all">
                Create First User
              </button>
            </div>
          )}
        </div>
      )}

      {(showCreate || editingTeam) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={closeTeamModal} />
          <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-on-surface">{editingTeam ? 'Edit Team' : 'Create New Team'}</h3>
              <button onClick={closeTeamModal} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1.5">Team Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-background border border-[#1e2022] text-on-surface rounded-lg px-4 py-2.5 text-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="e.g. SRE, Security, Backend" />
              </div>
              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1.5">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-background border border-[#1e2022] text-on-surface rounded-lg px-4 py-2.5 text-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="Optional description" />
              </div>
              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1.5">Team Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-[#1e2022] cursor-pointer" />
                  <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                    className="flex-1 bg-background border border-[#1e2022] text-on-surface rounded-lg px-4 py-2.5 text-[14px] font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeTeamModal}
                className="px-4 py-2.5 border border-[#1e2022] text-on-surface-variant rounded-lg text-[13px] font-medium hover:bg-surface-container-high transition-all">
                Cancel
              </button>
              <button onClick={editingTeam ? handleUpdateTeam : handleCreateTeam} disabled={!form.name.trim()}
                className="px-6 py-2.5 bg-primary-container text-on-primary-container rounded-lg text-[13px] font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {editingTeam ? 'Save Changes' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingTeam && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDeletingTeam(null)} />
          <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-error" style={{ fontSize: 24 }}>delete</span>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-on-surface">Delete Team</h3>
                <p className="text-[13px] text-on-surface-variant">
                  Are you sure you want to delete <span className="text-on-surface font-medium">{deletingTeam.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingTeam(null)}
                className="px-4 py-2.5 border border-[#1e2022] text-on-surface-variant rounded-lg text-[13px] font-medium hover:bg-surface-container-high transition-all">
                Cancel
              </button>
              <button onClick={handleDeleteTeam}
                className="px-5 py-2.5 bg-error text-on-error rounded-lg text-[13px] font-bold hover:brightness-110 transition-all">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {(showCreateUser || editingUser) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={closeUserModal} />
          <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-on-surface">{editingUser ? 'Edit User' : 'Create New User'}</h3>
              <button onClick={closeUserModal} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1.5">Name</label>
                <input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full bg-background border border-[#1e2022] text-on-surface rounded-lg px-4 py-2.5 text-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="Full name" />
              </div>
              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1.5">Email</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full bg-background border border-[#1e2022] text-on-surface rounded-lg px-4 py-2.5 text-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="user@example.com" />
              </div>
              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1.5">Role</label>
                <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full bg-background border border-[#1e2022] text-on-surface rounded-lg px-4 py-2.5 text-[14px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] text-on-surface-variant font-medium block mb-1.5">Teams</label>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-background border border-[#1e2022] rounded-lg p-3">
                  {(teams || []).map(team => (
                    <label key={team.id} className="flex items-center gap-3 cursor-pointer hover:bg-surface-container-high rounded px-2 py-1.5 transition-colors">
                      <input type="checkbox" checked={userForm.teams.includes(team.name)} onChange={() => toggleUserTeam(team.name)}
                        className="w-4 h-4 rounded border-[#1e2022] text-primary focus:ring-primary bg-background accent-[var(--color-primary)]" />
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                      <span className="text-[13px] text-on-surface">{team.name}</span>
                    </label>
                  ))}
                  {(!teams || teams.length === 0) && (
                    <p className="text-[12px] text-on-surface-variant text-center py-2">No teams available</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeUserModal}
                className="px-4 py-2.5 border border-[#1e2022] text-on-surface-variant rounded-lg text-[13px] font-medium hover:bg-surface-container-high transition-all">
                Cancel
              </button>
              <button onClick={editingUser ? handleUpdateUser : handleCreateUser} disabled={!userForm.name.trim() || !userForm.email.trim()}
                className="px-6 py-2.5 bg-primary-container text-on-primary-container rounded-lg text-[13px] font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {editingUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDeletingUser(null)} />
          <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-error" style={{ fontSize: 24 }}>delete</span>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-on-surface">Delete User</h3>
                <p className="text-[13px] text-on-surface-variant">
                  Are you sure you want to delete <span className="text-on-surface font-medium">{deletingUser.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingUser(null)}
                className="px-4 py-2.5 border border-[#1e2022] text-on-surface-variant rounded-lg text-[13px] font-medium hover:bg-surface-container-high transition-all">
                Cancel
              </button>
              <button onClick={handleDeleteUser}
                className="px-5 py-2.5 bg-error text-on-error rounded-lg text-[13px] font-bold hover:brightness-110 transition-all">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
