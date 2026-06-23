import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePolling } from '../../hooks/useApi'
import { api } from '../../lib/api'

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

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-4 w-48 bg-surface-variant rounded mb-3" />
        <div className="h-8 w-64 bg-surface-variant rounded mb-2" />
        <div className="h-4 w-96 bg-surface-variant rounded" />
      </div>
      <div className="grid grid-cols-12 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="col-span-12 md:col-span-3 tonal-card p-5 rounded-xl">
            <div className="h-3 w-24 bg-surface-variant rounded mb-4" />
            <div className="h-6 w-16 bg-surface-variant rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_CONFIG = {
  critical: { label: 'CRITICAL', color: 'error', icon: 'warning', bg: 'bg-error-container/20 border-error-container/40 text-error' },
  acknowledged: { label: 'IN PROGRESS', color: 'tertiary', icon: 'info', bg: 'bg-tertiary-container/20 border-tertiary-container/40 text-tertiary' },
  resolved: { label: 'RESOLVED', color: 'primary', icon: 'check_circle', bg: 'bg-primary-container/20 border-primary-container/40 text-primary' },
  annulled: { label: 'ANNULLED', color: 'on-surface-variant', icon: 'block', bg: 'bg-on-surface-variant/10 border-on-surface-variant/20 text-on-surface-variant' },
}

function NodeModal({ nodeId, onClose }) {
  const [node, setNode] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!nodeId) return
    document.body.style.overflow = 'hidden'
    setLoading(true)
    api.get('/nodes').then(nodes => {
      const found = nodes?.find(n => n.node_id === nodeId)
      setNode(found || null)
      setLoading(false)
    }).catch(() => setLoading(false))
    return () => { document.body.style.overflow = '' }
  }, [nodeId])

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  if (!nodeId) return null

  const isOnline = node ? (Date.now() - new Date(node.last_seen).getTime() < 300000) : false
  const serviceEntries = Object.entries(node?.services || {})
  const activeCount = serviceEntries.filter(([, s]) => s === 'active').length

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-surface-container border border-[#1e2022] rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#1e2022]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center border border-primary-container/20">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>dns</span>
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-on-surface">Node Details</h3>
              <p className="text-[11px] text-on-surface-variant">{nodeId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-on-surface-variant animate-spin" style={{ fontSize: 24 }}>progress_activity</span>
            <p className="text-[12px] text-on-surface-variant mt-2">Loading node data...</p>
          </div>
        ) : !node ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-error block mb-2" style={{ fontSize: 32 }}>error</span>
            <p className="text-[14px] text-on-surface">Node not found</p>
            <p className="text-[12px] text-on-surface-variant mt-1">This node may have been removed or is not registered.</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-on-surface-variant uppercase tracking-wider">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-primary' : 'bg-on-surface-variant/40'}`} />
                  <span className={`text-[13px] font-medium ${isOnline ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-on-surface-variant uppercase tracking-wider">OS</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>
                    {node.os === 'linux' ? 'terminal' : node.os === 'windows' ? 'desktop_windows' : 'laptop_mac'}
                  </span>
                  <span className="text-[13px] text-on-surface capitalize">{node.os}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-surface-container-lowest border border-[#1e2022]">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Platform</p>
                <p className="text-[13px] text-on-surface mt-1 font-mono">{node.platform || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-lowest border border-[#1e2022]">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">CPU Cores</p>
                <p className="text-[13px] text-on-surface mt-1">{node.cpu_count || 'N/A'}</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface-container-lowest border border-[#1e2022]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Services</p>
                <span className="text-[11px] text-on-surface-variant">{activeCount}/{serviceEntries.length} active</span>
              </div>
              <div className="space-y-1.5">
                {serviceEntries.map(([name, status]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-[12px] text-on-surface font-mono">{name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      status === 'active' ? 'bg-primary/10 text-primary' :
                      status === 'not_found' ? 'bg-on-surface-variant/10 text-on-surface-variant' :
                      'bg-error/10 text-error'
                    }`}>
                      {status}
                    </span>
                  </div>
                ))}
                {serviceEntries.length === 0 && (
                  <p className="text-[12px] text-on-surface-variant text-center py-2">No services reported</p>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface-container-lowest border border-[#1e2022]">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Last Seen</p>
              <p className="text-[12px] text-on-surface mt-1">{new Date(node.last_seen).toLocaleString()}</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">{timeAgo(node.last_seen)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function IncidentView() {
  const [updating, setUpdating] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showNodeModal, setShowNodeModal] = useState(false)
  const [teams, setTeams] = useState([])
  const navigate = useNavigate()
  const { id: incidentId } = useParams()

  const fetchIncidents = useCallback(() => api.get('/incidents'), [])
  const { data: incidents, loading, error, refetch } = usePolling(fetchIncidents)
  const fetchTeams = useCallback(() => api.get('/teams'), [])
  const { data: teamData } = usePolling(fetchTeams, 10000)

  useEffect(() => { if (teamData) setTeams(teamData) }, [teamData])

  useEffect(() => {
    if (showTeamModal || showNodeModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showTeamModal, showNodeModal])

  const incident = useMemo(() => {
    if (!incidents || !incidentId) return null
    return incidents.find(inc => inc.id === incidentId) || null
  }, [incidents, incidentId])

  const impactScore = useMemo(() => {
    if (!incident) return 0
    const baseScore = incident.status === 'critical' ? 85 : incident.status === 'acknowledged' ? 60 : incident.status === 'annulled' ? 10 : 30
    const serviceBonus = incident.service === 'postgresql' ? 10 : incident.service === 'nginx' ? 5 : 0
    return Math.min(99, baseScore + serviceBonus)
  }, [incident])

  const handleStatusChange = async (newStatus) => {
    if (!incident || updating) return
    setUpdating(true)
    try {
      await api.put(`/incidents/${incident.id}`, { status: newStatus })
      await refetch()
    } catch (e) { console.error(e) }
    setUpdating(false)
  }

  const handleAssignTeam = async (teamName) => {
    if (!incident || updating) return
    setUpdating(true)
    try {
      await api.put(`/incidents/${incident.id}/team`, { team: teamName })
      await refetch()
      setShowTeamModal(false)
    } catch (e) { console.error(e) }
    setUpdating(false)
  }

  const handleReanalyze = async () => {
    if (!incident || reanalyzing) return
    setReanalyzing(true)
    try {
      await api.post(`/incidents/${incident.id}/reanalyze`)
      await refetch()
    } catch (e) { console.error(e) }
    setReanalyzing(false)
  }

  const handleGenerateReport = () => {
    if (!incident) return
    const report = [
      '=== OzyShield Incident Report ===',
      `Incident ID: ${incident.id}`,
      `Status: ${incident.status}`,
      `Node: ${incident.node_id}`,
      `Service: ${incident.service}`,
      `Team: ${incident.assigned_team || 'Unassigned'}`,
      `Timestamp: ${incident.timestamp}`,
      '',
      '=== Log Line ===',
      incident.log_line,
      '',
      '=== AI Diagnosis ===',
      incident.diagnosis,
      '',
      '=== Remediation Steps ===',
      ...(incident.remediation || []).map((step, i) => `${i + 1}. ${step}`),
      '',
      `=== Report generated at ${new Date().toISOString()} ===`,
    ].join('\n')
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `incident-${incident.id}-report.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-[30px] font-semibold text-on-surface mb-1">Incident Details</h1>
        </header>
        <div className="glass-card rounded-lg p-12 text-center">
          <span className="material-symbols-outlined text-error block mb-4" style={{ fontSize: 48 }}>error</span>
          <h3 className="text-[16px] font-semibold text-on-surface mb-2">Connection Error</h3>
          <p className="text-[13px] text-on-surface-variant">Unable to fetch incident data.</p>
        </div>
      </div>
    )
  }

  if (!incident) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-[30px] font-semibold text-on-surface mb-1">Incident Details</h1>
        </header>
        <div className="glass-card rounded-lg p-12 text-center">
          <span className="material-symbols-outlined text-on-surface-variant block mb-4" style={{ fontSize: 48 }}>search_off</span>
          <h3 className="text-[16px] font-semibold text-on-surface mb-2">No Incident Found</h3>
          <p className="text-[13px] text-on-surface-variant">The requested incident could not be found.</p>
        </div>
      </div>
    )
  }

  const sc = STATUS_CONFIG[incident.status] || STATUS_CONFIG.critical

  return (
    <div className="pb-12">
      <button onClick={() => navigate('/logs')}
        className="flex items-center gap-2 text-[13px] text-on-surface-variant hover:text-on-surface mb-6 transition-colors">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Logs
      </button>

      <section className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-[30px] font-semibold text-on-surface">
              {incident.title || 'Incident'}
              <span className="text-on-surface-variant text-[18px] font-normal ml-2">#{incident.id.replace('inc_', '')}</span>
            </h1>
            {incident.reopened_count > 0 && (
              <span className="px-3 py-1 rounded-lg text-[12px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20 flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>replay</span>
                Reopened ×{incident.reopened_count}
              </span>
            )}
            <div className={`px-3 py-1 rounded-lg text-[12px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${sc.bg}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{sc.icon}</span>
              {sc.label}
            </div>
            {incident.diagnosis_source && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                incident.diagnosis_source === 'ai' ? 'bg-primary/10 text-primary border-primary/20' :
                incident.diagnosis_source === 'reanalyzed' ? 'bg-tertiary/10 text-tertiary border-tertiary/20' :
                'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20'
              }`}>
                {incident.diagnosis_source === 'ai' ? 'AI' :
                 incident.diagnosis_source === 'reanalyzed' ? 'AI Re-analyzed' : 'Heuristic'}
              </span>
            )}
            {incident.assigned_team && (
              <span className="px-3 py-1 rounded-lg text-[12px] font-medium bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>group</span>
                {incident.assigned_team}
              </span>
            )}
          </div>
          <p className="text-on-surface-variant mt-2 text-[14px] max-w-2xl">
            {incident.log_line?.slice(0, 150)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {incident.status !== 'resolved' && incident.status !== 'annulled' && (
            <button onClick={handleReanalyze} disabled={reanalyzing}
              className="text-[12px] px-5 py-2.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-all font-medium disabled:opacity-50 flex items-center gap-2">
              <span className={`material-symbols-outlined ${reanalyzing ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>
                {reanalyzing ? 'progress_activity' : 'auto_awesome'}
              </span>
              {reanalyzing ? 'Analyzing...' : 'Re-analyze with AI'}
            </button>
          )}
          {incident.status === 'critical' && (
            <>
              <button onClick={() => setShowTeamModal(true)} disabled={updating}
                className="text-[12px] px-5 py-2.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-all font-medium disabled:opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span>
                Assign to Team
              </button>
              <button onClick={() => handleStatusChange('acknowledged')} disabled={updating}
                className="text-[12px] px-5 py-2.5 rounded-lg border border-tertiary/30 text-tertiary hover:bg-tertiary/10 transition-all font-medium disabled:opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
                In Process
              </button>
              <button onClick={() => handleStatusChange('annulled')} disabled={updating}
                className="text-[12px] px-5 py-2.5 rounded-lg border border-error/30 text-error hover:bg-error/10 transition-all font-medium disabled:opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
                Annul
              </button>
            </>
          )}
          {incident.status === 'acknowledged' && (
            <>
              <button onClick={() => setShowTeamModal(true)} disabled={updating}
                className="text-[12px] px-5 py-2.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-all font-medium disabled:opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span>
                Reassign
              </button>
              <button onClick={() => handleStatusChange('resolved')} disabled={updating}
                className="text-[12px] px-5 py-2.5 rounded-lg bg-primary-container text-on-primary-container hover:brightness-110 shadow-lg shadow-primary-container/10 transition-all font-medium disabled:opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                Resolve
              </button>
              <button onClick={() => handleStatusChange('annulled')} disabled={updating}
                className="text-[12px] px-5 py-2.5 rounded-lg border border-error/30 text-error hover:bg-error/10 transition-all font-medium disabled:opacity-50 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
                Annul
              </button>
            </>
          )}
          {incident.status === 'resolved' && (
            <span className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-lg text-[13px] font-medium border border-primary/20">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
              Incident Resolved
            </span>
          )}
          {incident.status === 'annulled' && (
            <span className="flex items-center gap-2 px-5 py-2.5 bg-on-surface-variant/10 text-on-surface-variant rounded-lg text-[13px] font-medium border border-on-surface-variant/20">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
              Incident Annulled
            </span>
          )}
        </div>
      </section>

      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-12 md:col-span-3 tonal-card p-5 rounded-xl flex flex-col justify-between hover:bg-surface-container-high transition-colors cursor-pointer">
          <div>
            <span className="text-[12px] text-on-surface-variant flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>schedule</span>
              Detection Time
            </span>
            <h3 className="text-[24px] font-semibold mt-4">{timeAgo(incident.timestamp)}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e2022]">
            <span className="text-[12px] text-on-surface-variant">{new Date(incident.timestamp).toLocaleTimeString('en-US', { hour12: false })} UTC</span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 tonal-card p-5 rounded-xl flex flex-col justify-between hover:bg-surface-container-high transition-colors cursor-pointer"
          onClick={() => setShowNodeModal(true)}>
          <div>
            <span className="text-[12px] text-on-surface-variant flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dns</span>
              Target Node
            </span>
            <h3 className="text-[24px] font-semibold mt-4">{incident.node_id}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e2022] flex items-center justify-between">
            <span className="text-[12px] text-on-surface-variant">Type: VPC Instance</span>
            <span className="w-2 h-2 rounded-full bg-tertiary" />
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 tonal-card p-5 rounded-xl flex flex-col justify-between hover:bg-surface-container-high transition-colors cursor-pointer">
          <div>
            <span className="text-[12px] text-on-surface-variant flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>hub</span>
              Involved Services
            </span>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="bg-surface-variant px-2 py-0.5 rounded text-[12px] text-on-surface">{incident.service}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e2022]">
            <span className="text-[12px] text-on-surface-variant">1 service affected</span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 tonal-card p-5 rounded-xl flex flex-col justify-between relative overflow-hidden hover:bg-surface-container-high transition-colors cursor-pointer">
          <div className="relative z-10">
            <span className="text-[12px] text-on-surface-variant flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>analytics</span>
              Security Impact
            </span>
            <h3 className={`text-[24px] font-semibold mt-4 ${impactScore >= 70 ? 'text-error' : impactScore >= 40 ? 'text-tertiary' : 'text-primary'}`}>
              {impactScore} / 100
            </h3>
          </div>
          <div className="mt-4 pt-4 border-t border-[#1e2022] relative z-10">
            <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${impactScore >= 70 ? 'bg-error' : impactScore >= 40 ? 'bg-tertiary' : 'bg-primary'}`}
                style={{ width: `${impactScore}%` }} />
            </div>
          </div>
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className={`w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${
              impactScore >= 70 ? 'from-error' : impactScore >= 40 ? 'from-tertiary' : 'from-primary'
            } via-transparent to-transparent`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-8 tonal-card rounded-xl p-6 flex flex-col hover:bg-surface-container-high transition-colors cursor-pointer">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-primary-container/10 flex items-center justify-center border border-primary-container/20">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
              </div>
              <div>
                <h2 className="text-[20px] font-semibold">Diagnosis Summary</h2>
                <p className="text-[12px] text-on-surface-variant">
                  {incident.diagnosis_source === 'ai' ? 'AI-Generated Analysis' :
                   incident.diagnosis_source === 'reanalyzed' ? 'AI Re-analyzed' :
                   'Heuristic Analysis'} & Root Cause
                </p>
              </div>
            </div>
          </div>
          <div className="bg-black/40 border border-[#1e2022]/30 p-5 rounded-lg mb-6 leading-relaxed">
            <p className="text-[16px] text-on-surface">
              System intelligence has detected a <span className="text-primary font-bold">coordinated pattern</span> in {incident.service} logs. {incident.diagnosis}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded border border-[#1e2022] bg-surface-container-lowest">
              <span className="text-[12px] text-on-surface-variant block mb-1 font-medium">Recommended Action</span>
              <p className="text-[14px] text-primary">{incident.remediation?.[0] || 'Review and assess the incident.'}</p>
            </div>
            <div className="p-4 rounded border border-[#1e2022] bg-surface-container-lowest">
              <span className="text-[12px] text-on-surface-variant block mb-1 font-medium">Target Node</span>
              <p className="text-[14px] text-on-surface">{incident.node_id}</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 tonal-card rounded-xl overflow-hidden flex flex-col hover:bg-surface-container-high transition-colors cursor-pointer">
          <div className="p-6 border-b border-[#1e2022] bg-surface-container-low">
            <h3 className="text-[20px] font-semibold">Incident Management</h3>
          </div>
          <div className="p-6 flex flex-col gap-4 flex-grow">
            <button onClick={() => navigate(`/logs`)}
              className="w-full flex items-center justify-between p-4 bg-primary-container text-on-primary-container rounded-lg hover:brightness-110 transition-all group">
              <span className="text-[20px] font-semibold">View All Logs</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>
            <button onClick={handleGenerateReport}
              className="w-full flex items-center justify-between p-4 border border-[#1e2022] hover:bg-surface-variant rounded-lg transition-all text-on-surface">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined">description</span>
                <span className="text-[16px]">Generate Report</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">download</span>
            </button>
            <div className="mt-4">
              <span className="text-[12px] text-on-surface-variant block mb-4 uppercase tracking-wider font-medium">Activity Feed</span>
              <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-[#1e2022]">
                <div className="flex gap-4 relative">
                  <div className="w-6 h-6 rounded-full bg-error-container border border-[#1e2022] flex items-center justify-center z-10">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>
                  </div>
                  <div className="flex-grow">
                    <p className="text-[14px] font-medium text-on-surface">Incident Detected</p>
                    <p className="text-[12px] text-on-surface-variant">System — {timeAgo(incident.timestamp)}</p>
                  </div>
                </div>
                {incident.reopened_count > 0 && (
                  <div className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full bg-tertiary-container border border-[#1e2022] flex items-center justify-center z-10">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>replay</span>
                    </div>
                    <div className="flex-grow">
                      <p className="text-[14px] font-medium text-on-surface">
                        Reopened <span className="text-tertiary font-bold">×{incident.reopened_count}</span>
                      </p>
                      <p className="text-[12px] text-on-surface-variant">
                        {incident.last_reopened_at ? timeAgo(incident.last_reopened_at) : 'Recently'}
                      </p>
                    </div>
                  </div>
                )}
                {(incident.status === 'acknowledged' || incident.status === 'resolved') && (
                  <div className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full bg-tertiary-container border border-[#1e2022] flex items-center justify-center z-10">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>group</span>
                    </div>
                    <div className="flex-grow">
                      <p className="text-[14px] font-medium text-on-surface">In Process</p>
                      <p className="text-[12px] text-on-surface-variant">{incident.assigned_team || 'Team assigned'}</p>
                    </div>
                  </div>
                )}
                {incident.status === 'resolved' && (
                  <div className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full bg-primary-container border border-[#1e2022] flex items-center justify-center z-10">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                    </div>
                    <div className="flex-grow">
                      <p className="text-[14px] font-medium text-on-surface">Resolved</p>
                      <p className="text-[12px] text-on-surface-variant">Completed</p>
                    </div>
                  </div>
                )}
                {incident.status === 'annulled' && (
                  <div className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full bg-on-surface-variant/20 border border-[#1e2022] flex items-center justify-center z-10">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>block</span>
                    </div>
                    <div className="flex-grow">
                      <p className="text-[14px] font-medium text-on-surface">Annulled</p>
                      <p className="text-[12px] text-on-surface-variant">False positive or no action required</p>
                    </div>
                  </div>
                )}
                {incident.status === 'critical' && (
                  <div className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full bg-surface-container-high border border-[#1e2022] flex items-center justify-center z-10">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>pending</span>
                    </div>
                    <div className="flex-grow">
                      <p className="text-[14px] font-medium text-on-surface">Pending Assignment</p>
                      <p className="text-[12px] text-on-surface-variant">Awaiting team assignment</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTeamModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowTeamModal(false)} />
          <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-on-surface">Assign to Team</h3>
              <button onClick={() => setShowTeamModal(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
            <p className="text-[13px] text-on-surface-variant mb-4">Select a team to assign this incident to:</p>
            <div className="space-y-2">
              {teams.map(team => (
                <button key={team.id} onClick={() => handleAssignTeam(team.name)} disabled={updating}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-[#1e2022] hover:bg-surface-container-high transition-colors text-left disabled:opacity-50">
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
                  <div className="flex-1">
                    <span className="text-[14px] font-medium text-on-surface">{team.name}</span>
                    <span className="text-[12px] text-on-surface-variant ml-2">({team.members?.length || 0} members)</span>
                  </div>
                  {incident.assigned_team === team.name && (
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>check</span>
                  )}
                </button>
              ))}
              {teams.length === 0 && (
                <p className="text-[13px] text-on-surface-variant text-center py-4">No teams available. Create teams in the Teams section.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showNodeModal && (
        <NodeModal nodeId={incident?.node_id} onClose={() => setShowNodeModal(false)} />
      )}
    </div>
  )
}
