import React, { useState, useMemo } from 'react';
import { QueueStats } from '@/types/admin';
import { Download, BarChart3, Clock, Users, UserX, TrendingUp, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface AnalyticsModeProps {
  stats: QueueStats;
}

type TimeRange = 'hour' | 'day' | 'week' | 'month';

// Project colors - warm parchment theme
const COLORS = {
  teal: '#2F5D50',      // teal-400 (primary/waiting)
  tealLight: '#3A6E5F', // teal-300 (served/success)
  gold: '#B8A36A',      // palette-gold (called)
  warmRed: '#A65D4D',   // red-400 (missed/error)
  slate: '#9C8F83',     // slate-600 (neutral)
};

export const AnalyticsMode: React.FC<AnalyticsModeProps> = ({ stats }) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('hour');

  // Calculate completion rate from real data
  const totalProcessed = stats.servedCount + stats.missedCount;
  const completionRate = totalProcessed > 0
    ? Math.round((stats.servedCount / totalProcessed) * 100)
    : 0;

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: 'hour', label: 'Last Hour' },
    { key: 'day', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' }
  ];

  // Memoize chart data to prevent flickering on re-renders
  const statusData = useMemo(() => [
    { name: 'Waiting', value: stats.waitingCount, fill: COLORS.teal },
    { name: 'Called', value: stats.calledCount, fill: COLORS.gold },
    { name: 'Served', value: stats.servedCount, fill: COLORS.tealLight },
    { name: 'Missed', value: stats.missedCount, fill: COLORS.warmRed },
  ], [stats.waitingCount, stats.calledCount, stats.servedCount, stats.missedCount]);

  // Pie chart data for completion rate
  const completionData = useMemo(() => [
    { name: 'Served', value: stats.servedCount, fill: COLORS.tealLight },
    { name: 'Missed', value: stats.missedCount, fill: COLORS.warmRed },
  ], [stats.servedCount, stats.missedCount]);

  const hasData = stats.waitingCount > 0 || stats.calledCount > 0 || stats.servedCount > 0 || stats.missedCount > 0;

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      {/* Filters & Actions */}
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-sm shrink-0">
        <div className="flex gap-2">
          {timeRanges.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedRange(key)}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${selectedRange === key ? 'bg-teal-400 text-slate-900 shadow-md shadow-teal-400/20' : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-slate-50 border border-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
           <button className="px-5 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-400 flex items-center gap-2 transition-colors bg-slate-900 opacity-50 cursor-not-allowed" disabled>
             <Download size={16} /> Export CSV
           </button>
        </div>
      </div>

      {/* KPI Grid - Real Data */}
      <div className="grid grid-cols-4 gap-4 shrink-0">
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-teal-400" />
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">In Queue</h3>
          </div>
          <div className="text-3xl font-serif font-bold text-slate-50">{stats.waitingCount}</div>
          <div className="text-slate-500 text-xs mt-1 font-medium">Currently waiting</div>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-teal-400" />
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Avg Wait</h3>
          </div>
          <div className="text-3xl font-serif font-bold text-slate-50">{stats.avgWaitMinutes} <span className="text-sm text-slate-400 font-sans font-normal">min</span></div>
          <div className="text-slate-500 text-xs mt-1 font-medium">Estimated</div>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-teal-300" />
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Served</h3>
          </div>
          <div className="text-3xl font-serif font-bold text-slate-50">{stats.servedCount}</div>
          <div className="text-teal-300 text-xs mt-1 font-medium">{completionRate}% completion</div>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <UserX size={16} className="text-red-400" />
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Missed</h3>
          </div>
          <div className="text-3xl font-serif font-bold text-slate-50">{stats.missedCount}</div>
          <div className="text-slate-500 text-xs mt-1 font-medium">No-shows</div>
        </div>
      </div>

      {/* Charts */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Bar Chart - Queue Status */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col">
          <h3 className="text-slate-50 font-serif font-bold text-base mb-4 shrink-0 flex items-center gap-2">
            <TrendingUp size={18} className="text-teal-400" />
            Queue Status Breakdown
          </h3>
          {hasData ? (
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#F1F5F9'
                    }}
                    labelStyle={{ color: '#F1F5F9', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div className="text-slate-500">
                <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No data yet</p>
                <p className="text-xs mt-1 opacity-70">Data will appear after first customers</p>
              </div>
            </div>
          )}
        </div>

        {/* Pie Chart - Completion Rate */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col">
          <h3 className="text-slate-50 font-serif font-bold text-base mb-4 shrink-0 flex items-center gap-2">
            <CheckCircle size={18} className="text-teal-300" />
            Completion Rate
          </h3>
          {totalProcessed > 0 ? (
            <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={completionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                    isAnimationActive={false}
                  >
                    {completionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#F1F5F9'
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: '#94A3B8', fontSize: '12px' }}
                    formatter={(value) => <span style={{ color: '#94A3B8' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center mt-2">
                <span className="text-3xl font-bold text-teal-300">{completionRate}%</span>
                <span className="text-slate-400 text-sm ml-2">Success Rate</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div className="text-slate-500">
                <Clock size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No completed sessions yet</p>
                <p className="text-xs mt-1 opacity-70">Serve your first customer to see stats</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};