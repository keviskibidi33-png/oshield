import { useState, useCallback, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-48 bg-surface-variant rounded mb-2" />
          <div className="h-4 w-80 bg-surface-variant rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-surface-variant rounded" />
          <div className="h-10 w-24 bg-surface-variant rounded" />
        </div>
      </div>
      <div className="h-14 bg-surface-variant rounded-xl mb-6" />
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-16 bg-surface-variant rounded" />
        ))}
      </div>
    </div>
  )
}

function EventTypeBadge({ type }) {
  const colors = {
    'AUTH_ERR': 'bg-error/10 text-error border-error/20',
    'SYS_MON': 'bg-primary/10 text-primary border-primary/20',
    'FIREWALL': 'bg-tertiary/10 text-tertiary border-tertiary/20',
    'NET_ERR': 'bg-error/10 text-error border-error/20',
    'APP_LOG': 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${colors[type] || colors['APP_LOG']}`}>
      {type}
    </span>
  )
}

function SeverityBadge({ severity }) {
  const config = {
    'critical': { color: 'text-error', dot: 'bg-error' },
    'warning': { color: 'text-tertiary', dot: 'bg-tertiary' },
    'info': { color: 'text-primary', dot: 'bg-primary' },
  }
  const s = config[severity] || config['info']
  return (
    <div className={`flex items-center gap-1.5 ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className="text-[12px] font-medium capitalize">{severity}</span>
    </div>
  )
}

export function LogsView() {
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [timeRange, setTimeRange] = useState('24h')
  const [severityFilter, setSeverityFilter] = useState(() => location.state?.severityFilter || [])
  const [liveStream, setLiveStream] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const navigate = useNavigate()

  const fetchIncidents = useCallback(() => api.get('/incidents'), [])
  const fetchNodes = useCallback(() => api.get('/nodes'), [])
  const { data: incidents, loading, error } = usePolling(fetchIncidents, liveStream ? 3000 : 10000)
  const { data: nodes } = usePolling(fetchNodes, 5000)

  const nodeMap = useMemo(() => {
    if (!nodes) return {}
    return nodes.reduce((acc, n) => { acc[n.node_id] = n; return acc }, {})
  }, [nodes])

  const filtered = useMemo(() => {
    return (incidents || []).filter(inc => {
      const matchSearch = !search ||
        inc.node_id?.toLowerCase().includes(search.toLowerCase()) ||
        inc.log_line?.toLowerCase().includes(search.toLowerCase()) ||
        inc.service?.toLowerCase().includes(search.toLowerCase())

      const matchSeverity = severityFilter.length === 0 || severityFilter.includes(inc.status)

      const incTime = new Date(inc.timestamp).getTime()
      const now = Date.now()
      const ranges = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
      const matchTime = !ranges[timeRange] || (now - incTime) <= ranges[timeRange]

      return matchSearch && matchSeverity && matchTime
    })
  }, [incidents, search, severityFilter, timeRange])

  const ITEMS_PER_PAGE = 10
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage])

  const stats = useMemo(() => {
    const total = incidents?.length || 0
    const critical = incidents?.filter(i => i.status === 'critical').length || 0
    const recent = incidents?.filter(i => Date.now() - new Date(i.timestamp).getTime() < 60000).length || 0
    return { total, critical, eventsPerSec: Math.round(recent / 60 * 10) / 10 || 0 }
  }, [incidents])

  useEffect(() => { setCurrentPage(1) }, [search, severityFilter, timeRange])

  const toggleSeverity = (sev) => {
    setSeverityFilter(prev => prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev])
  }

  const clearFilters = () => {
    setSearch('')
    setSeverityFilter([])
    setTimeRange('24h')
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const csv = [
        'Timestamp,Node,Source IP,Event Type,Severity,Message',
        ...filtered.map(inc => [
          inc.timestamp,
          inc.node_id,
          nodeMap[inc.node_id]?.ip || '-',
          (inc.service || 'SYS_MON').toUpperCase(),
          inc.status,
          '"' + (inc.log_line || '').replace(/"/g, '""') + '"',
        ].join(','))
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ozyshield-logs-' + new Date().toISOString().split('T')[0] + '.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error(e) }
    setExporting(false)
  }

  if (loading) {
    return (
      <div>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <header className="mb-8">
          <h1 className="text-[30px] font-semibold text-on-surface mb-1">System Logs</h1>
          <p className="text-[14px] text-on-surface-variant">Real-time infrastructure event monitoring and security auditing.</p>
        </header>
        <div className="glass-card rounded-lg p-12 text-center">
          <span className="material-symbols-outlined text-error block mb-4" style={{ fontSize: 48 }}>error</span>
          <h3 className="text-[16px] font-semibold text-on-surface mb-2">Connection Error</h3>
          <p className="text-[13px] text-on-surface-variant mb-4">Unable to fetch logs from the server.</p>
          <p className="text-[12px] text-on-surface-variant">Make sure the server is running on localhost:8080</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-[30px] font-semibold text-on-surface mb-1">System Logs</h1>
          <p className="text-[14px] text-on-surface-variant">Real-time infrastructure event monitoring and security auditing.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLiveStream(!liveStream)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-[13px] font-medium ${
              liveStream ? 'bg-primary/10 border-primary/30 text-primary' : 'border-[#1e2022] text-on-surface-variant hover:bg-surface-container-low'
            }`}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>wifi</span>
            Live Stream
            <div className={`w-8 h-4 rounded-full transition-colors relative ${liveStream ? 'bg-primary' : 'bg-surface-variant'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${liveStream ? 'left-4' : 'left-0.5'}`} />
            </div>
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1e2022] text-on-surface hover:bg-surface-container-low transition-all text-[13px] font-medium disabled:opacity-50">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card rounded-xl p-5 hover:bg-surface-container-high transition-colors cursor-pointer" title="Events processed per second across all nodes">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>monitoring</span>
            </div>
            <div>
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">Events / Sec</p>
              <h3 className="text-[24px] font-semibold text-on-surface">{stats.eventsPerSec}</h3>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5 hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => setSeverityFilter(['critical'])} title="Click to filter critical alerts only">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 20 }}>notification_important</span>
            </div>
            <div>
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">Active Alerts</p>
              <h3 className="text-[24px] font-semibold text-on-surface">{stats.critical}</h3>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5 hover:bg-surface-container-high transition-colors cursor-pointer" title="Logs are retained for 30 days per policy">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tertiary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary" style={{ fontSize: 20 }}>inventory_2</span>
            </div>
            <div>
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">Logs Retention</p>
              <h3 className="text-[24px] font-semibold text-on-surface">30 Days</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: 18 }}>search</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-background border border-[#1e2022] rounded-lg py-2 pl-10 pr-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-[13px]"
              placeholder="Filter by Node or IP..." />
          </div>

          <div className="relative">
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
              className="bg-background border border-[#1e2022] rounded-lg py-2 px-3 text-on-surface focus:border-primary outline-none transition-all text-[13px] appearance-none pr-8 cursor-pointer">
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" style={{ fontSize: 18 }}>expand_more</span>
          </div>

          <div className="h-6 w-px bg-[#1e2022]" />

          <div className="flex items-center gap-2">
            {['critical', 'warning', 'info'].map(sev => (
              <button key={sev} onClick={() => toggleSeverity(sev)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border ${
                  severityFilter.includes(sev)
                    ? sev === 'critical' ? 'bg-error/10 border-error/30 text-error' :
                      sev === 'warning' ? 'bg-tertiary/10 border-tertiary/30 text-tertiary' :
                      'bg-primary/10 border-primary/30 text-primary'
                    : 'border-[#1e2022] text-on-surface-variant hover:bg-surface-container-low'
                }`}>
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>

          {(search || severityFilter.length > 0 || timeRange !== '24h') && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-[12px] text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-on-surface-variant border-b border-[#1e2022] bg-[#141617]">
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider font-medium w-40">Timestamp</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider font-medium">Node Name</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider font-medium">Source IP</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider font-medium">Event Type</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider font-medium">Severity</th>
                <th className="px-6 py-3 text-[11px] uppercase tracking-wider font-medium">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2022]">
              {paginated.map((inc) => {
                const sourceIP = nodeMap[inc.node_id]?.ip || '-'
                const eventType = (inc.service || 'SYS_MON').toUpperCase().replace(/[^A-Z_]/g, '').slice(0, 8) || 'SYS_MON'
                return (
                  <tr key={inc.id} onClick={() => navigate('/incidents/' + inc.id)}
                    className="hover:bg-[#141617] cursor-pointer transition-colors">
                    <td className="px-6 py-4 text-[12px] text-on-surface-variant font-mono">
                      {new Date(inc.timestamp).toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] text-primary font-medium hover:underline">{inc.node_id}</span>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-on-surface-variant font-mono">{sourceIP}</td>
                    <td className="px-6 py-4"><EventTypeBadge type={eventType} /></td>
                    <td className="px-6 py-4"><SeverityBadge severity={inc.status} /></td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[13px] text-on-surface font-medium truncate block max-w-md">{inc.title || inc.log_line}</span>
                        {inc.title && <span className="text-[11px] text-on-surface-variant truncate block max-w-md">{inc.log_line}</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-on-surface-variant text-[14px]">
                    <span className="material-symbols-outlined block mb-2" style={{ fontSize: 32 }}>search_off</span>
                    No logs found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-[#1e2022] flex items-center justify-between bg-[#141617]/50">
          <span className="text-[12px] text-on-surface-variant">
            Showing {filtered.length > 0 ? Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length) : 0} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} events
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            </button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              let page
              if (totalPages <= 5) page = i + 1
              else if (currentPage <= 3) page = i + 1
              else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
              else page = currentPage - 2 + i
              return (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={'w-8 h-8 rounded flex items-center justify-center text-[12px] font-medium transition-colors ' + (currentPage === page ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high')}>
                  {page}
                </button>
              )
            })}
            {totalPages > 5 && <span className="text-on-surface-variant px-1">...</span>}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}
              className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
