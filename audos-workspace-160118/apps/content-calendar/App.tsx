import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, Circle, Megaphone, Pencil, Plus, RefreshCw, Trash2, Video, X } from 'lucide-react';

const STORAGE_KEY = 'bipp.contentCalendar.v1';
const CALENDAR_CHANNEL = 'bipp-content-calendar';

type CalendarItemType = 'organic' | 'paid' | 'strategy';
type CalendarItemStatus = 'planned' | 'done';
type CalendarItemSource = 'chat' | 'manual' | 'raw-to-post' | 'scheduled';

interface CalendarItem {
  id: string;
  date: string;
  type: CalendarItemType;
  channel: string;
  title: string;
  task: string;
  angle: string;
  status: CalendarItemStatus;
  source: CalendarItemSource;
  scheduledAt?: string;
  contentPreview?: string;
  scheduleId?: string;
}

interface CalendarPlan {
  version: 1;
  sourceHash: string;
  updatedAt: string;
  sourceSummary: string;
  audience: string;
  challenge: string;
  why: string;
  items: CalendarItem[];
}

const EMPTY_PLAN: CalendarPlan = {
  version: 1,
  sourceHash: 'empty',
  updatedAt: new Date().toISOString(),
  sourceSummary: 'No marketing plan generated yet',
  audience: 'your best-fit customers',
  challenge: 'turning attention into customer conversations',
  why: 'the reason you started building',
  items: [],
};

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeSource(value: unknown): CalendarItemSource {
  return value === 'manual' || value === 'raw-to-post' || value === 'scheduled' ? value : 'chat';
}

function polishGrowthChallenge(value: string | undefined): string {
  let text = (value || EMPTY_PLAN.challenge)
    .replace(/[*_>#~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stopMatch = text.match(/\b(?:help me|can you|could you|please help|what should i)\b/i);
  if (stopMatch?.index && stopMatch.index > 20) {
    text = text.slice(0, stopMatch.index).trim();
  }

  const replacements: Array<[RegExp, string]> = [
    [/^i\s+want\s+to\s+make\s+content\s+about\s+/i, 'Turning '],
    [/^i\s+want\s+to\s+/i, 'Turning '],
    [/^i\s+need\s+to\s+/i, 'Turning '],
    [/^i\s+am\s+struggling\s+to\s+/i, 'Struggling to '],
    [/^i'm\s+struggling\s+to\s+/i, 'Struggling to '],
    [/\bmy journey creating\b/gi, 'the founder story behind'],
    [/\bmy journey\b/gi, 'the founder story'],
    [/\bcreating a\b/gi, 'building a'],
    [/\brecipe generator\b/gi, 'recipe-generator'],
    [/\bbot\b/gi, 'product'],
    [/\bworking parents and people who struggle to find motivation to take care of themselves\b/gi, 'working parents who struggle with self-care'],
    [/\bpeople who struggle to find motivation to take care of themselves\b/gi, 'people who struggle with self-care'],
    [/\btake care of themselves\b/gi, 'self-care'],
    [/\s+\b[ad]\b$/i, ''],
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text
    .replace(/\s+/g, ' ')
    .replace(/^["']+|["'.]+$/g, '')
    .trim();
  if (!text || text.length < 8) text = EMPTY_PLAN.challenge;
  if (text.length > 150) {
    text = text.slice(0, 150).replace(/\s+\S*$/, '').trim();
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cleanCalendarText(value: string | undefined): string {
  return (value || '')
    .replace(/[*_>#~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const trimmed = text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  return trimmed || text.slice(0, maxLength).trim();
}

function normalizeCalendarCopy(value: string | undefined): string {
  return cleanCalendarText(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\b(the|a|an|to|and|or|for|with|about|it|this|that)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSameCalendarCopy(left: string | undefined, right: string | undefined): boolean {
  const normalizedLeft = normalizeCalendarCopy(left);
  const normalizedRight = normalizeCalendarCopy(right);
  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}

function isGenericRawToPostLauncher(value: string | undefined): boolean {
  const text = cleanCalendarText(value).toLowerCase();
  if (!text) return false;
  if (/^open\s+raw-to-post$/.test(text)) return true;
  return /^open\s+raw-to-post\s+and\s+record(?:\s+a)?(?:\s+quick)?\s+video(?:\s+about\s+(?:it|this|that))?$/.test(text);
}

function isWeakGeneratedText(value: string | undefined): boolean {
  const text = cleanCalendarText(value);
  if (!text || text.length < 8) return true;
  if (isGenericRawToPostLauncher(text)) return true;
  if (/^(?:content|post|task|idea|story|hook|angle|open raw-to-post)$/i.test(text)) return true;
  if (/\b(?:about|on)\s+(?:it|this|that)\b/i.test(text) && /raw-to-post|quick video|record/i.test(text)) return true;
  return false;
}

function getCalendarSubject(item: CalendarItem, challenge: string): string {
  const candidates = [item.title, item.angle, item.task, challenge]
    .map((candidate) => cleanCalendarText(candidate)
      .replace(/^(?:open\s+)?raw-to-post\s*(?:and\s+record(?:\s+a)?(?:\s+quick)?\s+video)?\s*(?:about\s*)?/i, '')
      .replace(/^(?:write|create|record|draft|publish|post|make)\s+(?:a|an|one)?\s*/i, '')
      .replace(/\b(?:about|on)\s+(?:it|this|that)\b/i, '')
      .trim())
    .filter((candidate) => candidate.length >= 8 && !isGenericRawToPostLauncher(candidate));

  const unique = candidates.find((candidate, index, all) =>
    index === all.findIndex((other) => normalizeCalendarCopy(other) === normalizeCalendarCopy(candidate))
  );
  return truncateAtWord(unique || challenge || 'a specific content idea', 90);
}

function buildActionableTask(item: CalendarItem, challenge: string): string {
  const subject = getCalendarSubject(item, challenge);
  const haystack = `${item.channel} ${item.title}`;

  if (/why|origin|started|founder story/i.test(item.title)) {
    return 'Write the origin-story post around one specific moment: what made the problem obvious, what you tried, and what changed.';
  }
  if (/raw-to-post|reel|video/i.test(haystack)) {
    return `Record a 60-second video on ${subject}. Lead with one concrete moment, one lesson, and the next step.`;
  }
  if (/carousel/i.test(haystack)) {
    return `Create a carousel on ${subject}. Use five slides: hook, pain, lesson, example, and CTA.`;
  }
  if (/linkedin|thread|twitter|x|threads|post/i.test(haystack)) {
    return `Write a post on ${subject}. Include a specific scene, the insight it proves, and a question or CTA.`;
  }
  if (/outbound|customer|research/i.test(haystack)) {
    return `Message five relevant people about ${subject}. Ask one specific question and save the best replies.`;
  }
  if (/ad|meta|google|paid/i.test(haystack)) {
    return `Draft one test hook around ${subject}. State the pain clearly and define the response you want.`;
  }
  return `Turn ${subject} into a concrete deliverable with a hook, proof point, and next step.`;
}

function buildActionableAngle(item: CalendarItem, challenge: string, audience: string): string {
  const haystack = `${item.channel} ${item.title} ${item.task}`;
  if (/why|origin|started|founder story/i.test(item.title)) {
    return 'Build trust by showing why this problem matters before asking people to care about the product.';
  }
  if (/raw-to-post|reel|video/i.test(haystack)) {
    return 'Use video to make the idea specific, personal, and easy to repurpose.';
  }
  if (/outbound|customer|research/i.test(haystack)) {
    return `Learn what ${audience || 'customers'} actually say before turning the idea into more content.`;
  }
  if (/ad|meta|google|paid/i.test(haystack)) {
    return 'Test whether the pain and promise are clear enough to earn a response.';
  }
  return `Connect the post to ${challenge || 'the current growth goal'} with a clear takeaway.`;
}

function polishGeneratedCalendarItem(item: CalendarItem, challenge: string, audience: string): CalendarItem | null {
  if (item.source !== 'chat') return item;
  if (/-month-\d+$/i.test(item.id) || /^supports the month-one strategy\b/i.test(item.angle)) return null;
  if (isGenericRawToPostLauncher(item.title) || isGenericRawToPostLauncher(item.task)) return null;
  if (isWeakGeneratedText(item.title) && isWeakGeneratedText(item.task)) return null;

  const next = { ...item };
  if (
    isWeakGeneratedText(next.task) ||
    isSameCalendarCopy(next.task, next.title) ||
    isSameCalendarCopy(next.task, next.angle)
  ) {
    next.task = buildActionableTask(next, challenge);
  }
  if (
    isWeakGeneratedText(next.angle) ||
    isSameCalendarCopy(next.angle, next.title) ||
    isSameCalendarCopy(next.angle, next.task)
  ) {
    next.angle = buildActionableAngle(next, challenge, audience);
  }

  return next;
}

function dedupeCalendarItems(items: CalendarItem[]): CalendarItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const signature = item.source === 'chat'
      ? `${item.date}:${normalizeCalendarCopy(`${item.channel} ${item.title} ${item.task}`)}`
      : item.id;
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function loadPlan(): CalendarPlan {
  if (typeof window === 'undefined') return EMPTY_PLAN;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PLAN;
    const parsed = JSON.parse(raw) as Partial<CalendarPlan>;
    if (!Array.isArray(parsed.items)) return EMPTY_PLAN;
    const rawChallenge = parsed.challenge || EMPTY_PLAN.challenge;
    const challenge = polishGrowthChallenge(rawChallenge);
    const normalizedItems = parsed.items.map((item) => {
      const normalizedItem: CalendarItem = {
        id: item.id || createId(),
        date: item.date || new Date().toISOString().slice(0, 10),
        type: item.type === 'paid' || item.type === 'strategy' ? item.type : 'organic',
        channel: cleanCalendarText(item.channel) || 'Content',
        title: cleanCalendarText(item.title) || 'Untitled task',
        task: rawChallenge && challenge !== rawChallenge ? cleanCalendarText(item.task).split(rawChallenge).join(challenge) : cleanCalendarText(item.task),
        angle: rawChallenge && challenge !== rawChallenge ? cleanCalendarText(item.angle).split(rawChallenge).join(challenge) : cleanCalendarText(item.angle),
        status: item.status === 'done' ? 'done' : 'planned',
        source: normalizeSource(item.source),
        scheduledAt: typeof item.scheduledAt === 'string' ? item.scheduledAt : undefined,
        contentPreview: typeof item.contentPreview === 'string' ? item.contentPreview : undefined,
        scheduleId: typeof item.scheduleId === 'string' ? item.scheduleId : undefined,
      };
      return polishGeneratedCalendarItem(normalizedItem, challenge, parsed.audience || EMPTY_PLAN.audience);
    }).filter((item): item is CalendarItem => Boolean(item));

    return {
      ...EMPTY_PLAN,
      ...parsed,
      challenge,
      items: dedupeCalendarItems(normalizedItems),
    } as CalendarPlan;
  } catch {
    return EMPTY_PLAN;
  }
}

function publishPlanUpdate(plan: CalendarPlan): void {
  const serialized = JSON.stringify(plan);
  window.localStorage.setItem(STORAGE_KEY, serialized);
  window.dispatchEvent(new CustomEvent('bipp:content-calendar-updated', { detail: plan }));
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: serialized,
    }));
  } catch {
    // Some embedded browsers do not support constructing StorageEvent.
  }
  try {
    const channel = new BroadcastChannel(CALENDAR_CHANNEL);
    channel.postMessage(plan);
    channel.close();
  } catch {
    // BroadcastChannel is best-effort; localStorage remains the source of truth.
  }
  try {
    window.parent?.postMessage({ type: 'bipp:content-calendar-updated', calendar: plan }, '*');
  } catch {
    // Cross-frame notifications are best-effort.
  }
}

function savePlan(plan: CalendarPlan): void {
  publishPlanUpdate(plan);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateTimeLocal(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function openApp(appId: string): void {
  window.dispatchEvent(new CustomEvent('openApp', { detail: { appId } }));
}

function openBippChat(): void {
  const bippButton = Array.from(document.querySelectorAll('button')).find((button) => {
    return (button.textContent || '').trim() === 'Bipp' && window.getComputedStyle(button).position === 'fixed';
  }) as HTMLButtonElement | undefined;
  if (bippButton) {
    bippButton.click();
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('screen');
  url.searchParams.delete('app');
  url.searchParams.set('bippView', 'chat');
  window.location.href = `${url.pathname}${url.search}${url.hash}`;
}

function isRawToPostItem(item: CalendarItem): boolean {
  return (
    item.source === 'raw-to-post' ||
    item.source === 'scheduled' ||
    /raw-to-post/i.test(item.channel) ||
    /raw-to-post/i.test(item.task) ||
    /raw-to-post/i.test(item.title)
  );
}

const TYPE_LABELS: Record<CalendarItemType, string> = {
  organic: 'Organic',
  paid: 'Paid',
  strategy: 'Strategy',
};

function formatScheduled(at?: string): string {
  if (!at) return '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ContentCalendar() {
  const [plan, setPlan] = useState<CalendarPlan>(() => loadPlan());
  const latestPlanRawRef = useRef<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CalendarItem>>({});
  const [draft, setDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'organic' as CalendarItemType,
    channel: 'LinkedIn',
    title: '',
    task: '',
    angle: '',
  });

  useEffect(() => {
    latestPlanRawRef.current = window.localStorage.getItem(STORAGE_KEY) || '';
    const refresh = () => {
      const raw = window.localStorage.getItem(STORAGE_KEY) || '';
      if (raw === latestPlanRawRef.current) return;
      latestPlanRawRef.current = raw;
      setPlan(loadPlan());
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== STORAGE_KEY) return;
      refresh();
    };
    const handleCalendarEvent = () => refresh();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'bipp:content-calendar-updated') return;
      if (event.data.calendar) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event.data.calendar));
      }
      refresh();
    };
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CALENDAR_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event.data));
        }
        refresh();
      };
    } catch {
      channel = null;
    }

    const intervalId = window.setInterval(refresh, 1500);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('bipp:content-calendar-updated', handleCalendarEvent);
    window.addEventListener('message', handleMessage);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bipp:content-calendar-updated', handleCalendarEvent);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      channel?.close();
    };
  }, []);

  const sortedItems = useMemo(
    () => [...plan.items].sort((left, right) => left.date.localeCompare(right.date)),
    [plan.items]
  );

  const updatePlan = (updater: (current: CalendarPlan) => CalendarPlan) => {
    setPlan((current) => {
      const next = { ...updater(current), updatedAt: new Date().toISOString() };
      latestPlanRawRef.current = JSON.stringify(next);
      savePlan(next);
      return next;
    });
  };

  const updateItem = (itemId: string, updates: Partial<CalendarItem>) => {
    updatePlan((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, ...updates } : item),
    }));
  };

  const toggleItem = (itemId: string) => {
    updatePlan((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId
        ? { ...item, status: item.status === 'done' ? 'planned' : 'done' }
        : item
      ),
    }));
  };

  const deleteItem = (itemId: string) => {
    if (editingId === itemId) setEditingId(null);
    updatePlan((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));
  };

  const startEdit = (item: CalendarItem) => {
    setEditingId(item.id);
    setEditDraft({
      date: item.date,
      type: item.type,
      channel: item.channel,
      title: item.title,
      task: item.task,
      angle: item.angle,
      scheduledAt: item.scheduledAt,
      contentPreview: item.contentPreview,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = (itemId: string) => {
    if (!editDraft.title?.trim() || !editDraft.task?.trim()) return;
    updateItem(itemId, {
      date: editDraft.date || todayDate(),
      type: (editDraft.type as CalendarItemType) || 'organic',
      channel: (editDraft.channel || '').trim() || 'Content',
      title: editDraft.title.trim(),
      task: editDraft.task.trim(),
      angle: (editDraft.angle || '').trim() || 'Manual calendar item',
      scheduledAt: editDraft.scheduledAt,
      contentPreview: editDraft.contentPreview,
    });
    setEditingId(null);
    setEditDraft({});
  };

  const addItem = () => {
    if (!draft.title.trim() || !draft.task.trim()) return;
    const nextItem: CalendarItem = {
      id: createId(),
      date: draft.date,
      type: draft.type,
      channel: draft.channel.trim() || 'Content',
      title: draft.title.trim(),
      task: draft.task.trim(),
      angle: draft.angle.trim() || 'Manual calendar item',
      status: 'planned',
      source: 'manual',
    };

    updatePlan((current) => ({
      ...current,
      sourceHash: current.sourceHash === 'empty' ? 'manual' : current.sourceHash,
      sourceSummary: current.sourceHash === 'empty' ? 'Manual marketing calendar' : current.sourceSummary,
      items: [...current.items, nextItem],
    }));
    setDraft({
      date: new Date().toISOString().slice(0, 10),
      type: 'organic',
      channel: 'LinkedIn',
      title: '',
      task: '',
      angle: '',
    });
    setShowAddForm(false);
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="border-b border-[var(--space-border-default)] bg-[var(--space-surface-card)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" style={{ color: '#2563eb' }} />
              <h2 className="text-lg font-semibold text-gray-900">Content Calendar</h2>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Tasks from your Bipp conversation, Raw-to-Post schedules, and manual reminders.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openBippChat}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Megaphone className="h-4 w-4" />
              Plan with Bipp
            </button>
            <button
              onClick={() => setPlan(loadPlan())}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Add task
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showAddForm && (
          <div className="border-b border-[var(--space-border-default)] bg-[var(--space-surface-panel)] px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Add calendar task</h3>
              <button onClick={() => setShowAddForm(false)} className="rounded-lg p-1 text-gray-500 hover:bg-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="date"
                value={draft.date}
                onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <select
                value={draft.type}
                onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as CalendarItemType }))}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="organic">Organic</option>
                <option value="paid">Paid</option>
                <option value="strategy">Strategy</option>
              </select>
              <input
                type="text"
                value={draft.channel}
                onChange={(event) => setDraft((current) => ({ ...current, channel: event.target.value }))}
                placeholder="Channel"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                type="text"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Task title"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 md:col-span-3"
              />
              <textarea
                value={draft.task}
                onChange={(event) => setDraft((current) => ({ ...current, task: event.target.value }))}
                rows={3}
                placeholder="What should be created or done?"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 md:col-span-2"
              />
              <textarea
                value={draft.angle}
                onChange={(event) => setDraft((current) => ({ ...current, angle: event.target.value }))}
                rows={3}
                placeholder="Angle or goal"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={addItem}
                disabled={!draft.title.trim() || !draft.task.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save task
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 p-5">
          {sortedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8">
              <div className="mx-auto max-w-2xl text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-gray-400" />
                <h3 className="mt-3 text-base font-semibold text-gray-900">Your content calendar is blank</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600">
                  You haven&rsquo;t planned any tasks yet. Talk to Bipp to come up with a content plan, or manually add a task to keep track of it here.
                </p>
              </div>

              <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openBippChat}
                  className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-left transition hover:border-blue-200 hover:bg-blue-100"
                >
                  <Megaphone className="h-6 w-6 text-blue-600" />
                  <p className="mt-3 text-sm font-semibold text-gray-900">Talk to Bipp</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">Chat with the agent to come up with a content plan and more tasks for your strategy.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-left transition hover:border-gray-300 hover:bg-gray-100"
                >
                  <Plus className="h-6 w-6 text-gray-700" />
                  <p className="mt-3 text-sm font-semibold text-gray-900">Add a task manually</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">Save a content idea, customer task, post draft, or campaign reminder yourself.</p>
                </button>
              </div>
            </div>
          ) : (
            sortedItems.map((item) => {
              const rawToPost = isRawToPostItem(item);
              const isEditing = editingId === item.id;
              const d = isEditing ? editDraft : item;
              const showTask = Boolean(item.task && !isSameCalendarCopy(item.task, item.title));
              const showAngle = Boolean(
                item.angle &&
                !isSameCalendarCopy(item.angle, item.title) &&
                !isSameCalendarCopy(item.angle, item.task)
              );
              return (
                <div
                  key={item.id}
                  className="rounded-xl border bg-white p-4 shadow-sm"
                  style={{ borderColor: item.status === 'done' ? '#bbf7d0' : '#e5e7eb' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border"
                      style={{
                        borderColor: item.status === 'done' ? '#16a34a' : '#d1d5db',
                        background: item.status === 'done' ? '#16a34a' : '#fff',
                        color: item.status === 'done' ? '#fff' : '#9ca3af',
                      }}
                    >
                      {item.status === 'done' ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <>
                          <div className="grid gap-2 md:grid-cols-[minmax(130px,0.8fr)_minmax(120px,0.8fr)_minmax(140px,1fr)_minmax(170px,1fr)]">
                            <input
                              type="date"
                              aria-label="Task date"
                              value={d.date || ''}
                              onChange={(event) => setEditDraft((current) => ({ ...current, date: event.target.value || todayDate() }))}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500"
                            />
                            <select
                              aria-label="Task type"
                              value={d.type || 'organic'}
                              onChange={(event) => setEditDraft((current) => ({ ...current, type: event.target.value as CalendarItemType }))}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500"
                            >
                              <option value="organic">Organic</option>
                              <option value="paid">Paid</option>
                              <option value="strategy">Strategy</option>
                            </select>
                            <input
                              type="text"
                              aria-label="Task channel"
                              value={d.channel || ''}
                              onChange={(event) => setEditDraft((current) => ({ ...current, channel: event.target.value }))}
                              placeholder="Channel"
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500"
                            />
                            <input
                              type="datetime-local"
                              aria-label="Scheduled date and time"
                              value={toDateTimeLocal(d.scheduledAt)}
                              onChange={(event) => setEditDraft((current) => ({ ...current, scheduledAt: fromDateTimeLocal(event.target.value) }))}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500"
                            />
                          </div>
                          <input
                            type="text"
                            aria-label="Task title"
                            value={d.title || ''}
                            onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))}
                            placeholder="Task title"
                            className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-base font-semibold text-gray-900 outline-none focus:border-blue-500"
                          />
                          <textarea
                            aria-label="Task details"
                            value={d.task || ''}
                            onChange={(event) => setEditDraft((current) => ({ ...current, task: event.target.value }))}
                            rows={2}
                            placeholder="What should be created or done?"
                            className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-gray-700 outline-none focus:border-blue-500"
                          />
                          <textarea
                            aria-label="Task angle"
                            value={d.angle || ''}
                            onChange={(event) => setEditDraft((current) => ({ ...current, angle: event.target.value }))}
                            rows={2}
                            placeholder="Angle or goal"
                            className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-600 outline-none focus:border-blue-500"
                          />
                          {d.contentPreview !== undefined && (
                            <textarea
                              aria-label="Task draft"
                              value={d.contentPreview || ''}
                              onChange={(event) => setEditDraft((current) => ({ ...current, contentPreview: event.target.value || undefined }))}
                              rows={4}
                              placeholder="Draft copy"
                              className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-600 outline-none focus:border-blue-500"
                            />
                          )}
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => saveEdit(item.id)}
                              disabled={!d.title?.trim() || !d.task?.trim()}
                              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">{formatDate(item.date)}</span>
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700">{TYPE_LABELS[item.type]}</span>
                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">{item.channel}</span>
                            {item.scheduledAt && (
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">Scheduled {formatScheduled(item.scheduledAt)}</span>
                            )}
                          </div>
                          <p className={`mt-2 text-base font-semibold text-gray-900 ${item.status === 'done' ? 'line-through opacity-60' : ''}`}>
                            {item.title}
                          </p>
                          {showTask && (
                            <p className="mt-1 text-sm leading-6 text-gray-700 whitespace-pre-wrap">{item.task}</p>
                          )}
                          {showAngle && (
                            <p className="mt-1 text-xs leading-5 text-gray-500">Angle: {item.angle}</p>
                          )}
                          {item.contentPreview && (
                            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600 whitespace-pre-wrap">
                              {item.contentPreview}
                            </div>
                          )}
                          {rawToPost && (
                            <button
                              onClick={() => openApp('raw-to-post')}
                              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              <Video className="h-3.5 w-3.5" />
                              Open in Raw-to-Post
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(item)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                          title="Edit task"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
