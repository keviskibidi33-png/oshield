import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePolling } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { Modal } from '../shared/Modal'
import { DeployAgentModal } from '../shared/DeployAgentModal'

function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getNodeIcon(os) {
  if (os === 'linux') return 'dns'
  if (os === 'windows') return 'desktop_windows'
  if (os === 'darwin') return 'laptop_mac'
  return 'computer'
}

function getServiceIcon(service) {
  const icons = {
    nginx: 'web', postgresql: 'database', docker: 'deployed_code',
    mysql: 'database', redis: 'memory', apache2: 'language',
    mongodb: 'database', php: 'code', nodejs: 'javascript',
  }
  return icons[service] || 'settings'
}

function ServiceDetailModal({ service, node, onClose }) {
  if (!service || !node) return null
  const [name, status] = service
  const nodeIncidents = (node.incidents || []).filter(i => i.service === name)
  const lastIncident = nodeIncidents[0]

  const getServiceMetrics = (svc) => {
    const metrics = {
      nginx: { port: 80, protocol: 'HTTP', connections: Math.floor(Math.random() * 500 + 100), latency: '12ms' },
      postgresql: { port: 5432, protocol: 'TCP', connections: Math.floor(Math.random() * 50 + 10), latency: '3ms' },
      docker: { port: 2375, protocol: 'TCP', connections: Math.floor(Math.random() * 20 + 5), latency: '1ms' },
      mysql: { port: 3306, protocol: 'TCP', connections: Math.floor(Math.random() * 100 + 20), latency: '4ms' },
      redis: { port: 6379, protocol: 'TCP', connections: Math.floor(Math.random() * 200 + 50), latency: '0.5ms' },
      apache2: { port: 80, protocol: 'HTTP', connections: Math.floor(Math.random() * 300 + 80), latency: '15ms' },
      mongodb: { port: 27017, protocol: 'TCP', connections: Math.floor(Math.random() * 80 + 15), latency: '5ms' },
    }
    return metrics[svc] || { port: 'N/A', protocol: 'TCP', connections: 0, latency: 'N/A' }
  }

  const metrics = getServiceMetrics(name)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 bg-surface-container border-b border-[#1e2022] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${status === 'active' ? 'bg-primary' : status === 'inactive' ? 'bg-on-surface-variant' : 'bg-error'}`} />
            <div>
              <h3 className="text-[16px] font-semibold text-on-surface">{name}</h3>
              <p className="text-[11px] text-on-surface-variant">{node.name || node.node_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className={`text-[11px] font-bold uppercase px-2.5 py-1 rounded-lg ${
              status === 'active' ? 'bg-primary/10 text-primary border border-primary/20' :
              status === 'inactive' ? 'bg-on-surface-variant/10 text-on-surface-variant border border-on-surface-variant/20' :
              'bg-error/10 text-error border border-error/20'
            }`}>
              {status === 'active' ? 'OPERATIONAL' : status === 'inactive' ? 'INACTIVE' : 'ERROR'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-surface-container-low rounded-lg p-4 border border-[#1e2022]">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Port</p>
              <p className="text-[18px] font-bold text-on-surface">{metrics.port}</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4 border border-[#1e2022]">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Protocol</p>
              <p className="text-[18px] font-bold text-on-surface">{metrics.protocol}</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4 border border-[#1e2022]">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Connections</p>
              <p className="text-[18px] font-bold text-on-surface">{metrics.connections}</p>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4 border border-[#1e2022]">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Latency</p>
              <p className="text-[18px] font-bold text-on-surface">{metrics.latency}</p>
            </div>
          </div>

          {lastIncident && (
            <div className="mb-6">
              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium block mb-2">Last Incident</label>
              <div className="bg-surface-container-low rounded-lg p-4 border border-[#1e2022]">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${lastIncident.status === 'critical' ? 'bg-error' : 'bg-primary'}`} />
                  <span className="text-[12px] font-medium text-on-surface">{lastIncident.title || 'Incident'}</span>
                </div>
                <p className="text-[11px] text-on-surface-variant truncate">{lastIncident.log_line}</p>
                <p className="text-[10px] text-on-surface-variant mt-2">{new Date(lastIncident.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-[#1e2022]">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#1e2022] text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-colors text-[13px] font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NodeDetail({ nodes, nodeId, navigate, incidents }) {
  const node = nodes?.find(n => n.node_id === nodeId)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [incidentFilter, setIncidentFilter] = useState('all')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.del(`/nodes/${nodeId}`)
      navigate('/nodes')
    } catch (e) {
      console.error(e)
      setDeleting(false)
      setShowDelete(false)
    }
  }

  if (!node) {
    return (
      <div className="max-w-[1280px] mx-auto flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-surface-dim">
          <div className="px-8 pt-8 pb-12">
            <button onClick={() => navigate('/nodes')} className="flex items-center gap-1 text-on-surface-variant hover:text-primary text-[13px] mb-6 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
              Back to Nodes
            </button>
            <div className="glass-card rounded-lg p-12 text-center">
              <span className="material-symbols-outlined text-on-surface-variant block mb-4" style={{ fontSize: 48 }}>search_off</span>
              <h3 className="text-[16px] font-semibold text-on-surface mb-2">Node Not Found</h3>
              <p className="text-[13px] text-on-surface-variant">The requested node could not be found.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const isOnline = Date.now() - new Date(node.last_seen).getTime() < 300000
  const services = Object.entries(node.services || {})
  const activeCount = services.filter(([, s]) => s === 'active').length
  const nodeIncidents = (incidents || []).filter(inc => inc.node_id === nodeId)
  const criticalCount = nodeIncidents.filter(i => i.status === 'critical').length
  const resolvedCount = nodeIncidents.filter(i => i.status === 'resolved').length
  const filteredIncidents = incidentFilter === 'all' ? nodeIncidents : nodeIncidents.filter(i => i.status === incidentFilter)

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedIncident || updatingStatus) return
    setUpdatingStatus(true)
    try {
      await api.put(`/incidents/${selectedIncident.id}`, { status: newStatus })
      setSelectedIncident(prev => ({ ...prev, status: newStatus }))
    } catch (e) { console.error(e) }
    setUpdatingStatus(false)
  }

  const impactScore = selectedIncident ? (() => {
    const base = selectedIncident.status === 'critical' ? 85 : selectedIncident.status === 'acknowledged' ? 60 : 30
    const bonus = selectedIncident.service === 'postgresql' ? 10 : selectedIncident.service === 'nginx' ? 5 : 0
    return Math.min(99, base + bonus)
  })() : 0

  return (
    <div className="max-w-[1280px] mx-auto flex flex-1 overflow-hidden">
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-surface-dim">
        <div className="px-8 pt-8 pb-12">
          <button onClick={() => navigate('/nodes')} className="flex items-center gap-1 text-on-surface-variant hover:text-primary text-[13px] mb-6 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Back to Nodes
          </button>

          <header className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-surface-container-high text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{getNodeIcon(node.os)}</span>
              </div>
              <div>
                <h1 className="text-[30px] font-semibold text-on-surface">{node.name || node.node_id}</h1>
                <p className="text-on-surface-variant text-[14px] mb-3">{node.node_id}</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-on-surface/5 border border-[#1e2022] text-[12px] text-on-surface font-medium">
                    <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>receipt_long</span>
                    {nodeIncidents.length} Total
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${criticalCount > 0 ? 'bg-error/10 border border-error/20 text-error' : 'bg-on-surface/5 border border-[#1e2022] text-on-surface'} text-[12px] font-medium`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${criticalCount > 0 ? 'bg-error' : 'bg-on-surface-variant/40'}`} />
                    {criticalCount} Critical
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-[12px] text-primary font-medium">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                    {resolvedCount} Resolved
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/logs', { state: { search: nodeId } })}
                className="flex items-center gap-2 px-4 py-2 border border-[#1e2022] text-on-surface-variant rounded-lg text-[12px] font-medium hover:bg-surface-container-high transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>description</span>
                View Logs
              </button>
              <button onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 px-4 py-2 border border-error/30 text-error rounded-lg text-[12px] font-medium hover:bg-error/10 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                Delete Node
              </button>
            </div>
          </header>

          <Modal open={showDelete} onClose={() => !deleting && setShowDelete(false)} title="Delete Node">
            <p className="text-[13px] text-on-surface-variant mb-1">
              Are you sure you want to delete <span className="text-on-surface font-medium">{node.name || node.node_id}</span>?
            </p>
            <p className="text-[12px] text-on-surface-variant mb-6">This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowDelete(false)} disabled={deleting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-on-surface-variant bg-surface-container-high hover:bg-surface-container-highest transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-error hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                {deleting && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </Modal>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="glass-card p-5 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
              <p className="text-[12px] text-on-surface-variant uppercase tracking-wider font-medium mb-2">Status</p>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-neutral-600'}`} />
                <span className="text-[18px] font-semibold text-on-surface">{isOnline ? 'Connected' : 'Offline'}</span>
              </div>
            </div>
            <div className="glass-card p-5 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
              <p className="text-[12px] text-on-surface-variant uppercase tracking-wider font-medium mb-2">IP Address</p>
              {node.ip ? (
                <div className="flex items-center gap-2 cursor-pointer group/ip" onClick={() => { navigator.clipboard.writeText(node.ip); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
                  <span className="text-[18px] font-semibold text-on-surface font-mono">{node.ip}</span>
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant opacity-0 group-hover/ip:opacity-100 transition-opacity">content_copy</span>
                  {copied && <span className="text-[10px] text-primary">Copied!</span>}
                </div>
              ) : (
                <span className="text-[18px] text-on-surface-variant/40">No IP detected</span>
              )}
            </div>
            <div className="glass-card p-5 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
              <p className="text-[12px] text-on-surface-variant uppercase tracking-wider font-medium mb-2">Platform</p>
              <span className="text-[18px] font-semibold text-on-surface capitalize">{node.os} ({node.platform})</span>
            </div>
            <div className="glass-card p-5 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
              <p className="text-[12px] text-on-surface-variant uppercase tracking-wider font-medium mb-2">Last Seen</p>
              <span className="text-[18px] font-semibold text-on-surface">{isOnline ? 'Just now' : timeAgo(node.last_seen)}</span>
            </div>
          </div>

          <div className="glass-card rounded-lg overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-[#1e2022] bg-[#141617] flex justify-between items-center">
              <h3 className="text-[12px] uppercase tracking-widest text-on-surface-variant font-medium">Services ({activeCount}/{services.length} active)</h3>
              <span className="text-[10px] text-on-surface-variant">Click for details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {services.map(([name, status]) => {
                const svcIncidents = nodeIncidents.filter(i => i.service === name)
                const svcCritical = svcIncidents.filter(i => i.status === 'critical').length
                return (
                  <div key={name} onClick={() => setSelectedService([name, status])}
                    className="glass-card rounded-lg p-4 hover:bg-surface-container-high transition-all cursor-pointer border border-transparent hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors" style={{ fontSize: 18 }}>{getServiceIcon(name)}</span>
                        <span className="text-[14px] font-medium text-on-surface">{name}</span>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${status === 'active' ? 'text-primary bg-primary/10' : status === 'inactive' ? 'text-on-surface-variant bg-on-surface-variant/10' : 'text-error bg-error/10'}`}>
                        {status}
                      </span>
                    </div>
                    {svcIncidents.length > 0 ? (
                      <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                        <span className={`material-symbols-outlined ${svcCritical > 0 ? 'text-error' : 'text-primary'}`} style={{ fontSize: 14 }}>
                          {svcCritical > 0 ? 'warning' : 'check_circle'}
                        </span>
                        <span>{svcIncidents.length} incident{svcIncidents.length !== 1 ? 's' : ''}</span>
                        {svcCritical > 0 && <span className="text-error font-bold">({svcCritical} critical)</span>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-primary">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                        <span>No incidents</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {selectedService && (
            <ServiceDetailModal
              service={selectedService}
              node={{ ...node, incidents: nodeIncidents }}
              onClose={() => setSelectedService(null)}
            />
          )}

          <div className="glass-card rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1e2022] bg-[#141617] flex justify-between items-center">
              <h3 className="text-[12px] uppercase tracking-widest text-on-surface-variant font-medium">Incident History</h3>
              <div className="flex items-center gap-2">
                {['all', 'critical', 'acknowledged', 'resolved', 'annulled'].map(f => (
                  <button key={f} onClick={() => setIncidentFilter(f)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      incidentFilter === f
                        ? f === 'critical' ? 'bg-error/10 text-error' : f === 'resolved' ? 'bg-primary/10 text-primary' : f === 'acknowledged' ? 'bg-tertiary/10 text-tertiary' : f === 'annulled' ? 'bg-on-surface-variant/10 text-on-surface-variant' : 'bg-on-surface-variant/10 text-on-surface'
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
                {filteredIncidents.map((inc, i) => (
                  <div key={inc.id} className="relative px-6 py-4 flex items-start gap-4 hover:bg-surface-container-high transition-colors cursor-pointer border-b border-[#1e2022] last:border-b-0" onClick={() => setSelectedIncident(inc)}>
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      inc.status === 'critical' ? 'bg-error/20 border border-error/40' :
                      inc.status === 'resolved' ? 'bg-primary/20 border border-primary/40' :
                      inc.status === 'annulled' ? 'bg-on-surface-variant/20 border border-on-surface-variant/40' :
                      'bg-tertiary/20 border border-tertiary/40'
                    }`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: inc.status === 'critical' ? 'var(--color-error)' : inc.status === 'resolved' ? 'var(--color-primary)' : inc.status === 'annulled' ? 'var(--color-on-surface-variant)' : 'var(--color-tertiary)' }}>
                        {inc.status === 'critical' ? 'warning' : inc.status === 'resolved' ? 'check_circle' : inc.status === 'annulled' ? 'block' : 'info'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 14 }}>{getServiceIcon(inc.service)}</span>
                        <span className="text-[12px] font-medium text-on-surface">{inc.service}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          inc.status === 'critical' ? 'text-error bg-error/10' :
                          inc.status === 'resolved' ? 'text-primary bg-primary/10' :
                          inc.status === 'annulled' ? 'text-on-surface-variant bg-on-surface-variant/10' :
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
                No incidents recorded for this node
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedIncident && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelectedIncident(null)} />
          <div className="relative bg-surface-container border border-[#1e2022] rounded-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 bg-surface-container border-b border-[#1e2022] px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>{getServiceIcon(selectedIncident.service)}</span>
                <div>
                  <h3 className="text-[16px] font-semibold text-on-surface">Incident Detail</h3>
                  <p className="text-[12px] text-on-surface-variant">#{selectedIncident.id.replace('inc_', '')}</p>
                </div>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className={`text-[12px] font-bold uppercase px-3 py-1 rounded-lg ${
                  selectedIncident.status === 'critical' ? 'bg-error/10 text-error border border-error/20' :
                  selectedIncident.status === 'resolved' ? 'bg-primary/10 text-primary border border-primary/20' :
                  selectedIncident.status === 'annulled' ? 'bg-on-surface-variant/10 text-on-surface-variant border border-on-surface-variant/20' :
                  'bg-tertiary/10 text-tertiary border border-tertiary/20'
                }`}>
                  {selectedIncident.status === 'critical' ? 'CRITICAL' : selectedIncident.status === 'resolved' ? 'RESOLVED' : selectedIncident.status === 'annulled' ? 'ANNULLED' : 'IN PROGRESS'}
                </span>
                <span className="text-[12px] text-on-surface-variant">{new Date(selectedIncident.timestamp).toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}</span>
              </div>

              <div className="mb-6">
                <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium block mb-2">Service</label>
                <span className="text-[14px] text-on-surface font-medium">{selectedIncident.service}</span>
              </div>

              <div className="mb-6">
                <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium block mb-2">Log Line</label>
                <div className="bg-black/40 border border-[#1e2022]/30 rounded-lg p-4 text-[13px] text-on-surface font-mono break-all">{selectedIncident.log_line}</div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">Security Impact</label>
                  <span className={`text-[14px] font-bold ${impactScore >= 70 ? 'text-error' : impactScore >= 40 ? 'text-tertiary' : 'text-primary'}`}>{impactScore}/100</span>
                </div>
                <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${impactScore >= 70 ? 'bg-error' : impactScore >= 40 ? 'bg-tertiary' : 'bg-primary'}`} style={{ width: `${impactScore}%` }} />
                </div>
              </div>

              {selectedIncident.diagnosis && (
                <div className="mb-6">
                  <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium block mb-2">
                    <span className="material-symbols-outlined text-primary align-middle mr-1" style={{ fontSize: 14 }}>auto_awesome</span>
                    AI Diagnosis
                  </label>
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 text-[14px] text-on-surface leading-relaxed">{selectedIncident.diagnosis}</div>
                </div>
              )}

              {selectedIncident.remediation && selectedIncident.remediation.length > 0 && (
                <div className="mb-6">
                  <label className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium block mb-3">
                    <span className="material-symbols-outlined text-primary align-middle mr-1" style={{ fontSize: 14 }}>build</span>
                    Recommended Actions
                  </label>
                  <div className="space-y-3">
                    {selectedIncident.remediation.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-surface-container-low rounded-lg border border-[#1e2022]">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[12px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                        <p className="text-[13px] text-on-surface leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-[#1e2022]">
                {selectedIncident.status === 'critical' && (
                  <>
                    <button onClick={() => handleUpdateStatus('acknowledged')} disabled={updatingStatus}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border border-tertiary/30 text-tertiary rounded-lg hover:bg-tertiary/10 transition-all text-[13px] font-medium disabled:opacity-50">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
                      Acknowledge
                    </button>
                    <button onClick={() => handleUpdateStatus('annulled')} disabled={updatingStatus}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border border-error/30 text-error rounded-lg hover:bg-error/10 transition-all text-[13px] font-medium disabled:opacity-50">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
                      Annul
                    </button>
                  </>
                )}
                {selectedIncident.status === 'acknowledged' && (
                  <>
                    <button onClick={() => handleUpdateStatus('resolved')} disabled={updatingStatus}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-container text-on-primary-container rounded-lg hover:brightness-110 transition-all text-[13px] font-medium disabled:opacity-50">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                      Resolve
                    </button>
                    <button onClick={() => handleUpdateStatus('annulled')} disabled={updatingStatus}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border border-error/30 text-error rounded-lg hover:bg-error/10 transition-all text-[13px] font-medium disabled:opacity-50">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
                      Annul
                    </button>
                  </>
                )}
                {selectedIncident.status === 'resolved' && (
                  <span className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-lg text-[13px] font-medium">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                    Resolved
                  </span>
                )}
                {selectedIncident.status === 'annulled' && (
                  <span className="flex items-center gap-2 px-4 py-2.5 bg-on-surface-variant/10 text-on-surface-variant rounded-lg text-[13px] font-medium">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
                    Annulled
                  </span>
                )}
                <button onClick={() => { navigate('/incidents/' + selectedIncident.id); setSelectedIncident(null) }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#1e2022] text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-colors text-[13px] font-medium ml-auto">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                  Full View
                </button>
                <button onClick={() => setSelectedIncident(null)}
                  className="px-4 py-2.5 border border-[#1e2022] text-on-surface-variant rounded-lg hover:bg-surface-container-high transition-colors text-[13px] font-medium">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function NodesView() {
  const [search, setSearch] = useState('')
  const [showInstall, setShowInstall] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [copied, setCopied] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [osFilter, setOsFilter] = useState('all')
  const filtersRef = useRef(null)
  const navigate = useNavigate()
  const { id: nodeId } = useParams()

  const fetchNodes = useCallback(() => api.get('/nodes'), [])
  const fetchIncidents = useCallback(() => api.get('/incidents'), [])
  const { data: nodes } = usePolling(fetchNodes)
  const { data: incidents } = usePolling(fetchIncidents, 3000)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target)) setShowFilters(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (nodeId) {
    return <NodeDetail nodes={nodes} nodeId={nodeId} navigate={navigate} incidents={incidents} />
  }

  const filtered = (nodes || []).filter(n => {
    const matchSearch = !search || n.name?.toLowerCase().includes(search.toLowerCase()) || n.node_id?.toLowerCase().includes(search.toLowerCase())
    const isOnline = Date.now() - new Date(n.last_seen).getTime() < 60000
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'online' && isOnline) ||
      (statusFilter === 'offline' && !isOnline)
    const matchOs = osFilter === 'all' || n.os === osFilter
    return matchSearch && matchStatus && matchOs
  })

  const onlineCount = nodes?.filter(n => Date.now() - new Date(n.last_seen).getTime() < 60000).length || 0
  const activeServices = nodes?.reduce((acc, n) => acc + Object.values(n.services || {}).filter(s => s === 'active').length, 0) || 0
  const totalServices = nodes?.reduce((acc, n) => acc + Object.keys(n.services || {}).length, 0) || 0
  const criticalIncidents = incidents?.filter(i => i.status === 'critical').length || 0

  const handleCopy = () => {
    navigator.clipboard.writeText('curl -fsSL http://YOUR_SERVER:8080/v1/install.sh | bash -s -- --token YOUR_TOKEN')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-[1280px] mx-auto flex flex-1 overflow-hidden gap-6">
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-surface-dim">
        <div className="px-8 pt-8 pb-12">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="text-[30px] font-semibold text-on-surface mb-2">Nodes</h1>
              <p className="text-on-surface-variant text-[14px] max-w-xl">
                Manage your network infrastructure and connected devices. Securely access your nodes from anywhere using OzyShield's Zero Trust overlay.
              </p>
            </div>
            <button onClick={() => setShowInstall(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg font-medium hover:brightness-110 transition-all shadow-lg">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
              Add device
            </button>
          </header>

          <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: 20 }}>search</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-background border border-[#1e2022] rounded-lg py-2 pl-10 pr-4 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-[14px]"
                placeholder="Filter by name, user, or IP..." type="text" />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto" ref={filtersRef}>
              <div className="relative">
                <button onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 bg-[#141617] border rounded-lg text-[14px] transition-colors ${
                    (statusFilter !== 'all' || osFilter !== 'all') ? 'border-primary/30 text-primary' : 'border-[#1e2022] text-on-surface-variant hover:bg-[#1e2022]'
                  }`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>filter_list</span>
                  Filters
                  {(statusFilter !== 'all' || osFilter !== 'all') && (
                    <span className="w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">
                      {(statusFilter !== 'all' ? 1 : 0) + (osFilter !== 'all' ? 1 : 0)}
                    </span>
                  )}
                </button>
                {showFilters && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container border border-[#1e2022] rounded-xl shadow-lg py-1 z-[100]">
                    <div className="px-4 py-2 border-b border-[#1e2022]">
                      <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">Status</span>
                    </div>
                    {['all', 'online', 'offline'].map(s => (
                      <button key={s} onClick={() => setStatusFilter(s)}
                        className="w-full flex items-center justify-between px-4 py-2 text-[13px] hover:bg-surface-container-high transition-colors">
                        <span className={statusFilter === s ? 'text-primary font-medium' : 'text-on-surface'}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                        {statusFilter === s && <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>check</span>}
                      </button>
                    ))}
                    <div className="px-4 py-2 border-t border-b border-[#1e2022] mt-1">
                      <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">Operating System</span>
                    </div>
                    {['all', 'linux', 'windows', 'darwin'].map(os => (
                      <button key={os} onClick={() => setOsFilter(os)}
                        className="w-full flex items-center justify-between px-4 py-2 text-[13px] hover:bg-surface-container-high transition-colors">
                        <span className={osFilter === os ? 'text-primary font-medium' : 'text-on-surface'}>{os === 'all' ? 'All OS' : os.charAt(0).toUpperCase() + os.slice(1)}</span>
                        {osFilter === os && <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>check</span>}
                      </button>
                    ))}
                    {(statusFilter !== 'all' || osFilter !== 'all') && (
                      <>
                        <div className="border-t border-[#1e2022] my-1" />
                        <button onClick={() => { setStatusFilter('all'); setOsFilter('all') }}
                          className="w-full text-left px-4 py-2 text-[13px] text-error hover:bg-surface-container-high transition-colors">
                          Clear filters
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className={`flex items-center gap-2 text-[12px] uppercase tracking-wider font-medium ${filtered.length > 0 ? 'text-on-surface-variant' : 'text-error'}`}>
              <span className={`w-2 h-2 rounded-full ${filtered.length > 0 ? 'bg-green-500' : 'bg-error'}`} />
              {filtered.length} nodes {search || statusFilter !== 'all' || osFilter !== 'all' ? 'found' : 'active'}
            </div>
            {(statusFilter !== 'all' || osFilter !== 'all') && (
              <button onClick={() => { setStatusFilter('all'); setOsFilter('all') }}
                className="text-[12px] text-on-surface-variant hover:text-on-surface transition-colors">
                Clear filters
              </button>
            )}
          </div>

          <div className="bg-[#141617] border border-[#1e2022] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#141617] border-b border-[#1e2022]">
                  <th className="px-6 py-4 text-[12px] text-on-surface-variant uppercase tracking-widest font-medium">Machine</th>
                  <th className="px-6 py-4 text-[12px] text-on-surface-variant uppercase tracking-widest font-medium">Hostname</th>
                  <th className="px-6 py-4 text-[12px] text-on-surface-variant uppercase tracking-widest font-medium">IP</th>
                  <th className="px-6 py-4 text-[12px] text-on-surface-variant uppercase tracking-widest font-medium">Version</th>
                  <th className="px-6 py-4 text-[12px] text-on-surface-variant uppercase tracking-widest font-medium">Incidents</th>
                  <th className="px-6 py-4 text-[12px] text-on-surface-variant uppercase tracking-widest font-medium">Last Seen</th>
                  <th className="px-6 py-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2022]">
                {filtered.length > 0 ? filtered.map(node => {
                  const isOnline = Date.now() - new Date(node.last_seen).getTime() < 300000
                  const nodeIncidents = (incidents || []).filter(i => i.node_id === node.node_id)
                  const criticalCount = nodeIncidents.filter(i => i.status === 'critical').length
                  const totalCount = nodeIncidents.length
                  return (
                    <tr key={node.node_id} onClick={() => navigate(`/nodes/${node.node_id}`)}
                      className="node-row hover:bg-[#252830] active:bg-[#2a2d35] transition-all duration-150 group cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded bg-surface-container-high text-primary">
                            <span className="material-symbols-outlined">{getNodeIcon(node.os)}</span>
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-on-surface">{node.name || node.node_id}</div>
                            <div className="text-[12px] text-on-surface-variant">{node.node_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] text-on-surface font-mono">{node.name || node.node_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        {node.ip ? (
                          <div className="flex items-center gap-2 text-[14px] text-on-surface group/ip cursor-pointer">
                            <span className="font-mono">{node.ip}</span>
                            <span className="material-symbols-outlined text-[14px] opacity-0 group-hover/ip:opacity-100 transition-opacity">content_copy</span>
                          </div>
                        ) : (
                          <span className="text-[14px] text-on-surface-variant/40">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant text-[14px]">
                        {node.os} ({node.platform})
                      </td>
                      <td className="px-6 py-4">
                        {totalCount > 0 ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                            criticalCount > 0
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${criticalCount > 0 ? 'bg-red-400 animate-pulse' : 'bg-orange-400'}`} />
                            {totalCount} {criticalCount > 0 && `(${criticalCount} critical)`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Clean
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 text-[14px] ${isOnline ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-neutral-600'}`} />
                          {isOnline ? 'Connected' : timeAgo(node.last_seen)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="action-btn opacity-0 text-on-surface-variant hover:text-on-surface transition-all">
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant/30 block mb-3" style={{ fontSize: 48 }}>dns</span>
                      <p className="text-[15px] text-on-surface font-medium mb-1">
                        {search ? 'No nodes match your search' : 'No nodes registered'}
                      </p>
                      <p className="text-[13px] text-on-surface-variant mb-4">
                        {search ? 'Try a different search term or clear filters.' : 'Deploy the OzyShield agent on your servers to start monitoring.'}
                      </p>
                      {!search && (
                        <button onClick={() => setShowInstall(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-[13px] font-medium hover:brightness-110 transition-all">
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                          Deploy your first agent
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <aside className="hidden xl:block w-80 bg-[#141617] border-l border-[#1e2022] p-6 overflow-y-auto custom-scrollbar">
        <div className="bg-[#141617] border border-[#1e2022] rounded-xl p-5 mb-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <h3 className="text-[18px] text-on-surface mb-3 flex items-center gap-2 font-semibold">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            OzyShield Agent
          </h3>
          <p className="text-[14px] text-on-surface-variant mb-6">
            Deploy lightweight agents to monitor your infrastructure in real-time with zero-knowledge sanitization.
          </p>
          <div className="space-y-3 pt-2">
            <h4 className="text-[12px] text-on-surface-variant uppercase tracking-widest font-medium">Quick Actions</h4>
            <button onClick={() => setShowInstall(true)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#1e2022] transition-all group/link text-left">
              <span className="material-symbols-outlined text-on-surface-variant group-hover/link:text-primary transition-colors">add_circle</span>
              <span className="text-[14px] text-on-surface">Deploy new agent</span>
            </button>
            <button onClick={() => navigate('/logs')} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#1e2022] transition-all group/link text-left">
              <span className="material-symbols-outlined text-on-surface-variant group-hover/link:text-primary transition-colors">security</span>
              <span className="text-[14px] text-on-surface">View security logs</span>
            </button>
            <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#1e2022] transition-all group/link text-left">
              <span className="material-symbols-outlined text-on-surface-variant group-hover/link:text-primary transition-colors">tune</span>
              <span className="text-[14px] text-on-surface">Configure monitoring</span>
            </button>
          </div>
        </div>

        <div className="px-2">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[12px] text-on-surface-variant uppercase tracking-widest font-medium">Fleet Status</h4>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-[14px]">
              <span className="text-on-surface-variant">Online Nodes</span>
              <span className="text-on-surface font-semibold">{onlineCount}/{nodes?.length || 0}</span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-on-surface-variant">Active Services</span>
              <span className="text-on-surface font-semibold">{activeServices}/{totalServices}</span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-on-surface-variant">Active Incidents</span>
              <span className={`font-semibold ${criticalIncidents > 0 ? 'text-error' : 'text-on-surface'}`}>{criticalIncidents}</span>
            </div>
            <div className="w-full bg-[#1e2022] h-1 rounded-full mt-4">
              <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${nodes?.length ? (onlineCount / nodes.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </aside>

      <DeployAgentModal open={showInstall} onClose={() => setShowInstall(false)} />
    </div>
  )
}
