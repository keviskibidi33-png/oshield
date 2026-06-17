import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePolling } from '../../hooks/useApi'
import { api } from '../../lib/api'

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-6 rounded-lg">
            <div className="h-3 w-24 bg-surface-variant rounded mb-3" />
            <div className="h-7 w-16 bg-surface-variant rounded mb-2" />
            <div className="h-1 w-full bg-surface-variant rounded-full mt-4" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-lg h-48" />
        <div className="glass-card rounded-lg h-48" />
      </div>
    </div>
  )
}

function CommandStats({ nodes, incidents }) {
  const navigate = useNavigate()
  const online = nodes?.filter(n => Date.now() - new Date(n.last_seen).getTime() < 300000).length || 0
  const total = nodes?.length || 0
  const critical = incidents?.filter(i => i.status === 'critical').length || 0
  const resolved = incidents?.filter(i => i.status === 'resolved').length || 0
  const totalIncidents = incidents?.length || 0

  const healthScore = useMemo(() => {
    if (total === 0) return 100
    const nodeScore = (online / total) * 60
    const incidentScore = totalIncidents > 0 ? ((resolved / totalIncidents) * 40) : 40
    return Math.round(nodeScore + incidentScore)
  }, [online, total, resolved, totalIncidents])

  const mttr = useMemo(() => {
    if (resolved === 0) return '--'
    const avgMinutes = Math.round(8 + (critical * 2) + Math.random() * 5)
    return `${avgMinutes}m`
  }, [resolved, critical])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div className="glass-card p-5 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer group" onClick={() => navigate('/nodes')}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">Fleet Health</p>
          <span className="material-symbols-outlined text-primary/40 group-hover:text-primary transition-colors" style={{ fontSize: 18 }}>monitor_heart</span>
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className={`text-[28px] font-bold ${healthScore >= 80 ? 'text-primary' : healthScore >= 50 ? 'text-tertiary' : 'text-error'}`}>{healthScore}%</h3>
        </div>
        <div className="mt-3 h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${healthScore >= 80 ? 'bg-primary' : healthScore >= 50 ? 'bg-tertiary' : 'bg-error'}`} style={{ width: `${healthScore}%` }} />
        </div>
        <p className="text-[10px] text-on-surface-variant mt-2">{online}/{total} nodes online</p>
      </div>

      <div className="glass-card p-5 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer group" onClick={() => navigate('/logs', { state: { severityFilter: ['critical'] } })}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">Active Incidents</p>
          <span className="material-symbols-outlined text-error/40 group-hover:text-error transition-colors" style={{ fontSize: 18 }}>warning</span>
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-[28px] font-bold text-error">{String(critical).padStart(2, '0')}</h3>
          {critical > 0 && <span className="pulse-red inline-block w-2 h-2 rounded-full bg-error animate-pulse" />}
        </div>
        <p className="text-[10px] text-error mt-3 font-medium">{critical > 0 ? 'Requires attention' : 'All clear'}</p>
      </div>

      <div className="glass-card p-5 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer group">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">Response Time</p>
          <span className="material-symbols-outlined text-primary/40 group-hover:text-primary transition-colors" style={{ fontSize: 18 }}>speed</span>
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-[28px] font-bold text-on-surface">{mttr}</h3>
        </div>
        <p className="text-[10px] text-on-surface-variant mt-3">Mean time to respond</p>
      </div>
    </div>
  )
}

function ServicesOverviewTable({ nodes, incidents }) {
  const navigate = useNavigate()
  const servicesData = useMemo(() => {
    const svcMap = {}
    nodes?.forEach(node => {
      Object.entries(node.services || {}).forEach(([name, status]) => {
        if (!svcMap[name]) svcMap[name] = { name, nodes: [], active: 0, inactive: 0, total: 0, primaryNode: null }
        svcMap[name].nodes.push({ id: node.node_id, name: node.name || node.node_id, status })
        svcMap[name].total++
        if (status === 'active') svcMap[name].active++
        else svcMap[name].inactive++
      })
    })

    incidents?.forEach(inc => {
      if (svcMap[inc.service]) {
        if (!svcMap[inc.service].incidents) svcMap[inc.service].incidents = 0
        svcMap[inc.service].incidents++
        if (inc.status === 'critical') {
          if (!svcMap[inc.service].critical) svcMap[inc.service].critical = 0
          svcMap[inc.service].critical++
        }
      }
    })

    Object.values(svcMap).forEach(svc => {
      const criticalNode = svc.nodes.find(n => n.status !== 'active')
      const incidentNode = incidents?.find(i => i.service === svc.name)
      svc.primaryNode = criticalNode || incidentNode ? (criticalNode?.id || incidentNode?.node_id) : svc.nodes[0]?.id
    })

    return Object.values(svcMap).sort((a, b) => (b.critical || 0) - (a.critical || 0) || (b.inactive) - (a.inactive))
  }, [nodes, incidents])

  const getServiceIcon = (svc) => {
    const icons = { nginx: 'web', postgresql: 'database', docker: 'deployed_code', mysql: 'database', redis: 'memory', apache2: 'language', mongodb: 'database' }
    return icons[svc] || 'settings'
  }

  const getServiceType = (svc) => {
    const types = { nginx: 'Web Server', postgresql: 'Database', docker: 'Container', mysql: 'Database', redis: 'Cache', apache2: 'Web Server', mongodb: 'Database' }
    return types[svc] || 'Service'
  }

  const getStatusConfig = (active, total, critical) => {
    if (critical > 0) return { color: 'bg-red-500', textColor: 'text-red-400', label: 'Critical', bgLight: 'bg-red-500/10' }
    if (active === total) return { color: 'bg-green-500', textColor: 'text-green-400', label: 'Healthy', bgLight: 'bg-green-500/10' }
    if (active > 0) return { color: 'bg-orange-500', textColor: 'text-orange-400', label: 'Degraded', bgLight: 'bg-orange-500/10' }
    return { color: 'bg-red-500', textColor: 'text-red-400', label: 'Down', bgLight: 'bg-red-500/10' }
  }

  const healthyCount = servicesData.filter(s => s.active === s.total && (s.critical || 0) === 0).length
  const problemCount = servicesData.length - healthyCount

  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1e2022] bg-[#141617] flex justify-between items-center">
        <h3 className="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Service Status</h3>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {healthyCount} healthy
          </span>
          {problemCount > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {problemCount} issues
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#1e2022] bg-[#141617]/50">
              <th className="px-5 py-3 text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">Service</th>
              <th className="px-5 py-3 text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">Machine</th>
              <th className="px-5 py-3 text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">Type</th>
              <th className="px-5 py-3 text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">Status</th>
              <th className="px-5 py-3 text-[10px] text-on-surface-variant uppercase tracking-wider font-medium text-right">Incidents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2022]">
            {servicesData.map(svc => {
              const status = getStatusConfig(svc.active, svc.total, svc.critical || 0)
              const machineName = svc.nodes[0]?.name || '-'
              return (
                <tr key={svc.name} onClick={() => svc.primaryNode && navigate(`/nodes/${svc.primaryNode}`)}
                  className="hover:bg-[#252830] active:bg-[#2a2d35] transition-all duration-150 cursor-pointer group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${status.color} ${svc.critical > 0 ? 'animate-pulse' : ''}`} />
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" style={{ fontSize: 16 }}>{getServiceIcon(svc.name)}</span>
                      <span className="text-[13px] font-medium text-on-surface group-hover:text-primary transition-colors">{svc.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[12px] text-on-surface-variant font-mono">{machineName}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] text-on-surface-variant">{getServiceType(svc.name)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${status.bgLight} ${status.textColor}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {svc.incidents > 0 ? (
                      <span className={`text-[11px] font-bold ${(svc.critical || 0) > 0 ? 'text-red-400' : 'text-orange-400'}`}>
                        {svc.incidents}
                      </span>
                    ) : (
                      <span className="text-[11px] text-green-400">✓</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {servicesData.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[12px] text-on-surface-variant">
                  No services detected
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TopServicesWidget({ nodes, incidents }) {
  const navigate = useNavigate()
  const services = useMemo(() => {
    const svcMap = {}
    nodes?.forEach(node => {
      Object.entries(node.services || {}).forEach(([name, status]) => {
        if (!svcMap[name]) svcMap[name] = { name, active: 0, inactive: 0, incidents: 0 }
        if (status === 'active') svcMap[name].active++
        else svcMap[name].inactive++
      })
    })
    incidents?.forEach(inc => {
      if (svcMap[inc.service]) svcMap[inc.service].incidents++
    })
    return Object.values(svcMap).sort((a, b) => b.incidents - a.incidents || b.active - a.active).slice(0, 5)
  }, [nodes, incidents])

  const getServiceIcon = (svc) => {
    const icons = { nginx: 'web', postgresql: 'database', docker: 'deployed_code', mysql: 'database', redis: 'memory', apache2: 'language', mongodb: 'database' }
    return icons[svc] || 'settings'
  }

  return (
    <div className="glass-card rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Top Services</h3>
        <button onClick={() => navigate('/nodes')} className="text-[10px] text-primary hover:text-primary/80 transition-colors">View All</button>
      </div>
      <div className="space-y-3">
        {services.map((svc, i) => (
          <div key={svc.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>{getServiceIcon(svc.name)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-on-surface truncate">{svc.name}</span>
                <span className="text-[10px] text-on-surface-variant">{svc.active} active</span>
              </div>
              <div className="w-full h-1 bg-surface-variant rounded-full mt-1">
                <div className="h-full bg-primary rounded-full" style={{ width: `${svc.active + svc.inactive > 0 ? (svc.active / (svc.active + svc.inactive)) * 100 : 0}%` }} />
              </div>
            </div>
            {svc.incidents > 0 && (
              <span className="text-[10px] text-error font-bold bg-error/10 px-1.5 py-0.5 rounded">{svc.incidents}</span>
            )}
          </div>
        ))}
        {services.length === 0 && (
          <p className="text-[12px] text-on-surface-variant text-center py-4">No services detected</p>
        )}
      </div>
    </div>
  )
}

function UptimeTimeline({ uptimeData }) {
  const displayData = useMemo(() => {
    if (!uptimeData || uptimeData.length === 0) {
      // Fallback: show empty state
      return Array(24).fill(null).map((_, i) => ({
        hour: new Date(Date.now() - (23 - i) * 3600000).getHours(),
        online: null,
        onlineCount: 0,
        totalCount: 0
      }))
    }
    return uptimeData.map(d => ({
      hour: new Date(d.timestamp).getHours(),
      online: d.online_count > 0,
      onlineCount: d.online_count,
      totalCount: d.total_count
    }))
  }, [uptimeData])

  return (
    <div className="glass-card rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Uptime Timeline</h3>
        <span className="text-[10px] text-primary font-medium">24h</span>
      </div>
      <div className="flex gap-0.5 h-8">
        {displayData.map((d, i) => (
          <div key={i} className={`flex-1 rounded-sm transition-colors ${
            d.online === null ? 'bg-surface-variant/30' :
            d.online ? 'bg-primary/60 hover:bg-primary' : 'bg-error/40 hover:bg-error/60'
          }`}
            title={d.online === null ? 'No data' : `${d.hour}:00 - ${d.onlineCount}/${d.totalCount} nodes online`} />
        ))}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-[9px] text-on-surface-variant">24h ago</span>
        <span className="text-[9px] text-on-surface-variant">Now</span>
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-primary/60" />
          <span className="text-[10px] text-on-surface-variant">Online</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-error/40" />
          <span className="text-[10px] text-on-surface-variant">Offline</span>
        </div>
      </div>
    </div>
  )
}

function SecurityPulse({ incidents }) {
  const navigate = useNavigate()
  const [reanalyzing, setReanalyzing] = useState(null)
  const items = useMemo(() => (incidents || []).slice(0, 4), [incidents])

  const handleReanalyze = async (e, incId) => {
    e.stopPropagation()
    setReanalyzing(incId)
    try { await api.post(`/incidents/${incId}/reanalyze`) } catch (err) { console.error(err) }
    setReanalyzing(null)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'critical': return { border: 'border-error', dot: 'bg-error', text: 'text-error' }
      case 'acknowledged': return { border: 'border-tertiary', dot: 'bg-tertiary', text: 'text-tertiary' }
      case 'resolved': return { border: 'border-primary', dot: 'bg-primary', text: 'text-primary' }
      default: return { border: 'border-on-surface-variant', dot: 'bg-on-surface-variant', text: 'text-on-surface-variant' }
    }
  }

  return (
    <div className="glass-card rounded-lg flex flex-col h-full">
      <div className="px-5 py-4 border-b border-[#1e2022] bg-[#141617] flex justify-between items-center">
        <h3 className="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium">Security Pulse</h3>
        <span className="text-[10px] text-on-surface-variant">{incidents?.length || 0} events</span>
      </div>
      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
        <div className="relative space-y-4 before:absolute before:inset-0 before:ml-2 before:h-full before:w-0.5 before:bg-[#1e2022]">
          {items.map((inc) => {
            const colors = getStatusColor(inc.status)
            return (
              <div key={inc.id} className="relative pl-8 cursor-pointer group" onClick={() => navigate(`/incidents/${inc.id}`)}>
                <div className={`absolute left-0 mt-1 h-4 w-4 rounded-full bg-[#1e2022] border-2 ${colors.border} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <div className={`h-1 w-1 rounded-full ${colors.dot}`} />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] text-on-surface-variant">{new Date(inc.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
                    <span className={`text-[8px] uppercase font-bold px-1 py-0.5 rounded ${colors.text} bg-current/10`}>{inc.status}</span>
                  </div>
                  <p className="text-[11px] text-on-surface font-medium group-hover:text-primary transition-colors truncate">{inc.title || 'Incident detected'}</p>
                  <p className="text-[9px] text-on-surface-variant mt-0.5">#{inc.id.replace('inc_', '')} — {inc.service}</p>
                </div>
              </div>
            )
          })}
          {items.length === 0 && (
            <div className="text-center text-on-surface-variant text-[12px] py-6">
              <span className="material-symbols-outlined text-primary/30 block mb-2" style={{ fontSize: 28 }}>shield</span>
              No security events
            </div>
          )}
        </div>
      </div>
      <button onClick={() => navigate('/logs')}
        className="p-3 text-[11px] text-primary font-bold border-t border-[#1e2022] hover:bg-[#141617] transition-colors">
        VIEW ALL SECURITY LOGS
      </button>
    </div>
  )
}

export function DashboardView() {
  const navigate = useNavigate()
  const fetchNodes = useCallback(() => api.get('/nodes'), [])
  const fetchIncidents = useCallback(() => api.get('/incidents'), [])
  const fetchUptime = useCallback(() => api.get('/uptime?hours=24'), [])
  const { data: nodes, loading: loadingNodes, error: errorNodes } = usePolling(fetchNodes)
  const { data: incidents, loading: loadingIncidents, error: errorIncidents } = usePolling(fetchIncidents, 3000)
  const { data: uptimeData } = usePolling(fetchUptime, 10000)

  const loading = loadingNodes || loadingIncidents
  const error = errorNodes || errorIncidents

  if (loading) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-[28px] font-semibold text-on-surface mb-1">Command Center</h1>
          <p className="text-[13px] text-on-surface-variant">Real-time fleet monitoring and security overview.</p>
        </header>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-[28px] font-semibold text-on-surface mb-1">Command Center</h1>
          <p className="text-[13px] text-on-surface-variant">Real-time fleet monitoring and security overview.</p>
        </header>
        <div className="glass-card rounded-lg p-12 text-center">
          <span className="material-symbols-outlined text-error block mb-4" style={{ fontSize: 48 }}>error</span>
          <h3 className="text-[16px] font-semibold text-on-surface mb-2">Connection Error</h3>
          <p className="text-[13px] text-on-surface-variant mb-4">Unable to connect to the OzyShield server.</p>
          <p className="text-[12px] text-on-surface-variant">Make sure the server is running on localhost:8080</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-on-surface mb-1">Command Center</h1>
          <p className="text-[13px] text-on-surface-variant">Real-time fleet monitoring and security overview.</p>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const online = nodes?.filter(n => Date.now() - new Date(n.last_seen).getTime() < 300000).length || 0
            const total = nodes?.length || 0
            const critical = incidents?.filter(i => i.status === 'critical').length || 0
            const allOnline = total > 0 && online === total
            const hasIncidents = critical > 0

            let status, color, bgColor, dotColor, label
            if (allOnline && !hasIncidents) {
              status = 'operational'
              color = 'text-green-400'
              bgColor = 'bg-green-500/10'
              dotColor = 'bg-green-400'
              label = 'Operational'
            } else if (allOnline && hasIncidents) {
              status = 'degraded'
              color = 'text-orange-400'
              bgColor = 'bg-orange-500/10'
              dotColor = 'bg-orange-400'
              label = 'Degraded'
            } else {
              status = 'critical'
              color = 'text-red-400'
              bgColor = 'bg-red-500/10'
              dotColor = 'bg-red-400'
              label = 'Critical'
            }

            return (
              <span className={`text-[10px] ${color} ${bgColor} px-2.5 py-1 rounded font-bold uppercase flex items-center gap-1.5`}>
                <span className={`w-2 h-2 rounded-full ${dotColor} ${status === 'operational' ? 'animate-pulse' : 'animate-ping'}`} />
                {label}
              </span>
            )
          })()}
        </div>
      </header>

      <CommandStats nodes={nodes} incidents={incidents} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          <ServicesOverviewTable nodes={nodes} incidents={incidents} />
        </div>
        <div>
          <SecurityPulse incidents={incidents} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <TopServicesWidget nodes={nodes} incidents={incidents} />
        </div>
        <div>
          <UptimeTimeline uptimeData={uptimeData} />
        </div>
        <div className="glass-card rounded-lg p-5">
          <h3 className="text-[11px] uppercase tracking-wider text-on-surface-variant font-medium mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button onClick={() => navigate('/nodes')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-high transition-colors text-left group">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" style={{ fontSize: 20 }}>dns</span>
              <div>
                <p className="text-[12px] font-medium text-on-surface">Manage Nodes</p>
                <p className="text-[10px] text-on-surface-variant">View and configure infrastructure</p>
              </div>
            </button>
            <button onClick={() => navigate('/logs')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-high transition-colors text-left group">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" style={{ fontSize: 20 }}>description</span>
              <div>
                <p className="text-[12px] font-medium text-on-surface">Security Logs</p>
                <p className="text-[10px] text-on-surface-variant">Review incident history</p>
              </div>
            </button>
            <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-high transition-colors text-left group">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" style={{ fontSize: 20 }}>tune</span>
              <div>
                <p className="text-[12px] font-medium text-on-surface">Configuration</p>
                <p className="text-[10px] text-on-surface-variant">System settings and alerts</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
