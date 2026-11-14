import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import { Resource } from '../types';
import { Shield, BarChart3, Wrench, FileText, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface AdminDashboardProps {
  resources: Resource[];
  onRefreshResources: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ resources, onRefreshResources }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'resources' | 'rules' | 'audit'>('analytics');
  const [analytics, setAnalytics] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchAnalytics = async () => {
    try {
      const data = await apiRequest('/admin/analytics');
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRules = async () => {
    try {
      const data = await apiRequest('/admin/rules');
      setRules(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await apiRequest('/admin/audit-logs');
      setAuditLogs(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'rules') fetchRules();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

  const handleToggleMaintenance = async (resourceId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    try {
      await apiRequest(`/admin/resources/${resourceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setFeedback({ type: 'success', message: `Resource status updated to ${newStatus}.` });
      onRefreshResources();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Status update failed.' });
    }
  };

  const handleRuleUpdate = async (rule_key: string, rule_value: string) => {
    try {
      await apiRequest('/admin/rules', {
        method: 'POST',
        body: JSON.stringify({ rule_key, rule_value })
      });
      setFeedback({ type: 'success', message: `Rule ${rule_key} saved.` });
      fetchRules();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Rule update failed.' });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-400" />
            Administration & Operations Center
          </h2>
          <p className="text-xs text-slate-400">
            Real-time analytics, resource status toggles, booking parameters, and immutable audit logs.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
              activeTab === 'analytics' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
              activeTab === 'resources' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Resource Management
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
              activeTab === 'rules' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Booking Rules
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
              activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Logs
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">Total Bookings</span>
              <div className="text-2xl font-bold text-white mt-1">{analytics.summary.totalReservations}</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">Completed Sessions</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{analytics.summary.completedReservations}</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">No-Show Expirations</span>
              <div className="text-2xl font-bold text-rose-400 mt-1">{analytics.summary.noShows}</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">No-Show Rate</span>
              <div className="text-2xl font-bold text-amber-400 mt-1">{analytics.summary.noShowRatePercent}%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl">
              <h4 className="text-sm font-bold text-white mb-3">Resource Type Breakdown</h4>
              <div className="space-y-2">
                {analytics.typeUsage.map((u: any) => (
                  <div key={u.type} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-300">{u.type}</span>
                    <span className="font-mono text-indigo-400 font-bold">{u.total_bookings} bookings</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl">
              <h4 className="text-sm font-bold text-white mb-3">Floor Utilization</h4>
              <div className="space-y-2">
                {analytics.floorUsage.map((f: any) => (
                  <div key={f.floor} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-300">Floor {f.floor}</span>
                    <span className="font-mono text-indigo-400 font-bold">{f.bookings} bookings</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resource Management Tab */}
      {activeTab === 'resources' && (
        <div className="space-y-4">
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
            {resources.map((res) => (
              <div key={res.id} className="py-3 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-white text-sm mr-2">{res.name}</span>
                  <span className="text-xs text-slate-400">
                    Floor {res.floor} • {res.zone} • {res.type}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      res.status === 'MAINTENANCE'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {res.status}
                  </span>
                  <button
                    onClick={() => handleToggleMaintenance(res.id, res.status)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg border border-slate-700 transition cursor-pointer"
                  >
                    {res.status === 'MAINTENANCE' ? 'Set Available' : 'Set Maintenance'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.rule_key} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="font-bold text-white text-sm block font-mono">{rule.rule_key}</span>
                <span className="text-xs text-slate-400">{rule.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={rule.rule_value}
                  onBlur={(e) => {
                    if (e.target.value !== rule.rule_value) {
                      handleRuleUpdate(rule.rule_key, e.target.value);
                    }
                  }}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono text-center"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {auditLogs.map((log) => (
            <div key={log.id} className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl text-xs">
              <div className="flex justify-between items-center text-slate-400 mb-1">
                <span className="font-bold text-indigo-400 font-mono">{log.action}</span>
                <span>{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <div className="text-slate-300">
                Entity: <span className="font-mono text-slate-400">{log.entity_type} #{log.entity_id}</span>
                {log.user_name && <span> • Operator: {log.user_name} ({log.user_role})</span>}
              </div>
              {log.details && (
                <pre className="mt-1 p-1.5 bg-slate-900 rounded font-mono text-[11px] text-slate-400 overflow-x-auto">
                  {JSON.stringify(log.details)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
