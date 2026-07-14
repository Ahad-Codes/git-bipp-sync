import { useState, useEffect } from 'react';
import { LineChart, Plus, Flame, TrendingUp, MessageSquare, Bookmark, Users, Calendar, ChevronDown, ChevronUp, Trash2, Lightbulb, BarChart2, Target, PenLine, ArrowRight } from 'lucide-react';
import { tw } from '../../lib/colors';

/**
 * Consistency Pulse
 * Tracks posting consistency, audience engagement, and which story themes work best.
 * Surfaces pattern insights and follow-up prompts.
 *
 * Persistence: WorkspaceDB — stores post logs per session.
 */

declare global {
  interface Window {
    useWorkspaceDB: <T = any>(
      table: string,
      options?: {
        shared?: boolean;
        limit?: number;
        orderBy?: { column: string; direction: 'asc' | 'desc' };
      }
    ) => { data: T[]; loading: boolean; error: Error | null; total: number; refresh: () => void };
    __workspaceDb: any;
  }
}

interface PostLog {
  id: number;
  post_date: string;
  theme: string;
  platform: string;
  engagement_level: 'low' | 'medium' | 'high';
  replies: number;
  saves: number;
  follows: number;
  notes: string;
  created_at?: string;
}

type EngagementLevel = 'low' | 'medium' | 'high';
type Platform = 'linkedin' | 'twitter' | 'instagram' | 'other';

const THEMES = [
  'Product Update', 'Failure / Mistake', 'Behind the Scenes', 'Revenue / Metrics',
  'Lesson Learned', 'Customer Story', 'Personal Reflection', 'Hot Take', 'Process / How-To',
  'Milestone', 'Question for Audience', 'Industry Insight',
];

const PLATFORMS: { value: Platform; label: string; emoji: string }[] = [
  { value: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { value: 'twitter', label: 'Twitter/X', emoji: '𝕏' },
  { value: 'instagram', label: 'Instagram', emoji: '📸' },
  { value: 'other', label: 'Other', emoji: '🌐' },
];

const ENGAGEMENT_LEVELS: { value: EngagementLevel; label: string; color: string; bg: string }[] = [
  { value: 'low', label: 'Low', color: '#b33f43', bg: '#fff2f2' },
  { value: 'medium', label: 'Medium', color: '#d97706', bg: '#fffbeb' },
  { value: 'high', label: 'High 🔥', color: '#16a34a', bg: '#f0fdf4' },
];

function getEngagementStyle(level: EngagementLevel) {
  return ENGAGEMENT_LEVELS.find(e => e.value === level) || ENGAGEMENT_LEVELS[0];
}

function getStreakCount(posts: PostLog[]): number {
  if (!posts.length) return 0;
  const dates = posts.map(p => p.post_date).sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  let checkDate = today;

  for (const date of dates) {
    const diff = Math.round((new Date(checkDate).getTime() - new Date(date).getTime()) / 86400000);
    if (diff <= 1) {
      streak++;
      checkDate = date;
    } else {
      break;
    }
  }
  return streak;
}

function getTopTheme(posts: PostLog[]): { theme: string; count: number; avgEngagement: string } | null {
  if (!posts.length) return null;
  const themeMap: Record<string, { count: number; engSum: number }> = {};
  const engVal: Record<EngagementLevel, number> = { low: 1, medium: 2, high: 3 };

  posts.forEach(p => {
    if (!themeMap[p.theme]) themeMap[p.theme] = { count: 0, engSum: 0 };
    themeMap[p.theme].count++;
    themeMap[p.theme].engSum += engVal[p.engagement_level] || 1;
  });

  const sorted = Object.entries(themeMap).sort((a, b) => {
    const avgA = a[1].engSum / a[1].count;
    const avgB = b[1].engSum / b[1].count;
    return avgB - avgA;
  });

  const [theme, data] = sorted[0];
  const avg = data.engSum / data.count;
  const avgLabel = avg >= 2.5 ? 'High' : avg >= 1.5 ? 'Medium' : 'Low';
  return { theme, count: data.count, avgEngagement: avgLabel };
}

function generateInsights(posts: PostLog[]): string[] {
  if (posts.length < 2) return [];
  const insights: string[] = [];

  // High-engagement themes
  const highPosts = posts.filter(p => p.engagement_level === 'high');
  if (highPosts.length > 0) {
    const themes = highPosts.map(p => p.theme);
    const uniqueThemes = [...new Set(themes)];
    insights.push(`Your "${uniqueThemes[0]}" posts consistently get your best engagement. Post another one this week while momentum is high.`);
  }

  // Consistency pattern
  const totalDays = Math.round((new Date().getTime() - new Date(posts[posts.length - 1]?.post_date || new Date()).getTime()) / 86400000);
  const freq = totalDays > 0 ? posts.length / totalDays : 0;
  if (freq < 0.3) {
    insights.push(`You're posting about once every ${Math.round(1 / freq)} days. Bumping to 3x/week could significantly grow your reach.`);
  } else if (freq >= 0.5) {
    insights.push(`Great posting frequency! You're averaging ${Math.round(freq * 7)}x per week — consistency like this compounds over time.`);
  }

  // Replies signal
  const avgReplies = posts.reduce((s, p) => s + (p.replies || 0), 0) / posts.length;
  if (avgReplies > 2) {
    insights.push(`Posts with ${Math.round(avgReplies)}+ replies on average — your audience is engaging. Try ending posts with a direct question to keep the momentum.`);
  }

  // Follow-up opportunity
  const recentHigh = posts.slice(0, 5).find(p => p.engagement_level === 'high');
  if (recentHigh) {
    insights.push(`Your "${recentHigh.theme}" post did well recently. Write a follow-up with the next chapter of that story.`);
  }

  return insights.slice(0, 3);
}

const emptyForm = {
  post_date: new Date().toISOString().split('T')[0],
  theme: THEMES[0],
  platform: 'linkedin' as Platform,
  engagement_level: 'medium' as EngagementLevel,
  replies: 0,
  saves: 0,
  follows: 0,
  notes: '',
};

function hasWorkspaceDbAuth(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__workspaceDb?.token && window.useWorkspaceDB);
}

function useWorkspaceDbReady(): boolean {
  const [ready, setReady] = useState(() => hasWorkspaceDbAuth());

  useEffect(() => {
    if (ready || typeof window === 'undefined') return;
    const intervalId = window.setInterval(() => {
      if (hasWorkspaceDbAuth()) {
        setReady(true);
        window.clearInterval(intervalId);
      }
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [ready]);

  return ready;
}

function WorkspaceDbUnavailable() {
  return (
    <div className="min-h-full flex flex-col w-full bg-transparent">
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--space-border-default)', background: 'var(--space-surface-card)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--space-brand-highlight)' }}
          >
            <LineChart className="w-5 h-5" style={{ color: 'var(--space-text-on-highlight)' }} />
          </div>
          <div>
            <h1 className="font-bold text-base" style={{ color: 'var(--space-text-primary)' }}>
              Consistency Pulse
            </h1>
            <p className="text-xs" style={{ color: 'var(--space-text-muted)' }}>
              Track what you post. Learn what works.
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <LineChart className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--space-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--space-text-primary)' }}>
            Workspace data is unavailable in this preview.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--space-text-muted)' }}>
            Open the workspace with an active session to load saved post logs.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConsistencyPulseDb() {
  const { data: posts, loading, refresh } = window.useWorkspaceDB<PostLog>('consistency_pulse_posts', {
    orderBy: { column: 'post_date', direction: 'desc' },
    limit: 100,
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [tab, setTab] = useState<'log' | 'insights'>('log');

  const streak = getStreakCount(posts || []);
  const topTheme = getTopTheme(posts || []);
  const insights = generateInsights(posts || []);
  const totalPosts = posts?.length || 0;
  const highCount = posts?.filter(p => p.engagement_level === 'high').length || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await window.__workspaceDb.from('consistency_pulse_posts').insert({
        post_date: form.post_date,
        theme: form.theme,
        platform: form.platform,
        engagement_level: form.engagement_level,
        replies: Number(form.replies) || 0,
        saves: Number(form.saves) || 0,
        follows: Number(form.follows) || 0,
        notes: form.notes.trim(),
      });
      refresh();
      setShowForm(false);
      setForm(emptyForm);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await window.__workspaceDb.from('consistency_pulse_posts').delete(id);
      refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col w-full bg-transparent">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--space-border-default)', background: 'var(--space-surface-card)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--space-brand-highlight)' }}
          >
            <LineChart className="w-5 h-5" style={{ color: 'var(--space-text-on-highlight)' }} />
          </div>
          <div>
            <h1 className="font-bold text-base" style={{ color: 'var(--space-text-primary)' }}>
              Consistency Pulse
            </h1>
            <p className="text-xs" style={{ color: 'var(--space-text-muted)' }}>
              Track what you post. Learn what works.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Nav to Raw-to-Post */}
          <button
            onClick={() => { window.location.hash = 'raw-to-post'; }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-95"
            style={{
              background: 'var(--space-surface-accent-soft)',
              color: 'var(--space-text-accent)',
            }}
            title="Turn raw notes into posts"
          >
            <PenLine className="w-3.5 h-3.5" />
            Raw-to-Post
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: showForm ? 'var(--space-surface-panel)' : 'var(--space-brand-primary)',
              color: showForm ? 'var(--space-text-secondary)' : 'var(--space-text-on-primary)',
            }}
          >
            <Plus className="w-4 h-4" />
            Log Post
          </button>
        </div>
      </div>

      {/* Mobile Nav to Raw-to-Post */}
      <button
        onClick={() => { window.location.hash = 'raw-to-post'; }}
        className="sm:hidden flex items-center justify-between px-4 py-3 border-b transition-all"
        style={{
          borderColor: 'var(--space-border-default)',
          background: 'var(--space-surface-card)',
        }}
      >
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4" style={{ color: 'var(--space-brand-primary)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--space-text-primary)' }}>
            Turn raw notes into posts
          </span>
        </div>
        <ArrowRight className="w-4 h-4" style={{ color: 'var(--space-text-muted)' }} />
      </button>

      {/* Stats Bar */}
      <div
        className="grid grid-cols-3 divide-x"
        style={{ borderBottom: '1px solid var(--space-border-default)', borderColor: 'var(--space-border-default)', background: 'var(--space-surface-muted)' }}
      >
        {[
          { icon: <Flame className="w-4 h-4" />, value: streak, label: 'Day streak', accent: streak >= 3 },
          { icon: <BarChart2 className="w-4 h-4" />, value: totalPosts, label: 'Posts logged', accent: false },
          { icon: <TrendingUp className="w-4 h-4" />, value: `${totalPosts ? Math.round((highCount / totalPosts) * 100) : 0}%`, label: 'High eng.', accent: highCount > 0 },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col items-center py-3 px-2">
            <div
              className="mb-0.5"
              style={{ color: stat.accent ? 'var(--space-brand-primary)' : 'var(--space-text-muted)' }}
            >
              {stat.icon}
            </div>
            <span
              className="text-xl font-bold"
              style={{ color: stat.accent ? 'var(--space-brand-primary)' : 'var(--space-text-primary)' }}
            >
              {stat.value}
            </span>
            <span className="text-xs" style={{ color: 'var(--space-text-muted)' }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Log Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 border-b"
          style={{
            borderColor: 'var(--space-border-default)',
            background: 'var(--space-surface-panel)',
          }}
        >
          <h2 className="font-semibold text-sm" style={{ color: 'var(--space-text-primary)' }}>
            Log a post
          </h2>

          {/* Date + Platform row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--space-text-secondary)' }}>Date posted</label>
              <input
                type="date"
                value={form.post_date}
                onChange={e => setForm(f => ({ ...f, post_date: e.target.value }))}
                required
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{
                  background: 'var(--space-surface-card)',
                  border: '1.5px solid var(--space-border-default)',
                  color: 'var(--space-text-primary)',
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--space-text-secondary)' }}>Platform</label>
              <select
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value as Platform }))}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{
                  background: 'var(--space-surface-card)',
                  border: '1.5px solid var(--space-border-default)',
                  color: 'var(--space-text-primary)',
                }}
              >
                {PLATFORMS.map(p => (
                  <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--space-text-secondary)' }}>Story theme</label>
            <select
              value={form.theme}
              onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{
                background: 'var(--space-surface-card)',
                border: '1.5px solid var(--space-border-default)',
                color: 'var(--space-text-primary)',
              }}
            >
              {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Engagement Level */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--space-text-secondary)' }}>Engagement level</label>
            <div className="flex gap-2">
              {ENGAGEMENT_LEVELS.map(eng => (
                <button
                  key={eng.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, engagement_level: eng.value }))}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: form.engagement_level === eng.value ? eng.bg : 'var(--space-surface-card)',
                    color: form.engagement_level === eng.value ? eng.color : 'var(--space-text-muted)',
                    border: `1.5px solid ${form.engagement_level === eng.value ? eng.color : 'var(--space-border-default)'}`,
                  }}
                >
                  {eng.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'replies', label: 'Replies', icon: <MessageSquare className="w-3 h-3" /> },
              { key: 'saves', label: 'Saves', icon: <Bookmark className="w-3 h-3" /> },
              { key: 'follows', label: 'Follows', icon: <Users className="w-3 h-3" /> },
            ].map(({ key, label, icon }) => (
              <div key={key}>
                <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--space-text-secondary)' }}>
                  {icon} {label}
                </label>
                <input
                  type="number"
                  min="0"
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: 'var(--space-surface-card)',
                    border: '1.5px solid var(--space-border-default)',
                    color: 'var(--space-text-primary)',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--space-text-secondary)' }}>
              Notes (optional)
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="What did you notice? What would you change next time?"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
              style={{
                background: 'var(--space-surface-card)',
                border: '1.5px solid var(--space-border-default)',
                color: 'var(--space-text-primary)',
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'var(--space-brand-primary)',
                color: 'var(--space-text-on-primary)',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save Post'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'var(--space-surface-muted)', color: 'var(--space-text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tab Switcher */}
      <div
        className="flex border-b px-5 gap-1 pt-3"
        style={{ borderColor: 'var(--space-border-default)', background: 'var(--space-surface-card)' }}
      >
        {[
          { key: 'log', label: 'Post Log', icon: <Calendar className="w-3.5 h-3.5" /> },
          { key: 'insights', label: 'Insights', icon: <Lightbulb className="w-3.5 h-3.5" /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'log' | 'insights')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-all border-b-2"
            style={{
              color: tab === t.key ? 'var(--space-brand-primary)' : 'var(--space-text-muted)',
              borderBottomColor: tab === t.key ? 'var(--space-brand-primary)' : 'transparent',
              background: 'transparent',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* INSIGHTS TAB */}
        {tab === 'insights' && (
          <div className="space-y-4">
            {/* Top performing theme */}
            {topTheme && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'var(--space-surface-accent-soft)',
                  border: '1.5px solid var(--space-brand-highlight)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4" style={{ color: 'var(--space-brand-highlight)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--space-text-accent)' }}>
                    Your best-performing theme
                  </span>
                </div>
                <p className="text-lg font-bold" style={{ color: 'var(--space-text-primary)' }}>
                  {topTheme.theme}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--space-text-secondary)' }}>
                  {topTheme.count} posts · avg {topTheme.avgEngagement} engagement
                </p>
                <p className="text-sm mt-2 font-medium" style={{ color: 'var(--space-text-accent)' }}>
                  → Post another "{topTheme.theme}" this week to keep your best momentum going.
                </p>
              </div>
            )}

            {/* AI-generated insights */}
            {insights.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--space-text-primary)' }}>
                  Pattern insights
                </h3>
                {insights.map((insight, i) => (
                  <div
                    key={i}
                    className="flex gap-3 p-4 rounded-xl"
                    style={{
                      background: 'var(--space-surface-card)',
                      border: '1px solid var(--space-border-default)',
                    }}
                  >
                    <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                    <p className="text-sm" style={{ color: 'var(--space-text-primary)', lineHeight: '1.6' }}>
                      {insight}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--space-text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--space-text-primary)' }}>
                  Log 3+ posts to unlock insights
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--space-text-muted)' }}>
                  Bipp will spot your best themes and posting patterns.
                </p>
              </div>
            )}

            {/* Theme breakdown */}
            {totalPosts > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--space-text-primary)' }}>
                  Theme breakdown
                </h3>
                {(() => {
                  const counts: Record<string, { low: number; medium: number; high: number }> = {};
                  (posts || []).forEach(p => {
                    if (!counts[p.theme]) counts[p.theme] = { low: 0, medium: 0, high: 0 };
                    counts[p.theme][p.engagement_level]++;
                  });
                  return Object.entries(counts)
                    .sort((a, b) => (b[1].high * 3 + b[1].medium * 2 + b[1].low) - (a[1].high * 3 + a[1].medium * 2 + a[1].low))
                    .slice(0, 6)
                    .map(([theme, counts]) => {
                      const total = counts.low + counts.medium + counts.high;
                      const highPct = Math.round((counts.high / total) * 100);
                      return (
                        <div
                          key={theme}
                          className="flex items-center justify-between p-3 rounded-lg"
                          style={{
                            background: 'var(--space-surface-muted)',
                            border: '1px solid var(--space-border-default)',
                          }}
                        >
                          <div>
                            <span className="text-sm font-medium" style={{ color: 'var(--space-text-primary)' }}>
                              {theme}
                            </span>
                            <span className="ml-2 text-xs" style={{ color: 'var(--space-text-muted)' }}>
                              {total} post{total !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Mini bar */}
                            <div className="flex gap-0.5 h-4 items-end">
                              {(['low', 'medium', 'high'] as EngagementLevel[]).map(eng => {
                                const c = counts[eng];
                                const style = getEngagementStyle(eng);
                                return c > 0 ? (
                                  <div
                                    key={eng}
                                    className="w-2 rounded-sm"
                                    style={{
                                      background: style.color,
                                      height: `${Math.max(25, (c / Math.max(...Object.values(counts))) * 100)}%`,
                                      opacity: 0.8,
                                    }}
                                  />
                                ) : null;
                              })}
                            </div>
                            {highPct > 0 && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: '#f0fdf4', color: '#16a34a' }}
                              >
                                {highPct}% 🔥
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            )}
          </div>
        )}

        {/* LOG TAB */}
        {tab === 'log' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <div
                  className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
                  style={{ borderColor: 'var(--space-brand-primary)', borderTopColor: 'transparent' }}
                />
                <p className="text-sm" style={{ color: 'var(--space-text-muted)' }}>Loading…</p>
              </div>
            ) : !posts || posts.length === 0 ? (
              <div className="text-center py-12">
                <LineChart className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--space-text-muted)' }} />
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--space-text-primary)' }}>
                  No posts logged yet
                </p>
                <p className="text-xs" style={{ color: 'var(--space-text-muted)' }}>
                  Hit "Log Post" to start tracking your posting consistency.
                </p>
              </div>
            ) : (
              posts.map((post) => {
                const eng = getEngagementStyle(post.engagement_level);
                const plat = PLATFORMS.find(p => p.value === post.platform);
                return (
                  <div
                    key={post.id}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: 'var(--space-surface-card)',
                      border: '1.5px solid var(--space-border-default)',
                    }}
                  >
                    <div className="flex items-start justify-between p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-semibold" style={{ color: 'var(--space-text-muted)' }}>
                            {plat?.emoji} {post.post_date}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: eng.bg, color: eng.color }}
                          >
                            {eng.label}
                          </span>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--space-text-primary)' }}>
                          {post.theme}
                        </p>
                        {post.notes && (
                          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--space-text-secondary)' }}>
                            {post.notes}
                          </p>
                        )}
                        {(post.replies > 0 || post.saves > 0 || post.follows > 0) && (
                          <div className="flex items-center gap-3 mt-2">
                            {post.replies > 0 && (
                              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--space-text-muted)' }}>
                                <MessageSquare className="w-3 h-3" /> {post.replies}
                              </span>
                            )}
                            {post.saves > 0 && (
                              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--space-text-muted)' }}>
                                <Bookmark className="w-3 h-3" /> {post.saves}
                              </span>
                            )}
                            {post.follows > 0 && (
                              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--space-text-muted)' }}>
                                <Users className="w-3 h-3" /> {post.follows}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={deletingId === post.id}
                        className="ml-3 p-1.5 rounded-lg transition-all flex-shrink-0"
                        style={{ color: 'var(--space-text-muted)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConsistencyPulse() {
  const workspaceDbReady = useWorkspaceDbReady();
  if (!workspaceDbReady) return <WorkspaceDbUnavailable />;
  return <ConsistencyPulseDb />;
}
