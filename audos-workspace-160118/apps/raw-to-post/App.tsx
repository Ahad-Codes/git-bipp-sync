import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Square, Calendar, Clock, ChevronLeft, ChevronRight, Copy, Check, Sparkles, Camera, RotateCcw, Trash2, Star, History, Monitor, Loader2, Download, Upload, ExternalLink, Play, Pause, Scissors, X, Undo2, Redo2 } from 'lucide-react';

/**
 * Raw-to-Post - VIDEO-FIRST Edition
 * Record or upload a video update and get a content plan from Gemini.
 *
 * Flow: Select Day → Record/Upload Video → Analyze → Review Content Plan
 */

declare global {
  interface Window {
    useWorkspaceDB: <T = any>(
      table: string,
      options?: {
        shared?: boolean;
        limit?: number;
        orderBy?: { column: string; direction: 'asc' | 'desc' };
        filters?: Array<{ column: string; operator: string; value: any }>;
      }
    ) => { data: T[]; loading: boolean; error: Error | null; total: number; refresh: () => void };
    __workspaceDb: {
      workspaceId?: string;
      token?: string;
      from: (table: string, options?: { shared?: boolean }) => {
        insert: (data: Record<string, any>) => Promise<any>;
        update: (id: number | string, data: Record<string, any>) => Promise<any>;
        delete: (id: number | string) => Promise<any>;
        get: (filters?: Array<{ column: string; operator: string; value: any }>) => Promise<any[] | { data?: any[] }>;
        eq?: (column: string, value: any) => any;
        where?: (column: string, operator: string, value: any) => any;
        orderBy?: (column: string, direction: 'asc' | 'desc') => any;
      };
    };
  }
}

type WorkspaceFilter = { column: string; operator: string; value: any };

interface Recording {
  id: number;
  video_url?: string;
  thumbnail_url?: string;
  duration_seconds: number;
  recording_date: string;
  status: 'pending' | 'analyzing' | 'ready' | 'error';
  title?: string;
  created_at?: string;
}

interface SaveVideoRecordingOptions {
  recordingDate: string;
  title: string;
  durationSeconds?: number;
  setAsCurrent?: boolean;
}

interface GeneratedPost {
  id: number;
  recording_id: number;
  post_format: string;
  content: string;
  is_favorite: boolean;
  created_at?: string;
}

type PostFormat = 'linkedin' | 'instagram-video' | 'instagram-carousel';

interface ContentOpportunity {
  format: PostFormat;
  title: string;
  why: string;
}

interface CarouselSlide {
  title: string;
  body: string;
}

interface EditableCarouselSlide {
  id: string;
  title: string;
  body: string;
}

interface CarouselTheme {
  fontLabel: string;
  fontStack: string;
  googleFamily: string | null;
  titleSize: number;
  bodySize: number;
  accent: string;
  subtitleColor: string;
  titleColor: string;
  bodyColor: string;
  bgFrom: string;
  bgMid: string;
  bgTo: string;
}

interface EditableCarouselDraft {
  title: string;
  slides: EditableCarouselSlide[];
  caption?: string;
  theme?: CarouselTheme;
}

interface RawClipSegment {
  startSeconds: number;
  endSeconds: number;
  reason?: string;
}

interface TimedCaptionWord {
  id: string;
  text: string;
  start: number;
  end: number;
}

interface TeleprompterClipSegment {
  id: string;
  start: number;
  end: number;
}

interface TeleprompterEditState {
  trimStart: number;
  trimEnd: number;
  clipSegments: TeleprompterClipSegment[];
  activeClipId: string | null;
}

type TeleprompterEditorTool = 'clip' | 'captions';
type VideoProcessingStage = 'idle' | 'saving' | 'analyzing';

interface VideoContentAnalysis {
  summary: string;
  contentPotential: 'strong' | 'needs-development' | 'low';
  recommendedFormat: PostFormat;
  reasoning: string;
  contentOpportunities: ContentOpportunity[];
  linkedinPost: {
    title: string;
    body: string;
  } | null;
  script: {
    title: string;
    hook: string;
    body: string;
    cta?: string;
  } | null;
  carousel: {
    title: string;
    slides: CarouselSlide[];
  } | null;
  rawClip: {
    usable: boolean;
    reasoning: string;
    hook: string;
    clipStartSeconds?: number;
    clipEndSeconds?: number;
    segments?: RawClipSegment[];
    structure?: string[];
    caption?: string;
  };
}

const CAROUSEL_FONTS: { label: string; stack: string; googleFamily: string | null }[] = [
  { label: 'Inter', stack: "'Inter', system-ui, sans-serif", googleFamily: 'Inter:wght@400;600;700;800;900' },
  { label: 'Poppins', stack: "'Poppins', system-ui, sans-serif", googleFamily: 'Poppins:wght@400;600;700;800;900' },
  { label: 'Montserrat', stack: "'Montserrat', system-ui, sans-serif", googleFamily: 'Montserrat:wght@400;600;700;800;900' },
  { label: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", googleFamily: 'Playfair+Display:wght@400;700;800;900' },
  { label: 'Lora', stack: "'Lora', Georgia, serif", googleFamily: 'Lora:wght@400;500;600;700' },
  { label: 'Roboto Slab', stack: "'Roboto Slab', Georgia, serif", googleFamily: 'Roboto+Slab:wght@400;700;800;900' },
  { label: 'DM Serif Display', stack: "'DM Serif Display', Georgia, serif", googleFamily: 'DM+Serif+Display:wght@400' },
  { label: 'System Sans', stack: 'system-ui, -apple-system, sans-serif', googleFamily: null },
  { label: 'Georgia', stack: "Georgia, 'Times New Roman', serif", googleFamily: null },
  { label: 'Courier', stack: "'Courier New', Courier, monospace", googleFamily: null },
];

const DEFAULT_CAROUSEL_THEME: CarouselTheme = {
  fontLabel: 'Inter',
  fontStack: "'Inter', system-ui, sans-serif",
  googleFamily: 'Inter:wght@400;600;700;800;900',
  titleSize: 82,
  bodySize: 42,
  accent: '#f97316',
  subtitleColor: '#9a3412',
  titleColor: '#111827',
  bodyColor: '#374151',
  bgFrom: '#fff7ed',
  bgMid: '#ffffff',
  bgTo: '#eff6ff',
};

function normalizeCarouselTheme(raw: any): CarouselTheme {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CAROUSEL_THEME };
  const fontMatch = CAROUSEL_FONTS.find(f => f.stack === raw.fontStack || f.label === raw.fontLabel);
  const font = fontMatch || CAROUSEL_FONTS[0];
  const num = (v: any, fallback: number) => (typeof v === 'number' && v > 0 ? v : fallback);
  const str = (v: any, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
  return {
    fontLabel: font.label,
    fontStack: font.stack,
    googleFamily: font.googleFamily,
    titleSize: Math.round(num(raw.titleSize, DEFAULT_CAROUSEL_THEME.titleSize)),
    bodySize: Math.round(num(raw.bodySize, DEFAULT_CAROUSEL_THEME.bodySize)),
    accent: str(raw.accent, DEFAULT_CAROUSEL_THEME.accent),
    subtitleColor: str(raw.subtitleColor, DEFAULT_CAROUSEL_THEME.subtitleColor),
    titleColor: str(raw.titleColor, DEFAULT_CAROUSEL_THEME.titleColor),
    bodyColor: str(raw.bodyColor, DEFAULT_CAROUSEL_THEME.bodyColor),
    bgFrom: str(raw.bgFrom, DEFAULT_CAROUSEL_THEME.bgFrom),
    bgMid: str(raw.bgMid, DEFAULT_CAROUSEL_THEME.bgMid),
    bgTo: str(raw.bgTo, DEFAULT_CAROUSEL_THEME.bgTo),
  };
}

const carouselFontLinkCache = new Set<string>();

async function ensureCarouselFontLoaded(theme: CarouselTheme): Promise<void> {
  const googleFamily = theme.googleFamily;
  if (googleFamily && !carouselFontLinkCache.has(googleFamily)) {
    carouselFontLinkCache.add(googleFamily);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${googleFamily}&display=block`;
    document.head.appendChild(link);
  }
  const fontsApi = (document as any).fonts;
  if (fontsApi && typeof fontsApi.load === 'function') {
    try {
      await fontsApi.load(`800 ${Math.round(theme.titleSize * 0.85)}px ${theme.fontStack}`);
      await fontsApi.load(`500 ${theme.bodySize}px ${theme.fontStack}`);
      if (fontsApi.ready && typeof fontsApi.ready.then === 'function') {
        await fontsApi.ready;
      }
    } catch { /* best-effort font load */ }
  }
}

const FORMAT_OPTIONS: { value: PostFormat; label: string; icon: string; desc: string }[] = [
  { value: 'linkedin', label: 'LinkedIn Post', icon: '💼', desc: 'Thoughtful professional text post' },
  { value: 'instagram-video', label: 'Instagram Video Script', icon: '🎥', desc: 'Talk-to-camera script from the strongest idea' },
  { value: 'instagram-carousel', label: 'Instagram Carousel', icon: '▦', desc: 'Multi-slide teaching or story outline' },
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TELEPROMPTER_MIME_TYPES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];
const AUDIO_TRANSCRIPTION_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];
const LINKEDIN_DRAFT_STORAGE_PREFIX = 'rawToPost.linkedinDraft';
const INSTAGRAM_SCRIPT_DRAFT_STORAGE_PREFIX = 'rawToPost.instagramScriptDraft';
const INSTAGRAM_CAROUSEL_DRAFT_STORAGE_PREFIX = 'rawToPost.instagramCarouselDraft';
const INSTAGRAM_CAROUSEL_GUIDANCE_STORAGE_PREFIX = 'rawToPost.instagramCarouselGuidance';
const CONTENT_PLAN_STORAGE_PREFIX = 'rawToPost.contentPlan';
const VIDEO_RECORDINGS_STORAGE_PREFIX = 'rawToPost.videoRecordings';
const SELECTED_FORMAT_STORAGE_PREFIX = 'rawToPost.selectedFormat';
const REPLACED_AT_STORAGE_PREFIX = 'rawToPost.replacedAt';
const TELEPROMPTER_EDIT_STORAGE_PREFIX = 'rawToPost.teleprompterEdits';
const BIPP_CONTENT_CALENDAR_STORAGE_KEY = 'bipp.contentCalendar.v1';
const INSTAGRAM_SCHEDULE_HOOK_NAME = 'bipp-publish-instagram-post';

const RAW_TO_POST_STYLE_RULES = `## STYLE RULES (apply to every generated script, post, caption, and slide)

Formatting:
- No more than 1-3 lines per paragraph or line break. Posts and scripts can vary in overall length, but never write paragraphs of dense text.

Voice & style — avoid these patterns:
- Question-then-answer reveals: e.g. "The answer? This." or any format that poses a question and immediately answers it in a punchy one-liner.
- Staccato verb lists: e.g. "Build. Ship. Learn." — do not list items as one-word-per-sentence in rapid succession.
- Overly punchy or clickbait sentence construction in general.

Instead, write in a voice that is:
- Human, honest, and conversational — like the founder is talking directly to someone.
- Structured as hook -> content -> CTA: the hook draws people in, the body delivers a real idea or story, and the CTA invites engagement with a genuine question or prompt.
- Varied in sentence length — mix short and medium sentences naturally, not artificially.
- Grounded and personal — share real context, real stakes, real feelings rather than motivational-poster energy.`;

const RAW_TO_POST_REFERENCE_EXAMPLES = `## REFERENCE EXAMPLES — study structure, not topic

The following scripts have proven viral engagement. Study how they open, develop the idea, and close — NOT their topic matter (combat sports, grief coaching). Do not copy or mention their topics, names, or communities unless they appear in the founder's own material.

### Example 1: "How often should you spar people better than you?"
What would you do if you had to constantly fistfight people who are all significantly taller, heavier, and more skilled than you?

Only a slight exaggeration for hook purposes—that's my training reality. I go to awesome gyms, so everyone in the advanced classes is insanely good. I spend many hours a week learning purely by trial by fire, training with amateur and even pro competitors.

I saw this post saying that 10% of your time should be spent sparring with people who are more skilled. They're probably right, though I think there are merits to my own experience: training with more skilled people majority of the time.

You learn how to spar hard and understand your limits. You teach yourself how brave you are. Also, the more advanced people, especially in jiu jitsu, are more controlled than beginners. When you get rocked, you know how and why. It's not random spazzy stuff.

Yeah, it'd be nice to respectfully piece people up more often, but when I walk into work after getting my face elbowed, I feel like nothing can faze me anymore. Sometimes, training gets very discouraging, but it's made me very proud of my resilience.

How often do you spar with people better than you?

### Example 2: "Aggressive personality ≠ better fighter"
If you're an aggressive person, would you be better at martial arts?

Not necessarily.

This was a hard lesson I recently had to learn.

My fight or flight response has always been to fight. You'd think that would help me in MMA, but it doesn't.

My "fight" response makes me stand there when someone is attacking and wait for my time to strike, instead of evading or finding angles, which is not smart. And I throw shots frequently, which makes me predictable.

My coaches have been teaching me the importance of defense and "earning your offense." Everyone knows how to throw shots; that doesn't mean I'd be a good fighter. My biggest takeaway is that fighting is way more than waiting for your time to strike, just like a conversation is more than waiting for your time to talk.

How has your fight or flight response impacted your training?

### Example 3: "Why do you train so hard just to suck?"
"Why do I train so hard just to suck?"

If you've been asking yourself that lately, I have been, too. Here's how I found my answer.

For a while now, I've been spending 6-10 hours a week getting beaten up and slowly improving from trial by fire. My training partners are taller, heavier, more experienced, and frequently amateur or pro competitors.

Normally this is fun, but the physical and experience gaps feel like chasms sometimes. My breaking point was, after a long week of training, getting trapped in a choke that I totally expected but did not escape. I felt tired, helpless, and angry at myself.

I rested for a few days, then asked my training partners for advice.

A Muay Thai friend told me, "If you were gonna quit, you would feel discouraged or indifferent. But you're frustrated. That tells me you're gonna keep showing up. Use that frustration as fuel. This, too, shall pass."

And at jiu jitsu, I talked to other girls in the locker room of all belt levels, and they said they feel like they suck no matter how far they progress.

I realized that being burned out doesn't make me a quitter—quitters burn out, but so does everyone else. How I respond matters more. And, most importantly, the people that beat you up have your back.

Obviously, I'm not quitting. I've never given up on anything in my life.

Why do you train so hard just to suck?

### Example 4 (entrepreneur context — closest to this founder's use case):
Hi, my name is Sarah and I am the founder of Solace and grateful entrepreneur and partner of Audos.
After experiencing my own profound loss, and a lack of support in navigating life with grief, I set out to help others in the same situation by becoming a grief coach.
Helping individuals was powerful and special, and still is, but Audos gave me the technical and entrepreneurial knowledge to turn this into something bigger.
Through AI and their support, I built Solace - an AI grief coach, and platform of tools, that can now reach anyone, anywhere and help those navigating loss — be it loss of a friend or family member, loss of a pet, or even the loss of a home, a job, an identity, a sense of self or security, or however someone defines grief and loss.
I hope that this space helps people hold all of the emotions that come with grief, and to start to look forward — to learning to live with this loss.
Solace is now helping me envision what is next for my audience, where do we go from here, how to use AI to continue to expand the journey for my users in grief.`;

type CalendarItemType = 'organic' | 'paid' | 'strategy';
type CalendarItemStatus = 'planned' | 'done';
type CalendarItemSource = 'chat' | 'manual' | 'raw-to-post' | 'scheduled';

interface ContentCalendarItem {
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

interface ContentCalendarPlan {
  version: 1;
  sourceHash: string;
  updatedAt: string;
  sourceSummary: string;
  audience: string;
  challenge: string;
  why: string;
  items: ContentCalendarItem[];
}

function getWeekDates(referenceDate: Date): Date[] {
  const dates: Date[] = [];
  const day = referenceDate.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday is first day
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultScheduleDateTimeValue(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const roundedMinutes = Math.ceil(date.getMinutes() / 15) * 15;
  date.setMinutes(roundedMinutes === 60 ? 0 : roundedMinutes, 0, 0);
  if (roundedMinutes === 60) date.setHours(date.getHours() + 1);
  return formatDateTimeLocal(date);
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSupportedRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return TELEPROMPTER_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function getSupportedAudioRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return AUDIO_TRANSCRIPTION_MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function sanitizeFileBaseName(value: string): string {
  return value.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function getVideoExtension(mimeType?: string, sourceName?: string): string {
  const extensionMatch = sourceName?.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch?.[1]?.toLowerCase();
  if (extension && ['mp4', 'm4v', 'mov', 'webm', 'avi', 'mpeg', 'mpg', 'mkv', '3gp', '3gpp'].includes(extension)) {
    return extension;
  }
  if (mimeType?.includes('mp4') || mimeType?.includes('m4v')) return 'mp4';
  if (mimeType?.includes('quicktime')) return 'mov';
  if (mimeType?.includes('webm')) return 'webm';
  if (mimeType?.includes('x-msvideo')) return 'avi';
  if (mimeType?.includes('mpeg')) return 'mpg';
  if (mimeType?.includes('matroska')) return 'mkv';
  if (mimeType?.includes('3gpp')) return '3gp';
  return 'webm';
}

function getVideoUploadFileName(blob: Blob, fallbackName = 'video'): string {
  const sourceName = typeof File !== 'undefined' && blob instanceof File ? blob.name : '';
  const baseName = sanitizeFileBaseName(sourceName || fallbackName) || 'video';
  return `${baseName}.${getVideoExtension(blob.type, sourceName)}`;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatTrimTime(value: number): string {
  const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.floor(safeValue % 60);
  const tenths = Math.floor((safeValue % 1) * 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function createTeleprompterClipSegment(start: number, end: number): TeleprompterClipSegment {
  return {
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    start,
    end,
  };
}

function hashStorageKey(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getTeleprompterEditStorageKey(
  recordingId: number | null,
  date: string,
  sourceKey: string
): string {
  if (recordingId) return `${TELEPROMPTER_EDIT_STORAGE_PREFIX}.recording.${recordingId}`;
  return `${TELEPROMPTER_EDIT_STORAGE_PREFIX}.source.${hashStorageKey(`${date}:${sourceKey || 'self-tape'}`)}`;
}

function copyTeleprompterClipSegments(segments: TeleprompterClipSegment[]): TeleprompterClipSegment[] {
  return segments.map(segment => ({ ...segment }));
}

function normalizeTeleprompterEditState(
  state: Partial<TeleprompterEditState> | null | undefined,
  duration: number
): TeleprompterEditState {
  const safeDuration = Math.max(1, duration || 1);
  const rawSegments = Array.isArray(state?.clipSegments) ? state!.clipSegments : [];
  const segments = rawSegments
    .map((segment, index) => {
      const start = clampNumber(Number(segment.start), 0, Math.max(0, safeDuration - 0.5));
      const end = clampNumber(Number(segment.end), Math.min(safeDuration, start + 0.5), safeDuration);
      return {
        id: typeof segment.id === 'string' && segment.id ? segment.id : `clip-saved-${index}`,
        start,
        end,
      };
    })
    .filter(segment => segment.end - segment.start >= 0.5);
  const safeSegments = segments.length ? segments : [createTeleprompterClipSegment(0, safeDuration)];
  const activeClipId = state?.activeClipId && safeSegments.some(segment => segment.id === state.activeClipId)
    ? state.activeClipId
    : safeSegments[0].id;
  const activeClip = safeSegments.find(segment => segment.id === activeClipId) || safeSegments[0];

  return {
    trimStart: activeClip.start,
    trimEnd: activeClip.end,
    clipSegments: safeSegments,
    activeClipId,
  };
}

function serializeTeleprompterEditState(state: TeleprompterEditState): string {
  return JSON.stringify({
    activeClipId: state.activeClipId,
    trimStart: Number(state.trimStart.toFixed(3)),
    trimEnd: Number(state.trimEnd.toFixed(3)),
    clipSegments: state.clipSegments.map(segment => ({
      id: segment.id,
      start: Number(segment.start.toFixed(3)),
      end: Number(segment.end.toFixed(3)),
    })),
  });
}

function getEditedTimelineTimeFromOriginalTime(time: number, segments: TeleprompterClipSegment[]): number {
  let elapsed = 0;
  for (const segment of segments) {
    const segmentDuration = Math.max(0, segment.end - segment.start);
    if (time >= segment.start && time <= segment.end) {
      return elapsed + clampNumber(time - segment.start, 0, segmentDuration);
    }
    if (time > segment.end) {
      elapsed += segmentDuration;
    }
  }
  if (!segments.length) return 0;
  return time < segments[0].start ? 0 : elapsed;
}

function getOriginalTimeFromEditedTimelineTime(time: number, segments: TeleprompterClipSegment[]): number {
  let remaining = Math.max(0, time);
  for (const segment of segments) {
    const segmentDuration = Math.max(0, segment.end - segment.start);
    if (remaining <= segmentDuration) {
      return segment.start + remaining;
    }
    remaining -= segmentDuration;
  }
  const lastSegment = segments[segments.length - 1];
  return lastSegment ? lastSegment.end : 0;
}

function isGeneratedScriptRecording(recording: Recording): boolean {
  return /^Talk-to-camera:/i.test(recording.title || '');
}

function getRecordingDisplayTitle(recording: Recording): string {
  return (recording.title || 'Saved video').replace(/^Talk-to-camera:\s*/i, '').trim() || 'Saved video';
}

function createSavedRecordingAnalysis(recording: Recording, scriptText: string): VideoContentAnalysis {
  const title = getRecordingDisplayTitle(recording);
  return {
    summary: 'Saved recording ready to edit and post to Instagram.',
    contentPotential: 'strong',
    recommendedFormat: 'instagram-video',
    reasoning: 'Use this saved take as an Instagram video.',
    contentOpportunities: [{
      format: 'instagram-video',
      title,
      why: 'Saved filmed take ready for Instagram.',
    }],
    linkedinPost: null,
    script: scriptText ? {
      title,
      hook: '',
      body: scriptText,
    } : null,
    carousel: null,
    rawClip: {
      usable: true,
      reasoning: 'This saved recording can be trimmed, captioned, and posted to Instagram.',
      hook: '',
      structure: [],
      caption: '',
    },
  };
}

function normalizeCaptionText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function getCaptionWordCount(text: string): number {
  return normalizeCaptionText(text).split(' ').filter(Boolean).length;
}

function normalizeCaptionTranscriptResult(rawText: string): string {
  const text = normalizeCaptionText(rawText
    .replace(/^transcript:\s*/i, '')
    .replace(/^["']|["']$/g, '')
  );
  if (!text) return '';
  if (/^(no speech|no audible speech|there is no speech|silence|silent video|no audio).*$/i.test(text)) return '';

  const comparable = text
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
  const commonSilenceHallucinations = new Set([
    'you',
    'thank you',
    'thanks',
    'thanks for watching',
    'thank you for watching',
    'bye',
    'okay',
    'ok',
    'hello',
    'hi',
  ]);
  return commonSilenceHallucinations.has(comparable) ? '' : text;
}

function getCaptionComparableWords(text: string): string[] {
  return normalizeCaptionText(text)
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function getCaptionCueText(cues: TimedCaptionWord[]): string {
  return normalizeCaptionText(cues.map(cue => cue.text).join(' '));
}

function getOrderedCaptionWordMatchRatio(cueText: string, transcriptText: string): number {
  const cueWords = getCaptionComparableWords(cueText);
  const transcriptWords = getCaptionComparableWords(transcriptText);
  if (!cueWords.length || !transcriptWords.length) return 0;

  const previousRow = new Array(transcriptWords.length + 1).fill(0);
  const currentRow = new Array(transcriptWords.length + 1).fill(0);

  for (const cueWord of cueWords) {
    for (let index = 1; index <= transcriptWords.length; index += 1) {
      currentRow[index] = cueWord === transcriptWords[index - 1]
        ? previousRow[index - 1] + 1
        : Math.max(previousRow[index], currentRow[index - 1]);
    }
    for (let index = 0; index <= transcriptWords.length; index += 1) {
      previousRow[index] = currentRow[index];
      currentRow[index] = 0;
    }
  }

  return previousRow[transcriptWords.length] / cueWords.length;
}

function isUsableCaptionTranscript(text: string, duration: number, expectedText = ''): boolean {
  const wordCount = getCaptionWordCount(text);
  if (wordCount === 0) return false;
  if (wordCount < 2) return false;

  const expectedWordCount = getCaptionWordCount(expectedText);
  if (expectedWordCount >= 8) {
    const minimumExpectedCoverage = Math.max(4, Math.min(10, Math.ceil(expectedWordCount * 0.2)));
    if (wordCount < minimumExpectedCoverage) return false;
  }

  if (duration >= 20 && wordCount < 8) return false;
  if (duration >= 10 && wordCount < 5) return false;
  if (duration >= 4 && wordCount < 3) return false;
  return true;
}

function buildTimedCaptionWords(text: string, duration: number): TimedCaptionWord[] {
  const words = normalizeCaptionText(text).split(' ').filter(Boolean);
  if (!words.length) return [];

  const safeDuration = Math.max(0.5, Number.isFinite(duration) ? duration : 0.5);
  const cueSize = 5;
  const cues: string[] = [];
  for (let index = 0; index < words.length; index += cueSize) {
    cues.push(words.slice(index, index + cueSize).join(' '));
  }
  const secondsPerWord = safeDuration / words.length;
  let wordCursor = 0;

  return cues.map((cue, index) => {
    const cueWordCount = cue.split(' ').filter(Boolean).length;
    const start = wordCursor * secondsPerWord;
    wordCursor += cueWordCount;
    return {
      id: `caption-cue-${index}`,
      text: cue,
      start,
      end: Math.min(safeDuration, Math.max(start + 0.5, wordCursor * secondsPerWord)),
    };
  });
}

function getActiveCaptionTextAtTime(time: number, words: TimedCaptionWord[], fallbackText = ''): string {
  const normalizedFallback = normalizeCaptionText(fallbackText);
  if (!words.length) return normalizedFallback.split(' ').slice(0, 5).join(' ');

  const safeTime = Math.max(0, Number.isFinite(time) ? time : 0);
  let activeIndex = words.findIndex(word => safeTime >= word.start && safeTime < word.end);
  if (activeIndex < 0 && safeTime >= words[words.length - 1].start) {
    activeIndex = words.length - 1;
  }
  if (activeIndex < 0) return '';

  const hasPhraseCues = words.some(word => /\s/.test(word.text.trim()));
  if (hasPhraseCues) {
    return words[activeIndex].text;
  }

  const phraseSize = 5;
  const phraseStart = Math.floor(activeIndex / phraseSize) * phraseSize;
  return words.slice(phraseStart, activeIndex + 1).map(word => word.text).join(' ');
}

function parseCaptionTime(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.max(0, Number(raw));
  const parts = raw.split(':').map(part => Number(part));
  if (parts.some(part => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return Math.max(0, (parts[0] * 60) + parts[1]);
  if (parts.length === 3) return Math.max(0, (parts[0] * 3600) + (parts[1] * 60) + parts[2]);
  return 0;
}

function extractJsonObject(raw: string): any | null {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeTimedCaptionCues(rawCues: any[], duration: number): TimedCaptionWord[] {
  const safeDuration = Math.max(0.5, Number.isFinite(duration) ? duration : 0.5);
  return rawCues
    .flatMap((cue, index) => {
      const text = normalizeCaptionText(String(cue?.text || cue?.caption || cue?.words || ''));
      const start = clampNumber(parseCaptionTime(cue?.start ?? cue?.startSeconds ?? cue?.start_sec), 0, safeDuration);
      const rawEnd = parseCaptionTime(cue?.end ?? cue?.endSeconds ?? cue?.end_sec);
      const end = clampNumber(rawEnd || start + 1.5, Math.min(safeDuration, start + 0.35), safeDuration);
      const words = text.split(' ').filter(Boolean);
      if (words.length <= 7) {
        return [{ id: `caption-cue-${index}`, text, start, end }];
      }

      const cueSize = 5;
      const segmentDuration = Math.max(0.35, end - start);
      const secondsPerWord = segmentDuration / words.length;
      const phraseCues: TimedCaptionWord[] = [];
      for (let wordIndex = 0; wordIndex < words.length; wordIndex += cueSize) {
        const phraseWords = words.slice(wordIndex, wordIndex + cueSize);
        const phraseStart = start + (wordIndex * secondsPerWord);
        const phraseEnd = Math.min(end, Math.max(phraseStart + 0.35, start + ((wordIndex + phraseWords.length) * secondsPerWord)));
        phraseCues.push({
          id: `caption-cue-${index}-${wordIndex}`,
          text: phraseWords.join(' '),
          start: phraseStart,
          end: phraseEnd,
        });
      }
      return phraseCues;
    })
    .filter(cue => cue.text && cue.end > cue.start)
    .sort((left, right) => left.start - right.start);
}

function normalizeTimedCaptionWords(rawWords: any[], duration: number): TimedCaptionWord[] {
  const safeDuration = Math.max(0.5, Number.isFinite(duration) ? duration : 0.5);
  return rawWords
    .map((word, index) => {
      const text = normalizeCaptionText(String(word?.word || word?.text || word?.token || ''));
      const start = clampNumber(parseCaptionTime(word?.start ?? word?.startSeconds ?? word?.start_sec), 0, safeDuration);
      const rawEnd = parseCaptionTime(word?.end ?? word?.endSeconds ?? word?.end_sec);
      const end = clampNumber(rawEnd || start + 0.35, Math.min(safeDuration, start + 0.1), safeDuration);
      return { id: `caption-word-${index}`, text, start, end };
    })
    .filter(word => word.text && word.end > word.start)
    .sort((left, right) => left.start - right.start);
}

function hasUsableCaptionCueCoverage(cues: TimedCaptionWord[], transcriptText: string): boolean {
  if (!cues.length) return false;
  const cueText = getCaptionCueText(cues);
  const cueWordCount = getCaptionWordCount(cueText);
  if (cueWordCount < 2) return false;

  const transcriptWordCount = getCaptionWordCount(transcriptText);
  if (!transcriptWordCount) return true;

  const minimumCueWords = Math.max(2, Math.ceil(transcriptWordCount * 0.6));
  if (cueWordCount < minimumCueWords) return false;

  return getOrderedCaptionWordMatchRatio(cueText, transcriptText) >= 0.72;
}

function coerceCaptionCuesToTranscript(cues: TimedCaptionWord[], transcriptText: string, duration: number): TimedCaptionWord[] {
  if (hasUsableCaptionCueCoverage(cues, transcriptText)) return cues;
  return buildTimedCaptionWords(transcriptText, duration);
}

function getCaptionCuesFromTranscriptionData(data: any, text: string, duration: number): TimedCaptionWord[] {
  const wordCues = Array.isArray(data?.words)
    ? normalizeTimedCaptionWords(data.words, duration)
    : [];
  if (hasUsableCaptionCueCoverage(wordCues, text)) return wordCues;

  const segmentCues = Array.isArray(data?.segments)
    ? normalizeTimedCaptionCues(data.segments, duration)
    : Array.isArray(data?.captions)
      ? normalizeTimedCaptionCues(data.captions, duration)
      : [];
  if (hasUsableCaptionCueCoverage(segmentCues, text)) return segmentCues;

  return buildTimedCaptionWords(text, duration);
}

async function generateTimelineFrameImages(videoUrl: string, duration: number, frameCount = 8): Promise<string[]> {
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Could not load video frames.'));
  });

  const actualDuration = Number.isFinite(video.duration) && video.duration > 0
    ? video.duration
    : Math.max(1, duration);
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  if (!context) return [];

  const seekTo = (time: number) => new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      video.onseeked = null;
      resolve();
    };
    video.onseeked = settle;
    window.setTimeout(settle, 300);
    video.currentTime = clampNumber(time, 0, Math.max(0, actualDuration - 0.05));
  });

  const frames: string[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const time = actualDuration * ((index + 0.5) / frameCount);
    await seekTo(time);
    context.fillStyle = '#020617';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.max(canvas.width / (video.videoWidth || canvas.width), canvas.height / (video.videoHeight || canvas.height));
    const drawWidth = (video.videoWidth || canvas.width) * scale;
    const drawHeight = (video.videoHeight || canvas.height) * scale;
    context.drawImage(video, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
    frames.push(canvas.toDataURL('image/jpeg', 0.72));
  }

  return frames;
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
      currentLine = nextLine;
      return;
    }
    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 4);
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fill();
}

function drawWrappedCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';
  words.forEach(word => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
      currentLine = nextLine;
      return;
    }
    lines.push(currentLine);
    currentLine = word;
  });
  if (currentLine) lines.push(currentLine);
  const visibleLines = lines.slice(0, maxLines);
  visibleLines.forEach((line, index) => {
    context.fillText(line, x, y + (index * lineHeight));
  });
  return visibleLines.length * lineHeight;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Could not render the carousel image.'));
    }, 'image/png', 0.96);
  });
}

async function canvasToDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  await canvasToBlob(canvas);
  return canvas.toDataURL('image/png');
}

function renderCarouselSlideCanvas(
  slide: EditableCarouselSlide,
  index: number,
  total: number,
  deckTitle: string,
  theme: CarouselTheme
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the carousel renderer.');

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, theme.bgFrom);
  gradient.addColorStop(0.54, theme.bgMid);
  gradient.addColorStop(1, theme.bgTo);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = 'rgba(59, 130, 246, 0.14)';
  context.beginPath();
  context.arc(965, 160, 175, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = hexWithAlpha(theme.accent, 0.16);
  context.beginPath();
  context.arc(120, 1190, 220, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = theme.accent;
  drawRoundedRect(context, 86, 82, 120, 44, 22);
  context.fillStyle = '#fff';
  context.font = `700 24px ${theme.fontStack}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`${index + 1}/${total}`, 146, 104);

  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.fillStyle = theme.subtitleColor;
  context.font = `700 28px ${theme.fontStack}`;
  drawWrappedCanvasText(context, deckTitle || 'Bipp carousel', 86, 160, 880, 36, 2);

  context.fillStyle = theme.titleColor;
  context.font = `800 ${theme.titleSize}px ${theme.fontStack}`;
  const titleLineHeight = Math.round(theme.titleSize * 1.15);
  const titleHeight = drawWrappedCanvasText(context, slide.title, 86, 300, 900, titleLineHeight, 4);

  context.fillStyle = theme.bodyColor;
  context.font = `500 ${theme.bodySize}px ${theme.fontStack}`;
  const bodyLineHeight = Math.round(theme.bodySize * 1.38);
  drawWrappedCanvasText(context, slide.body, 90, 320 + titleHeight, 900, bodyLineHeight, 8);

  context.fillStyle = theme.titleColor;
  context.font = `700 24px ${theme.fontStack}`;
  context.fillText('Bipp', 86, 1242);

  const dotStart = canvas.width - 86 - (total * 20);
  for (let dot = 0; dot < total; dot += 1) {
    context.fillStyle = dot === index ? theme.accent : hexWithAlpha(theme.accent, 0.4);
    context.beginPath();
    context.arc(dotStart + (dot * 24), 1254, dot === index ? 7 : 5, 0, Math.PI * 2);
    context.fill();
  }

  return canvas;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const full = cleaned.length === 3 ? cleaned.split('').map(c => c + c).join('') : cleaned;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildCarouselDeckCode(title: string, slides: EditableCarouselSlide[], theme: CarouselTheme): string {
  const serializedSlides = JSON.stringify(slides.map((slide, index) => ({
    ...slide,
    slideNumber: index + 1,
  })), null, 2);
  const serializedTitle = JSON.stringify(title || 'Instagram carousel');
  const fontStack = JSON.stringify(theme.fontStack);
  const googleImport = theme.googleFamily
    ? `@import url('https://fonts.googleapis.com/css2?family=${theme.googleFamily}&display=block');\n`
    : '';
  const titleSizeScaled = Math.round((theme.titleSize / 82) * 36);
  const bodySizeScaled = Math.round((theme.bodySize / 42) * 16);

  return `import React from 'react';

const deckTitle = ${serializedTitle};
const slides = ${serializedSlides};

export default function SlideDeck({ slideIndex = 0 }: { slideIndex?: number }) {
  const index = Math.max(0, Math.min(slideIndex, slides.length - 1));
  const slide = slides[index] || slides[0];

  return (
    <main className="slides-container flex items-center justify-center" style={{ width: 360, height: 450, background: ${JSON.stringify(theme.bgFrom)}, fontFamily: ${fontStack} }}>
      <style>{${JSON.stringify(googleImport)}}</style>
      <section data-slide-index={index} className="slide relative overflow-hidden p-8" style={{ width: 360, height: 450, background: 'linear-gradient(135deg, ${theme.bgFrom} 0%, ${theme.bgMid} 52%, ${theme.bgTo} 100%)', color: ${JSON.stringify(theme.titleColor)} }}>
        <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full" style={{ background: 'rgba(59,130,246,0.14)' }} />
        <div className="absolute -left-20 -bottom-20 h-44 w-44 rounded-full" style={{ background: ${JSON.stringify(hexWithAlpha(theme.accent, 0.16))} }} />
        <div className="relative z-10 flex h-full flex-col">
          <div className="mb-6 flex items-center justify-between">
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: ${JSON.stringify(theme.accent)}, color: '#fff' }}>{index + 1}/{slides.length}</span>
            <span className="text-xs font-bold" style={{ color: ${JSON.stringify(theme.subtitleColor)} }} data-editable="websiteUrl">Bipp</span>
          </div>
          <p className="mb-4 text-xs font-bold uppercase tracking-wide" style={{ color: ${JSON.stringify(theme.subtitleColor)} }} data-editable="subtitle">{deckTitle}</p>
          <h1 className="font-black leading-none" style={{ fontSize: ${titleSizeScaled} }} data-editable="title">{slide.title}</h1>
          <p className="mt-5 whitespace-pre-line font-medium leading-snug" style={{ color: ${JSON.stringify(theme.bodyColor)}, fontSize: ${bodySizeScaled} }} data-editable="items">{slide.body}</p>
          <div className="mt-auto flex gap-1">
            {slides.map((_: any, dotIndex: number) => (
              <span key={dotIndex} className="h-1.5 rounded-full" style={{ width: dotIndex === index ? 22 : 8, background: dotIndex === index ? ${JSON.stringify(theme.accent)} : ${JSON.stringify(hexWithAlpha(theme.accent, 0.4))} }} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
`;
}

function getCarouselDeckId(date: string, recordingId?: number | null): string {
  return `raw-to-post-${date}-${recordingId || 'date'}-carousel`;
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mpeg|mpg|quicktime)$/i.test(file.name);
}

function getWorkspaceId(): string {
  return window.__workspaceDb?.workspaceId || (window as any).__WORKSPACE_ID__ || '7583d1d5-4a4e-4026-a8bd-e42c0edec891';
}

function hasWorkspaceDbAuth(): boolean {
  return Boolean(window.__workspaceDb?.token);
}

function getMarketingContext(): { base: string; headers: Record<string, string> } {
  const workspaceId = getWorkspaceId();
  const token = window.__workspaceDb?.token;
  if (!token) {
    throw new Error('Workspace publishing credentials are not available. Reload the workspace and try again.');
  }

  return {
    base: `/api/workspaces/${workspaceId}/marketing`,
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-DB-Token': token,
    },
  };
}

async function readApiResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function getApiErrorMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  return String(data.message || data.error || data.details?.message || fallback);
}

function getDefaultContentCalendarPlan(): ContentCalendarPlan {
  return {
    version: 1,
    sourceHash: 'empty',
    updatedAt: new Date().toISOString(),
    sourceSummary: 'No marketing plan generated yet',
    audience: 'your best-fit customers',
    challenge: 'turning attention into customer conversations',
    why: 'the reason you started building',
    items: [],
  };
}

function loadContentCalendarPlan(): ContentCalendarPlan {
  if (typeof window === 'undefined') return getDefaultContentCalendarPlan();
  try {
    const raw = window.localStorage.getItem(BIPP_CONTENT_CALENDAR_STORAGE_KEY);
    if (!raw) return getDefaultContentCalendarPlan();
    const parsed = JSON.parse(raw) as Partial<ContentCalendarPlan>;
    return {
      ...getDefaultContentCalendarPlan(),
      ...parsed,
      items: Array.isArray(parsed.items) ? parsed.items as ContentCalendarItem[] : [],
    };
  } catch {
    return getDefaultContentCalendarPlan();
  }
}

function saveContentCalendarPlan(plan: ContentCalendarPlan): void {
  window.localStorage.setItem(BIPP_CONTENT_CALENDAR_STORAGE_KEY, JSON.stringify(plan));
  window.dispatchEvent(new CustomEvent('bipp:content-calendar-updated', { detail: plan }));
}

function upsertContentCalendarItem(item: ContentCalendarItem): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadContentCalendarPlan();
    const existingItem = current.items.find(existing => existing.id === item.id);
    const nextItem = {
      ...item,
      status: existingItem?.status || item.status,
    };
    const nextPlan: ContentCalendarPlan = {
      ...current,
      sourceHash: current.sourceHash === 'empty' ? 'raw-to-post' : current.sourceHash,
      sourceSummary: current.sourceHash === 'empty' ? 'Raw-to-Post content calendar' : current.sourceSummary,
      updatedAt: new Date().toISOString(),
      items: [...current.items.filter(existing => existing.id !== item.id), nextItem],
    };
    saveContentCalendarPlan(nextPlan);
  } catch (error) {
    console.warn('Failed to sync Raw-to-Post item to calendar:', error);
  }
}

function cleanContentPreview(content: string): string {
  return content
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function getRawDraftCalendarId(format: PostFormat, date: string, recordingId?: number | null): string {
  return `raw-to-post-${date}-${recordingId || 'date'}-${format}`;
}

function getRawDraftCalendarCopy(format: PostFormat): { channel: string; title: string; task: string; angle: string } {
  if (format === 'instagram-video') {
    return {
      channel: 'Raw-to-Post · Instagram',
      title: 'Record generated Instagram script',
      task: 'Review the generated talk-to-camera script, record it, and publish or schedule the reel.',
      angle: 'Use the strongest idea from the raw update as a cleaner follow-up video.',
    };
  }
  if (format === 'instagram-carousel') {
    return {
      channel: 'Raw-to-Post · Instagram',
      title: 'Build generated carousel',
      task: 'Turn the generated carousel outline into slides and prepare it for Instagram.',
      angle: 'Make the rough update easier to save and share with a step-by-step format.',
    };
  }
  return {
    channel: 'Raw-to-Post · LinkedIn',
    title: 'Edit generated LinkedIn post',
    task: 'Review, edit, and publish the LinkedIn draft generated from the raw video.',
    angle: 'Turn the founder update into a thoughtful public progress post.',
  };
}

function syncRawDraftToContentCalendar(
  format: PostFormat,
  content: string,
  date: string,
  recordingId?: number | null,
  titleOverride?: string
): void {
  const trimmedContent = content.trim();
  if (!trimmedContent) return;
  const copy = getRawDraftCalendarCopy(format);
  upsertContentCalendarItem({
    id: getRawDraftCalendarId(format, date, recordingId),
    date,
    type: 'organic',
    channel: copy.channel,
    title: titleOverride?.trim() || copy.title,
    task: copy.task,
    angle: copy.angle,
    status: 'planned',
    source: 'raw-to-post',
    contentPreview: cleanContentPreview(trimmedContent),
  });
}

function syncScheduledInstagramToContentCalendar(input: {
  scheduledAt: string;
  scheduleId?: string;
  caption: string;
  videoTitle: string;
}): void {
  const parsedDate = new Date(input.scheduledAt);
  const scheduledDate = Number.isNaN(parsedDate.getTime()) ? input.scheduledAt.slice(0, 10) : formatDate(parsedDate);
  upsertContentCalendarItem({
    id: `raw-to-post-instagram-scheduled-${input.scheduleId || input.scheduledAt}`,
    date: scheduledDate,
    type: 'organic',
    channel: 'Instagram Reel',
    title: input.videoTitle || 'Scheduled Instagram reel',
    task: 'Publish the recorded Raw-to-Post self-tape to Instagram.',
    angle: 'Scheduled from Raw-to-Post after recording with the teleprompter.',
    status: 'planned',
    source: 'scheduled',
    scheduledAt: input.scheduledAt,
    contentPreview: cleanContentPreview(input.caption),
    scheduleId: input.scheduleId,
  });
}

function getWorkspaceRequestHeaders(includeJson = true): Record<string, string> {
  const headers: Record<string, string> = includeJson ? { 'Content-Type': 'application/json' } : {};
  const workspaceDbToken = window.__workspaceDb?.token;
  if (workspaceDbToken) headers['X-Workspace-DB-Token'] = workspaceDbToken;
  try {
    const deviceToken = window.localStorage.getItem('workspace_device_token');
    if (deviceToken) headers['x-device-token'] = deviceToken;
  } catch {
    // Ignore storage access failures in embedded preview contexts.
  }
  return headers;
}

function getInstagramPublishHookCode(): string {
  return [
    "const body = request.body || {};",
    "const payload = body.payload || body;",
    "if (payload._test) { respond(200, { success: true, dryRun: true, message: 'Instagram scheduler hook is ready.' }); return; }",
    "const videoUrl = payload.videoUrl || payload.linkUrl || '';",
    "const caption = payload.caption || '';",
    "const destination = payload.destination || 'instagram_reel';",
    "if (!videoUrl) { respond(400, { success: false, error: 'Missing videoUrl.' }); return; }",
    "const headers = { 'Content-Type': 'application/json' };",
    "if (payload.workspaceDbToken) headers['X-Workspace-DB-Token'] = payload.workspaceDbToken;",
    "const httpFetch = (typeof platform !== 'undefined' && platform.fetch) ? platform.fetch.bind(platform) : fetch;",
    "const response = await httpFetch('/api/workspaces/' + workspaceId + '/marketing/posts/video', {",
    "  method: 'POST',",
    "  headers,",
    "  body: JSON.stringify({ destination, videoUrl, caption }),",
    "});",
    "const text = await response.text();",
    "let data = {};",
    "try { data = text ? JSON.parse(text) : {}; } catch (error) { data = { message: text }; }",
    "if (!response.ok || data.success === false) {",
    "  console.error('Scheduled Instagram publish failed', response.status, data);",
    "  respond(502, { success: false, status: response.status, error: data.error || data.message || 'Instagram publish failed.', details: data });",
    "  return;",
    "}",
    "try {",
    "  await platform.postAgentMessage({ message: 'Your scheduled Raw-to-Post Instagram reel went live.' });",
    "} catch (error) {",
    "  console.warn('Could not post scheduled publish confirmation to chat', error);",
    "}",
    "respond(200, { success: true, destination, mediaId: data.mediaId || data.postId || data.id || null, result: data });",
  ].join('\n');
}

function normalizeHashtags(value: string): string {
  return value
    .split(/[\s,]+/)
    .map(tag => tag.trim())
    .filter(Boolean)
    .map(tag => tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '')}`)
    .join(' ');
}

function isPostFormat(value: any): value is PostFormat {
  return value === 'linkedin' || value === 'instagram-video' || value === 'instagram-carousel';
}

function getStoredSelectedFormat(date: string): PostFormat | null {
  const storedFormat = window.localStorage.getItem(getSelectedFormatStorageKey(date));
  return isPostFormat(storedFormat) ? storedFormat : null;
}

function getFormatLabel(format: PostFormat): string {
  return FORMAT_OPTIONS.find(f => f.value === format)?.label || format;
}

function hasContentDraft(analysis: VideoContentAnalysis, format: PostFormat): boolean {
  if (format === 'linkedin') return Boolean(analysis.linkedinPost?.body);
  if (format === 'instagram-video') return Boolean(analysis.script?.body);
  if (format === 'instagram-carousel') return Boolean(analysis.carousel?.slides.length);
  return false;
}

function getDraftOpportunities(analysis: VideoContentAnalysis): ContentOpportunity[] {
  const seen = new Set<PostFormat>();
  return analysis.contentOpportunities.filter(opportunity => {
    if (seen.has(opportunity.format) || !hasContentDraft(analysis, opportunity.format)) return false;
    seen.add(opportunity.format);
    return true;
  });
}

function getDefaultDraftFormat(analysis: VideoContentAnalysis): PostFormat {
  if (hasContentDraft(analysis, analysis.recommendedFormat)) return analysis.recommendedFormat;
  const opportunityWithDraft = getDraftOpportunities(analysis)[0];
  return opportunityWithDraft?.format || analysis.recommendedFormat;
}

function getOpportunityActionLabel(format: PostFormat): string {
  if (format === 'instagram-video') return 'Click to view script';
  if (format === 'instagram-carousel') return 'Click to view carousel';
  return 'Click to view post';
}

function getSelectedFormatReasoning(analysis: VideoContentAnalysis, format: PostFormat): string {
  const opportunity = analysis.contentOpportunities.find(item => item.format === format);
  return opportunity?.why || (format === analysis.recommendedFormat ? analysis.reasoning : '') || analysis.summary;
}

function formatEditableScriptDraft(script: VideoContentAnalysis['script'], body: string): string {
  const scriptText = script ? buildTalkToCameraScriptText({ ...script, body, cta: undefined }) : body;
  return [
    script?.title ? `Title: ${script.title}` : '',
    scriptText,
  ].filter(Boolean).join('\n\n');
}

function normalizeScriptComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function startsWithSameScriptLine(text: string, line: string): boolean {
  const normalizedText = normalizeScriptComparable(text);
  const normalizedLine = normalizeScriptComparable(line);
  return Boolean(normalizedLine && normalizedText.startsWith(normalizedLine));
}

function containsSameScriptLine(text: string, line: string): boolean {
  const normalizedText = normalizeScriptComparable(text);
  const normalizedLine = normalizeScriptComparable(line);
  return Boolean(normalizedLine && normalizedText.includes(normalizedLine));
}

function buildTalkToCameraScriptText(script: VideoContentAnalysis['script']): string {
  if (!script) return '';
  const hook = script.hook.trim();
  const body = script.body.trim();
  const cta = script.cta?.trim() || '';
  const parts: string[] = [];

  if (hook && !startsWithSameScriptLine(body, hook)) {
    parts.push(hook);
  }
  if (body) {
    parts.push(body);
  }
  if (cta && !containsSameScriptLine(parts.join('\n\n'), cta)) {
    parts.push(cta);
  }

  return parts.join('\n\n').trim();
}

function getTeleprompterText(script: VideoContentAnalysis['script']): string {
  return buildTalkToCameraScriptText(script);
}

function applySavedDraftsToAnalysis(
  analysis: VideoContentAnalysis,
  linkedinDraftText?: string,
  instagramScriptDraftText?: string
): VideoContentAnalysis {
  const linkedinBody = linkedinDraftText?.trim();
  const instagramScriptBody = instagramScriptDraftText?.trim();

  return {
    ...analysis,
    linkedinPost: linkedinBody
      ? {
        title: analysis.linkedinPost?.title || '',
        body: linkedinBody,
      }
      : analysis.linkedinPost,
    script: instagramScriptBody
      ? {
        title: analysis.script?.title || 'Instagram video script',
        hook: analysis.script?.hook || '',
        body: instagramScriptBody,
        cta: undefined,
      }
      : analysis.script,
  };
}

function formatCarousel(carousel: VideoContentAnalysis['carousel']): string {
  if (!carousel) return '';
  return [
    carousel.title ? `Title: ${carousel.title}` : '',
    ...carousel.slides.map((slide, index) => `Slide ${index + 1}: ${slide.title}\n${slide.body}`),
  ].filter(Boolean).join('\n\n');
}

function createSlideId(index: number): string {
  return `slide-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function getCarouselDraftText(title: string, slides: EditableCarouselSlide[]): string {
  return [
    title ? `Title: ${title}` : '',
    ...slides.map((slide, index) => `Slide ${index + 1}: ${slide.title}\n${slide.body}`),
  ].filter(Boolean).join('\n\n');
}

function getCarouselCaptionFromDraft(title: string, slides: EditableCarouselSlide[]): string {
  const firstSlide = slides[0];
  return [
    title || firstSlide?.title || 'New carousel',
    '',
    firstSlide?.body || '',
  ].filter(Boolean).join('\n').slice(0, 900);
}

function normalizeEditableCarouselDraft(input: EditableCarouselDraft): EditableCarouselDraft {
  const slides = input.slides
    .map((slide, index) => ({
      id: slide.id || createSlideId(index),
      title: String(slide.title || '').trim() || `Slide ${index + 1}`,
      body: String(slide.body || '').trim(),
    }))
    .filter(slide => slide.title || slide.body)
    .slice(0, 10);

  return {
    title: String(input.title || '').trim() || slides[0]?.title || 'Instagram carousel',
    slides,
    caption: input.caption,
    theme: input.theme ? normalizeCarouselTheme(input.theme) : { ...DEFAULT_CAROUSEL_THEME },
  };
}

function carouselDraftFromAnalysis(carousel: VideoContentAnalysis['carousel']): EditableCarouselDraft | null {
  if (!carousel || !carousel.slides.length) return null;
  return normalizeEditableCarouselDraft({
    title: carousel.title || 'Instagram carousel',
    slides: carousel.slides.map((slide, index) => ({
      id: createSlideId(index),
      title: slide.title,
      body: slide.body,
    })),
    caption: getCarouselCaptionFromDraft(carousel.title || '', carousel.slides.map((slide, index) => ({
      id: createSlideId(index),
      title: slide.title,
      body: slide.body,
    }))),
    theme: { ...DEFAULT_CAROUSEL_THEME },
  });
}

function getTextFromReactSlide(slide: any): { title: string; body: string } {
  const title = String(
    slide?.title
    || slide?.quote
    || slide?.ctaText
    || slide?.stats?.[0]?.value
    || ''
  ).trim();
  const bodyParts = [
    slide?.subtitle,
    slide?.author ? `- ${slide.author}` : '',
    Array.isArray(slide?.items) ? slide.items.join('\n') : '',
    Array.isArray(slide?.stats) ? slide.stats.map((stat: any) => `${stat.value}: ${stat.label}`).join('\n') : '',
  ].filter(Boolean);
  return {
    title,
    body: bodyParts.map(part => String(part).trim()).filter(Boolean).join('\n'),
  };
}

function carouselDraftFromReactSlides(title: string, reactSlides: any[]): EditableCarouselDraft | null {
  if (!Array.isArray(reactSlides) || reactSlides.length === 0) return null;
  return normalizeEditableCarouselDraft({
    title,
    slides: reactSlides.map((slide, index) => {
      const text = getTextFromReactSlide(slide);
      return {
        id: String(slide?.id || createSlideId(index)),
        title: text.title || `Slide ${index + 1}`,
        body: text.body,
      };
    }),
  });
}

function parseCarouselDraft(raw: string | null): EditableCarouselDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.slides)) {
      return normalizeEditableCarouselDraft({
        title: parsed.title || '',
        slides: parsed.slides,
        caption: parsed.caption,
        theme: parsed.theme || undefined,
      });
    }
  } catch {
    // Fall through to parsing the readable text draft.
  }

  const sections = raw.split(/\n{2,}/).map(section => section.trim()).filter(Boolean);
  const titleSection = sections.find(section => /^Title:/i.test(section));
  const slides = sections
    .filter(section => /^Slide\s+\d+:/i.test(section))
    .map((section, index) => {
      const lines = section.split('\n');
      const title = lines[0].replace(/^Slide\s+\d+:\s*/i, '').trim();
      return {
        id: createSlideId(index),
        title,
        body: lines.slice(1).join('\n').trim(),
      };
    });

  if (!slides.length) return null;
  return normalizeEditableCarouselDraft({
    title: titleSection?.replace(/^Title:\s*/i, '').trim() || slides[0]?.title || 'Instagram carousel',
    slides,
  });
}

function formatEditableLinkedInDraft(title: string | undefined, body: string): string {
  return [title ? `Title: ${title}` : '', body].filter(Boolean).join('\n\n');
}

function getLinkedInDraftStorageKey(recordingId: number | null, date: string): string {
  return recordingId
    ? `${LINKEDIN_DRAFT_STORAGE_PREFIX}.recording.${recordingId}`
    : `${LINKEDIN_DRAFT_STORAGE_PREFIX}.date.${date}`;
}

function getInstagramScriptDraftStorageKey(recordingId: number | null, date: string): string {
  return recordingId
    ? `${INSTAGRAM_SCRIPT_DRAFT_STORAGE_PREFIX}.recording.${recordingId}`
    : `${INSTAGRAM_SCRIPT_DRAFT_STORAGE_PREFIX}.date.${date}`;
}

function getInstagramCarouselDraftStorageKey(recordingId: number | null, date: string): string {
  return recordingId
    ? `${INSTAGRAM_CAROUSEL_DRAFT_STORAGE_PREFIX}.recording.${recordingId}`
    : `${INSTAGRAM_CAROUSEL_DRAFT_STORAGE_PREFIX}.date.${date}`;
}

function getInstagramCarouselGuidanceStorageKey(recordingId: number | null, date: string): string {
  return recordingId
    ? `${INSTAGRAM_CAROUSEL_GUIDANCE_STORAGE_PREFIX}.recording.${recordingId}`
    : `${INSTAGRAM_CAROUSEL_GUIDANCE_STORAGE_PREFIX}.date.${date}`;
}

function getContentPlanStorageKey(recordingId: number | null, date: string): string {
  return recordingId
    ? `${CONTENT_PLAN_STORAGE_PREFIX}.recording.${recordingId}`
    : `${CONTENT_PLAN_STORAGE_PREFIX}.date.${date}`;
}

function getSelectedFormatStorageKey(date: string): string {
  return `${SELECTED_FORMAT_STORAGE_PREFIX}.date.${date}`;
}

function getVideoRecordingsStorageKey(date: string): string {
  return `${VIDEO_RECORDINGS_STORAGE_PREFIX}.date.${date}`;
}

function getReplacedAtStorageKey(date: string): string {
  return `${REPLACED_AT_STORAGE_PREFIX}.date.${date}`;
}

function getReplacementCutoff(date: string): number | null {
  const replacedAt = Number(window.localStorage.getItem(getReplacedAtStorageKey(date)));
  return Number.isFinite(replacedAt) && replacedAt > 0 ? replacedAt : null;
}

function getLocalVideoRecordings(date: string): Recording[] {
  try {
    const raw = window.localStorage.getItem(getVideoRecordingsStorageKey(date));
    if (!raw) return [];
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row: any) => ({
        id: Number(row.id) || -Date.now(),
        video_url: typeof row.video_url === 'string' ? row.video_url : '',
        thumbnail_url: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : undefined,
        duration_seconds: Math.max(1, Number(row.duration_seconds) || 1),
        recording_date: String(row.recording_date || date),
        status: row.status === 'pending' || row.status === 'analyzing' || row.status === 'error' ? row.status : 'ready',
        title: typeof row.title === 'string' ? row.title : 'Saved video',
        created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      }))
      .filter((row: Recording) => row.recording_date === date && Boolean(row.video_url));
  } catch {
    return [];
  }
}

function saveLocalVideoRecording(recording: Recording): Recording {
  const date = recording.recording_date;
  const existingRows = getLocalVideoRecordings(date);
  const normalizedRecording: Recording = {
    ...recording,
    id: Number(recording.id) || -Date.now(),
    duration_seconds: Math.max(1, Number(recording.duration_seconds) || 1),
    recording_date: date,
    status: recording.status || 'ready',
    title: recording.title || 'Saved video',
    created_at: recording.created_at || new Date().toISOString(),
  };
  const existingIndex = existingRows.findIndex(row =>
    (normalizedRecording.video_url && row.video_url === normalizedRecording.video_url)
    || row.id === normalizedRecording.id
  );
  const nextRows = existingIndex >= 0
    ? existingRows.map((row, index) => index === existingIndex ? { ...row, ...normalizedRecording } : row)
    : [normalizedRecording, ...existingRows];

  window.localStorage.setItem(
    getVideoRecordingsStorageKey(date),
    JSON.stringify(nextRows.slice(0, 20))
  );
  return normalizedRecording;
}

function mergeRecordingsForDate(dbRecordings: Recording[], localRecordings: Recording[], date: string): Recording[] {
  const merged = new Map<string, Recording>();
  const replacementCutoff = getReplacementCutoff(date);
  [...localRecordings, ...dbRecordings]
    .filter(recording => {
      if (recording.recording_date !== date || !recording.video_url) return false;
      if (!replacementCutoff) return true;
      const createdAt = Date.parse(recording.created_at || '');
      return Number.isFinite(createdAt) && createdAt > replacementCutoff;
    })
    .forEach(recording => {
      const key = recording.video_url || String(recording.id);
      const existing = merged.get(key);
      if (!existing || (recording.id > 0 && existing.id < 0)) {
        merged.set(key, recording);
      }
    });

  return [...merged.values()].sort((left, right) => {
    const leftTime = Date.parse(left.created_at || '');
    const rightTime = Date.parse(right.created_at || '');
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return right.id - left.id;
  });
}

function hasLocalSavedDayContent(date: string): boolean {
  return Boolean(
    window.localStorage.getItem(getContentPlanStorageKey(null, date))
    || window.localStorage.getItem(getLinkedInDraftStorageKey(null, date))
    || window.localStorage.getItem(getInstagramScriptDraftStorageKey(null, date))
    || getLocalVideoRecordings(date).length > 0
  );
}

function getLatestSavedDraft(posts: GeneratedPost[], postFormat: string): GeneratedPost | null {
  return [...posts]
    .filter(post => post.post_format === postFormat)
    .sort((left, right) => {
      const leftTime = Date.parse(left.created_at || '');
      const rightTime = Date.parse(right.created_at || '');
      if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return right.id - left.id;
    })[0] || null;
}

function getLatestLinkedInDraft(posts: GeneratedPost[]): GeneratedPost | null {
  return getLatestSavedDraft(posts, 'linkedin');
}

function getLatestInstagramScriptDraft(posts: GeneratedPost[]): GeneratedPost | null {
  return getLatestSavedDraft(posts, 'instagram-video');
}

function getLatestContentPlanDraft(posts: GeneratedPost[]): GeneratedPost | null {
  return getLatestSavedDraft(posts, 'content-plan');
}

function getInsertedId(result: any): number | null {
  const candidate = Array.isArray(result)
    ? result[0]
    : Array.isArray(result?.data)
      ? result.data[0]
      : result?.data || result;
  const id = Number(candidate?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeWorkspaceRows<T = any>(result: any): T[] {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

function getWorkspaceTable(tableName: string): any {
  if (!hasWorkspaceDbAuth()) return null;
  return window.__workspaceDb?.from(tableName, { shared: true });
}

async function getWorkspaceRows<T = any>(
  tableName: string,
  filters: WorkspaceFilter[] = [],
  orderBy?: { column: string; direction: 'asc' | 'desc' }
): Promise<T[]> {
  const table = getWorkspaceTable(tableName);
  if (!table) return [];

  let query = table;
  let supportsBuilder = true;
  for (const filter of filters) {
    if (filter.operator === 'eq' && typeof query.eq === 'function') {
      query = query.eq(filter.column, filter.value) || query;
    } else if (typeof query.where === 'function') {
      query = query.where(filter.column, filter.operator, filter.value) || query;
    } else {
      supportsBuilder = false;
      break;
    }
  }

  if (supportsBuilder && orderBy && typeof query.orderBy === 'function') {
    query = query.orderBy(orderBy.column, orderBy.direction) || query;
  }

  const result = supportsBuilder
    ? await query.get()
    : await table.get(filters);
  const rows = normalizeWorkspaceRows<T>(result);

  if (!orderBy || typeof query.orderBy === 'function') return rows;
  return [...rows].sort((left: any, right: any) => {
    const leftValue = left?.[orderBy.column];
    const rightValue = right?.[orderBy.column];
    const leftTime = Date.parse(String(leftValue || ''));
    const rightTime = Date.parse(String(rightValue || ''));
    const comparison = Number.isFinite(leftTime) && Number.isFinite(rightTime)
      ? leftTime - rightTime
      : String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
    return orderBy.direction === 'desc' ? -comparison : comparison;
  });
}

async function updateWorkspaceRow(tableName: string, rowId: number, data: Record<string, any>) {
  const table = getWorkspaceTable(tableName);
  if (!table) return;
  return table.update(rowId, data);
}

async function deleteWorkspaceRow(tableName: string, rowId: number) {
  const table = getWorkspaceTable(tableName);
  if (!table) return;
  return table.delete(rowId);
}

function getClipSegments(analysis: VideoContentAnalysis | null, recordingDuration: number): RawClipSegment[] {
  const maxDuration = Math.max(recordingDuration || 0, 1);
  const rawSegments = analysis?.rawClip?.segments?.length
    ? analysis.rawClip.segments
    : [{
      startSeconds: Number(analysis?.rawClip?.clipStartSeconds ?? 0),
      endSeconds: Number(analysis?.rawClip?.clipEndSeconds ?? Math.min(maxDuration, 60)),
    }];

  return rawSegments
    .map(segment => ({
      ...segment,
      startSeconds: Math.max(0, Math.min(maxDuration, segment.startSeconds)),
      endSeconds: Math.max(0, Math.min(maxDuration, segment.endSeconds)),
    }))
    .filter(segment => segment.endSeconds > segment.startSeconds)
    .slice(0, 5);
}

// Parse the structured JSON returned by the video-analysis endpoint.
// Tolerates markdown code fences and surrounding prose.
function parseContentAnalysis(raw: string): VideoContentAnalysis | null {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(match ? match[0] : cleaned);
    const recommendedFormat = isPostFormat(obj.recommendedFormat) ? obj.recommendedFormat : 'linkedin';
    const opportunities = Array.isArray(obj.contentOpportunities)
      ? obj.contentOpportunities
          .filter((item: any) => isPostFormat(item?.format))
          .slice(0, 4)
          .map((item: any) => ({
            format: item.format,
            title: String(item.title || getFormatLabel(item.format)),
            why: String(item.why || item.reasoning || ''),
          }))
      : [{ format: recommendedFormat, title: getFormatLabel(recommendedFormat), why: String(obj.reasoning || '') }];
    const slides = Array.isArray(obj.carousel?.slides)
      ? obj.carousel.slides.slice(0, 8).map((slide: any) => ({
        title: String(slide.title || slide.headline || ''),
        body: String(slide.body || slide.text || ''),
      })).filter((slide: CarouselSlide) => slide.title || slide.body)
      : [];
    const rawSegments = Array.isArray(obj.rawClip?.segments)
      ? obj.rawClip.segments.map((segment: any) => ({
        startSeconds: Number(segment.startSeconds ?? segment.start ?? 0),
        endSeconds: Number(segment.endSeconds ?? segment.end ?? 0),
        reason: segment.reason ? String(segment.reason) : undefined,
      })).filter((segment: RawClipSegment) => Number.isFinite(segment.startSeconds) && Number.isFinite(segment.endSeconds) && segment.endSeconds > segment.startSeconds)
      : [];

    return {
      summary: String(obj.summary || ''),
      contentPotential: obj.contentPotential === 'strong' || obj.contentPotential === 'low' ? obj.contentPotential : 'needs-development',
      recommendedFormat,
      reasoning: String(obj.reasoning || ''),
      contentOpportunities: opportunities,
      linkedinPost: obj.linkedinPost ? {
        title: String(obj.linkedinPost.title || ''),
        body: String(obj.linkedinPost.body || obj.linkedinPost.post || ''),
      } : null,
      script: obj.script ? {
        title: String(obj.script.title || ''),
        hook: String(obj.script.hook || ''),
        body: String(obj.script.body || obj.script.script || ''),
        cta: obj.script.cta ? String(obj.script.cta) : undefined,
      } : null,
      carousel: obj.carousel ? {
        title: String(obj.carousel.title || ''),
        slides,
      } : null,
      rawClip: {
        usable: Boolean(obj.rawClip?.usable),
        reasoning: String(obj.rawClip?.reasoning || ''),
        hook: String(obj.rawClip?.hook || ''),
        clipStartSeconds: obj.rawClip?.clipStartSeconds === undefined ? undefined : Number(obj.rawClip.clipStartSeconds),
        clipEndSeconds: obj.rawClip?.clipEndSeconds === undefined ? undefined : Number(obj.rawClip.clipEndSeconds),
        segments: rawSegments,
        structure: Array.isArray(obj.rawClip?.structure) ? obj.rawClip.structure.map((item: any) => String(item)).filter(Boolean) : [],
        caption: obj.rawClip?.caption ? String(obj.rawClip.caption) : '',
      },
    };
  } catch (e) {
    console.error('🔍 [Video Analysis] Failed to parse content analysis JSON:', e, raw);
  }
  return null;
}

export default function RawToPost() {
  // State
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<PostFormat>('linkedin');
  const [generatedPost, setGeneratedPost] = useState('');
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [showingPlayback, setShowingPlayback] = useState(false);
  const [activeMediaDateKey, setActiveMediaDateKey] = useState<string | null>(null);
  const [captureModeDateKey, setCaptureModeDateKey] = useState<string | null>(null);
  const [linkedinDraftText, setLinkedinDraftText] = useState('');
  const [linkedinDraftPostId, setLinkedinDraftPostId] = useState<number | null>(null);
  const [linkedinDraftSaveState, setLinkedinDraftSaveState] = useState<'idle' | 'saving' | 'saved' | 'local' | 'error'>('idle');
  const [instagramScriptDraftText, setInstagramScriptDraftText] = useState('');
  const [instagramScriptDraftPostId, setInstagramScriptDraftPostId] = useState<number | null>(null);
  const [instagramScriptDraftSaveState, setInstagramScriptDraftSaveState] = useState<'idle' | 'saving' | 'saved' | 'local' | 'error'>('idle');
  const [carouselDraftTitle, setCarouselDraftTitle] = useState('');
  const [carouselSlides, setCarouselSlides] = useState<EditableCarouselSlide[]>([]);
  const [carouselActiveSlide, setCarouselActiveSlide] = useState(0);
  const [carouselCaption, setCarouselCaption] = useState('');
  const [carouselTheme, setCarouselTheme] = useState<CarouselTheme>({ ...DEFAULT_CAROUSEL_THEME });
  const [carouselBrandGuidance, setCarouselBrandGuidance] = useState('');
  const [carouselDraftPostId, setCarouselDraftPostId] = useState<number | null>(null);
  const [carouselDraftSaveState, setCarouselDraftSaveState] = useState<'idle' | 'saving' | 'saved' | 'local' | 'error'>('idle');
  const [isGeneratingCarousel, setIsGeneratingCarousel] = useState(false);
  const [isPublishingCarousel, setIsPublishingCarousel] = useState(false);
  const [carouselPublishSuccess, setCarouselPublishSuccess] = useState(false);
  const [carouselPublishStatus, setCarouselPublishStatus] = useState('');
  const [carouselError, setCarouselError] = useState('');
  const [currentRecordingId, setCurrentRecordingId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [savedPosts, setSavedPosts] = useState<GeneratedPost[]>([]);
  const [recordingMode, setRecordingMode] = useState<'camera' | 'screen' | 'both'>('camera');

  // Holistic content plan (from video analysis)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoContentAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [videoProcessingStage, setVideoProcessingStage] = useState<VideoProcessingStage>('idle');
  const [videoProcessingName, setVideoProcessingName] = useState('');

  // Follow-up script self-tape recorder
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [teleprompterScript, setTeleprompterScript] = useState('');
  const [teleprompterTitle, setTeleprompterTitle] = useState('Follow-up video script');
  const [teleprompterSpeed, setTeleprompterSpeed] = useState<'slow' | 'medium' | 'fast'>('medium');
  const [teleprompterCameraReady, setTeleprompterCameraReady] = useState(false);
  const [teleprompterError, setTeleprompterError] = useState('');
  const [isTeleprompterRecording, setIsTeleprompterRecording] = useState(false);
  const [teleprompterCountdown, setTeleprompterCountdown] = useState<number | null>(null);
  const [teleprompterOffset, setTeleprompterOffset] = useState(0);
  const [teleprompterRecordingTime, setTeleprompterRecordingTime] = useState(0);
  const [teleprompterRecordingBlob, setTeleprompterRecordingBlob] = useState<Blob | null>(null);
  const [teleprompterRecordingUrl, setTeleprompterRecordingUrl] = useState<string | null>(null);
  const [teleprompterRecordingMimeType, setTeleprompterRecordingMimeType] = useState('video/webm');
  const [teleprompterRecordingDuration, setTeleprompterRecordingDuration] = useState(0);
  const [teleprompterTrimStart, setTeleprompterTrimStart] = useState(0);
  const [teleprompterTrimEnd, setTeleprompterTrimEnd] = useState(0);
  const [teleprompterCcEnabled, setTeleprompterCcEnabled] = useState(false);
  const [teleprompterCcText, setTeleprompterCcText] = useState('');
  const [teleprompterCcWords, setTeleprompterCcWords] = useState<TimedCaptionWord[]>([]);
  const [isGeneratingTeleprompterCc, setIsGeneratingTeleprompterCc] = useState(false);
  const [teleprompterCcError, setTeleprompterCcError] = useState('');
  const [teleprompterEditorTool, setTeleprompterEditorTool] = useState<TeleprompterEditorTool>('clip');
  const [teleprompterCurrentTime, setTeleprompterCurrentTime] = useState(0);
  const [teleprompterClipSegments, setTeleprompterClipSegments] = useState<TeleprompterClipSegment[]>([]);
  const [activeTeleprompterClipId, setActiveTeleprompterClipId] = useState<string | null>(null);
  const [teleprompterEditPast, setTeleprompterEditPast] = useState<TeleprompterEditState[]>([]);
  const [teleprompterEditFuture, setTeleprompterEditFuture] = useState<TeleprompterEditState[]>([]);
  const [teleprompterEditSaveState, setTeleprompterEditSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [teleprompterEditStorageReady, setTeleprompterEditStorageReady] = useState(false);
  const [teleprompterTimelineFrames, setTeleprompterTimelineFrames] = useState<string[]>([]);
  const [teleprompterEditedBlob, setTeleprompterEditedBlob] = useState<Blob | null>(null);
  const [teleprompterEditedUrl, setTeleprompterEditedUrl] = useState<string | null>(null);
  const [isRenderingTeleprompterEdit, setIsRenderingTeleprompterEdit] = useState(false);
  const [teleprompterPreviewPlaying, setTeleprompterPreviewPlaying] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [isMetaSigningIn, setIsMetaSigningIn] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [instagramCaption, setInstagramCaption] = useState('');
  const [instagramHashtags, setInstagramHashtags] = useState('#buildinpublic #founderjourney');
  const [isPublishingInstagram, setIsPublishingInstagram] = useState(false);
  const [instagramPublishSuccess, setInstagramPublishSuccess] = useState(false);
  const [instagramPostId, setInstagramPostId] = useState('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [isSchedulingInstagram, setIsSchedulingInstagram] = useState(false);
  const [instagramScheduleStatus, setInstagramScheduleStatus] = useState('');
  const [openingSavedRecordingKey, setOpeningSavedRecordingKey] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recordingsRefreshVersion, setRecordingsRefreshVersion] = useState(0);
  const [localRecordingsVersion, setLocalRecordingsVersion] = useState(0);
  const [showReplaceProgressDialog, setShowReplaceProgressDialog] = useState(false);
  const [isReplacingProgress, setIsReplacingProgress] = useState(false);
  const [replaceProgressDateKey, setReplaceProgressDateKey] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Database hooks for loading recordings
  const dateFilter = formatDate(selectedDate);
  const workspaceDbReady = hasWorkspaceDbAuth();
  const refreshRecordings = useCallback(() => {
    setRecordingsRefreshVersion(version => version + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!workspaceDbReady) {
      setRecordings([]);
      return;
    }

    getWorkspaceRows<Recording>(
      'video_recordings',
      [{ column: 'recording_date', operator: 'eq', value: dateFilter }],
      { column: 'created_at', direction: 'desc' }
    )
      .then(rows => {
        if (!cancelled) setRecordings(rows || []);
      })
      .catch(error => {
        console.warn('Failed to load saved recordings:', error);
        if (!cancelled) setRecordings([]);
      });

    return () => {
      cancelled = true;
    };
  }, [dateFilter, recordingsRefreshVersion, workspaceDbReady]);

  const localRecordingsForSelectedDate = useMemo(
    () => getLocalVideoRecordings(dateFilter),
    [dateFilter, localRecordingsVersion]
  );
  const recordingsForSelectedDate = useMemo(
    () => mergeRecordingsForDate(recordings || [], localRecordingsForSelectedDate, dateFilter),
    [recordings, localRecordingsForSelectedDate, dateFilter]
  );
  const selectedDateKeyRef = useRef(dateFilter);
  const activeMediaDateKeyRef = useRef<string | null>(null);

  useEffect(() => {
    selectedDateKeyRef.current = dateFilter;
  }, [dateFilter]);

  const restoreLocalDraftsForDate = (date: string) => {
    const localDraft = window.localStorage.getItem(getLinkedInDraftStorageKey(null, date));
    const localInstagramScriptDraft = window.localStorage.getItem(getInstagramScriptDraftStorageKey(null, date));
    const localCarouselDraft = window.localStorage.getItem(getInstagramCarouselDraftStorageKey(null, date));
    const localCarouselGuidance = window.localStorage.getItem(getInstagramCarouselGuidanceStorageKey(null, date));
    const localContentPlan = window.localStorage.getItem(getContentPlanStorageKey(null, date));
    const restoredAnalysis = parseContentAnalysis(localContentPlan || '');
    const linkedinContent = localDraft || restoredAnalysis?.linkedinPost?.body || '';
    const instagramScriptContent = localInstagramScriptDraft || getTeleprompterText(restoredAnalysis?.script || null);
    const carouselDraft = parseCarouselDraft(localCarouselDraft) || carouselDraftFromAnalysis(restoredAnalysis?.carousel || null);
    const restoredAnalysisWithDrafts = restoredAnalysis
      ? applySavedDraftsToAnalysis(restoredAnalysis, linkedinContent, instagramScriptContent)
      : null;

    if (restoredAnalysis) {
      setVideoAnalysis(restoredAnalysisWithDrafts);
      setFormat(getStoredSelectedFormat(date) || getDefaultDraftFormat(restoredAnalysisWithDrafts!));
      setGeneratedPost('');
    }
    if (linkedinContent) {
      setLinkedinDraftText(linkedinContent);
      setLinkedinDraftSaveState('saved');
      if (!localDraft) {
        window.localStorage.setItem(getLinkedInDraftStorageKey(null, date), linkedinContent);
      }
    } else {
      setLinkedinDraftText('');
      setLinkedinDraftSaveState('idle');
    }
    if (instagramScriptContent) {
      setInstagramScriptDraftText(instagramScriptContent);
      setInstagramScriptDraftSaveState('saved');
      if (!localInstagramScriptDraft) {
        window.localStorage.setItem(getInstagramScriptDraftStorageKey(null, date), instagramScriptContent);
      }
    } else {
      setInstagramScriptDraftText('');
      setInstagramScriptDraftSaveState('idle');
    }
    if (carouselDraft) {
      setCarouselDraftTitle(carouselDraft.title);
      setCarouselSlides(carouselDraft.slides);
      setCarouselCaption(carouselDraft.caption || getCarouselCaptionFromDraft(carouselDraft.title, carouselDraft.slides));
      setCarouselTheme(carouselDraft.theme || { ...DEFAULT_CAROUSEL_THEME });
      setCarouselBrandGuidance(localCarouselGuidance || '');
      setCarouselActiveSlide(0);
      setCarouselDraftSaveState('saved');
      if (!localCarouselDraft) {
        window.localStorage.setItem(getInstagramCarouselDraftStorageKey(null, date), JSON.stringify(carouselDraft));
      }
    } else {
      setCarouselDraftTitle('');
      setCarouselSlides([]);
      setCarouselCaption('');
      setCarouselTheme({ ...DEFAULT_CAROUSEL_THEME });
      setCarouselBrandGuidance(localCarouselGuidance || '');
      setCarouselActiveSlide(0);
      setCarouselDraftSaveState('idle');
      setCarouselPublishSuccess(false);
      setCarouselPublishStatus('');
      setCarouselError('');
    }
  };

  // Load posts for current recording
  useEffect(() => {
    if (currentRecordingId && hasWorkspaceDbAuth()) {
      getWorkspaceRows<GeneratedPost>('video_posts', [{ column: 'recording_id', operator: 'eq', value: currentRecordingId }])
        .then(posts => {
          const nextPosts = posts || [];
          const savedContentPlan = getLatestContentPlanDraft(nextPosts);
          const savedLinkedInDraft = getLatestLinkedInDraft(nextPosts);
          const savedInstagramScriptDraft = getLatestInstagramScriptDraft(nextPosts);
          const savedCarouselDraft = getLatestSavedDraft(nextPosts, 'instagram-carousel');
          const localDraft = window.localStorage.getItem(getLinkedInDraftStorageKey(currentRecordingId, dateFilter));
          const localDateDraft = window.localStorage.getItem(getLinkedInDraftStorageKey(null, dateFilter));
          const localInstagramScriptDraft = window.localStorage.getItem(getInstagramScriptDraftStorageKey(currentRecordingId, dateFilter));
          const localDateInstagramScriptDraft = window.localStorage.getItem(getInstagramScriptDraftStorageKey(null, dateFilter));
          const localCarouselDraft = window.localStorage.getItem(getInstagramCarouselDraftStorageKey(currentRecordingId, dateFilter));
          const localDateCarouselDraft = window.localStorage.getItem(getInstagramCarouselDraftStorageKey(null, dateFilter));
          const localCarouselGuidance = window.localStorage.getItem(getInstagramCarouselGuidanceStorageKey(currentRecordingId, dateFilter));
          const localDateCarouselGuidance = window.localStorage.getItem(getInstagramCarouselGuidanceStorageKey(null, dateFilter));
          const localContentPlan = window.localStorage.getItem(getContentPlanStorageKey(currentRecordingId, dateFilter));
          const localDateContentPlan = window.localStorage.getItem(getContentPlanStorageKey(null, dateFilter));
          const restoredAnalysis = parseContentAnalysis(savedContentPlan?.content || localContentPlan || localDateContentPlan || '');
          const linkedinContent = savedLinkedInDraft?.content || localDraft || localDateDraft || restoredAnalysis?.linkedinPost?.body || '';
          const instagramScriptContent = savedInstagramScriptDraft?.content || localInstagramScriptDraft || localDateInstagramScriptDraft || getTeleprompterText(restoredAnalysis?.script || null);
          const carouselDraft = parseCarouselDraft(localCarouselDraft)
            || parseCarouselDraft(localDateCarouselDraft)
            || parseCarouselDraft(savedCarouselDraft?.content || null)
            || carouselDraftFromAnalysis(restoredAnalysis?.carousel || null);
          const restoredAnalysisWithDrafts = restoredAnalysis
            ? applySavedDraftsToAnalysis(restoredAnalysis, linkedinContent, instagramScriptContent)
            : null;

          setSavedPosts(nextPosts);
          setLinkedinDraftPostId(savedLinkedInDraft?.id || null);
          setInstagramScriptDraftPostId(savedInstagramScriptDraft?.id || null);
          setCarouselDraftPostId(savedCarouselDraft?.id || null);
          if (restoredAnalysis) {
            setVideoAnalysis(restoredAnalysisWithDrafts);
            setFormat(getStoredSelectedFormat(dateFilter) || getDefaultDraftFormat(restoredAnalysisWithDrafts!));
            setGeneratedPost('');
          }
          if (linkedinContent) {
            setLinkedinDraftText(linkedinContent);
            setLinkedinDraftSaveState('saved');
            if (!localDateDraft) {
              window.localStorage.setItem(getLinkedInDraftStorageKey(null, dateFilter), linkedinContent);
            }
          } else {
            setLinkedinDraftText('');
            setLinkedinDraftSaveState('idle');
          }
          if (instagramScriptContent) {
            setInstagramScriptDraftText(instagramScriptContent);
            setInstagramScriptDraftSaveState('saved');
            if (!localDateInstagramScriptDraft) {
              window.localStorage.setItem(getInstagramScriptDraftStorageKey(null, dateFilter), instagramScriptContent);
            }
          } else {
            setInstagramScriptDraftText('');
            setInstagramScriptDraftSaveState('idle');
          }
          if (carouselDraft) {
            setCarouselDraftTitle(carouselDraft.title);
            setCarouselSlides(carouselDraft.slides);
            setCarouselCaption(carouselDraft.caption || getCarouselCaptionFromDraft(carouselDraft.title, carouselDraft.slides));
            setCarouselTheme(carouselDraft.theme || { ...DEFAULT_CAROUSEL_THEME });
            setCarouselBrandGuidance(localCarouselGuidance || localDateCarouselGuidance || '');
            setCarouselActiveSlide(0);
            setCarouselDraftSaveState('saved');
            if (!localDateCarouselDraft) {
              window.localStorage.setItem(getInstagramCarouselDraftStorageKey(null, dateFilter), JSON.stringify(carouselDraft));
            }
          } else {
            setCarouselDraftTitle('');
            setCarouselSlides([]);
            setCarouselCaption('');
            setCarouselTheme({ ...DEFAULT_CAROUSEL_THEME });
            setCarouselBrandGuidance(localCarouselGuidance || localDateCarouselGuidance || '');
            setCarouselActiveSlide(0);
            setCarouselDraftSaveState('idle');
          }

          if (restoredAnalysis && !savedContentPlan) {
            void saveContentPlanSnapshot(restoredAnalysisWithDrafts!, currentRecordingId, dateFilter);
          }
          if (linkedinContent && !savedLinkedInDraft) {
            void saveLinkedInDraft(linkedinContent, currentRecordingId, dateFilter);
          }
          if (instagramScriptContent && !savedInstagramScriptDraft) {
            void saveInstagramScriptDraft(instagramScriptContent, currentRecordingId, dateFilter);
          }
          if (carouselDraft && !savedCarouselDraft) {
            void saveCarouselDraft(carouselDraft.title, carouselDraft.slides, carouselDraft.caption, currentRecordingId, dateFilter);
          }
        })
        .catch(err => {
          console.error('Failed to load posts:', err);
          setSavedPosts([]);
          setLinkedinDraftPostId(null);
          setInstagramScriptDraftPostId(null);
          setCarouselDraftPostId(null);
          restoreLocalDraftsForDate(dateFilter);
        });
    } else {
      setSavedPosts([]);
      setLinkedinDraftPostId(null);
      setInstagramScriptDraftPostId(null);
      setCarouselDraftPostId(null);
      restoreLocalDraftsForDate(dateFilter);
    }
  }, [currentRecordingId, dateFilter]);

  // Refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const teleprompterVideoRef = useRef<HTMLVideoElement>(null);
  const teleprompterMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const teleprompterStreamRef = useRef<MediaStream | null>(null);
  const teleprompterChunksRef = useRef<Blob[]>([]);
  const teleprompterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const teleprompterOverlayRef = useRef<HTMLDivElement>(null);
  const teleprompterTextRef = useRef<HTMLDivElement>(null);
  const teleprompterReviewVideoRef = useRef<HTMLVideoElement>(null);
  const teleprompterTimelineRef = useRef<HTMLDivElement>(null);
  const teleprompterScrollFrameRef = useRef<number | null>(null);
  const teleprompterLastFrameRef = useRef<number | null>(null);
  const teleprompterStartTokenRef = useRef(0);
  const teleprompterCaptionRequestRef = useRef(0);
  const teleprompterCaptionsSuppressedRef = useRef(false);
  const teleprompterTimelineFrameRequestRef = useRef(0);
  const teleprompterEditAutosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teleprompterLastSavedEditSnapshotRef = useRef('');
  const linkedinDraftAutosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instagramScriptDraftAutosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carouselDraftAutosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate week dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const referenceDate = new Date(today);
  referenceDate.setDate(today.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(referenceDate);

  // Clean up media resources on unmount. Media permissions are requested only after user action.
  useEffect(() => {
    return () => {
      stopCamera();
      stopTeleprompterCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (teleprompterTimerRef.current) clearInterval(teleprompterTimerRef.current);
      if (teleprompterScrollFrameRef.current) cancelAnimationFrame(teleprompterScrollFrameRef.current);
      if (linkedinDraftAutosaveRef.current) clearTimeout(linkedinDraftAutosaveRef.current);
      if (instagramScriptDraftAutosaveRef.current) clearTimeout(instagramScriptDraftAutosaveRef.current);
      if (carouselDraftAutosaveRef.current) clearTimeout(carouselDraftAutosaveRef.current);
    };
  }, []);

  const refreshInstagramConnection = useCallback(async (): Promise<boolean> => {
    try {
      const { base, headers } = getMarketingContext();
      const response = await fetch(`${base}/connect/status`, { headers });
      const data = await readApiResponse(response);
      if (!response.ok || data.success === false) {
        throw new Error(getApiErrorMessage(data, 'Could not read Instagram connection status.'));
      }

      const connected = Boolean(data.connected && data.page);
      setMetaConnected(connected);
      return connected;
    } catch (err) {
      console.warn('Instagram connection status unavailable:', err);
      setMetaConnected(false);
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshInstagramConnection();
  }, [refreshInstagramConnection]);

  useEffect(() => {
    if (showTeleprompter && teleprompterVideoRef.current && teleprompterStreamRef.current) {
      teleprompterVideoRef.current.srcObject = teleprompterStreamRef.current;
      teleprompterVideoRef.current.muted = true;
      teleprompterVideoRef.current.play().catch(err => {
        console.warn('Teleprompter preview playback failed:', err);
      });
    }
  }, [showTeleprompter, teleprompterScript]);

  useEffect(() => {
    return () => {
      if (teleprompterRecordingUrl) URL.revokeObjectURL(teleprompterRecordingUrl);
    };
  }, [teleprompterRecordingUrl]);

  useEffect(() => {
    return () => {
      if (teleprompterEditedUrl) URL.revokeObjectURL(teleprompterEditedUrl);
    };
  }, [teleprompterEditedUrl]);

  useEffect(() => {
    if (teleprompterEditAutosaveRef.current) {
      clearTimeout(teleprompterEditAutosaveRef.current);
      teleprompterEditAutosaveRef.current = null;
    }
    teleprompterLastSavedEditSnapshotRef.current = '';
    if (!teleprompterRecordingUrl) {
      setTeleprompterRecordingDuration(0);
      setTeleprompterTrimStart(0);
      setTeleprompterTrimEnd(0);
      setTeleprompterCcEnabled(false);
      setTeleprompterCcText('');
      setTeleprompterCcWords([]);
      setTeleprompterCcError('');
      setTeleprompterCurrentTime(0);
      setTeleprompterClipSegments([]);
      setActiveTeleprompterClipId(null);
      setTeleprompterEditPast([]);
      setTeleprompterEditFuture([]);
      setTeleprompterEditSaveState('idle');
      setTeleprompterEditStorageReady(false);
      setTeleprompterTimelineFrames([]);
      setTeleprompterEditorTool('clip');
      setTeleprompterPreviewPlaying(false);
      return;
    }

    const fallbackDuration = Math.max(1, teleprompterRecordingTime || 1);
    const initialClip = createTeleprompterClipSegment(0, fallbackDuration);
    setTeleprompterRecordingDuration(fallbackDuration);
    setTeleprompterTrimStart(0);
    setTeleprompterTrimEnd(fallbackDuration);
    setTeleprompterCcEnabled(false);
    setTeleprompterCcText('');
    setTeleprompterCcWords([]);
    setTeleprompterCcError('');
    setTeleprompterCurrentTime(0);
    setTeleprompterClipSegments([initialClip]);
    setActiveTeleprompterClipId(initialClip.id);
    setTeleprompterEditPast([]);
    setTeleprompterEditFuture([]);
    setTeleprompterEditSaveState('idle');
    setTeleprompterEditStorageReady(false);
    setTeleprompterTimelineFrames([]);
    setTeleprompterEditorTool('clip');
    setTeleprompterPreviewPlaying(false);
  }, [teleprompterRecordingUrl]);

  useEffect(() => {
    if (teleprompterEditedUrl) URL.revokeObjectURL(teleprompterEditedUrl);
    setTeleprompterEditedUrl(null);
    setTeleprompterEditedBlob(null);
  }, [teleprompterTrimStart, teleprompterTrimEnd, teleprompterClipSegments, teleprompterCcEnabled, teleprompterCcText, teleprompterCcWords]);

  useEffect(() => {
    if (!teleprompterRecordingUrl || !teleprompterEditStorageReady || !teleprompterRecordingDuration) return;
    if (typeof window === 'undefined') return;

    const snapshot = getCurrentTeleprompterEditSnapshot();
    const serialized = serializeTeleprompterEditState(snapshot);
    if (serialized === teleprompterLastSavedEditSnapshotRef.current) {
      setTeleprompterEditSaveState('saved');
      return;
    }

    if (teleprompterEditAutosaveRef.current) {
      clearTimeout(teleprompterEditAutosaveRef.current);
    }
    setTeleprompterEditSaveState('saving');
    teleprompterEditAutosaveRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(getCurrentTeleprompterEditStorageKey(), JSON.stringify({
          version: 1,
          duration: getTeleprompterReviewDuration(),
          updatedAt: new Date().toISOString(),
          state: snapshot,
        }));
        teleprompterLastSavedEditSnapshotRef.current = serialized;
        setTeleprompterEditSaveState('saved');
      } catch (error) {
        console.warn('Could not autosave video edits:', error);
        setTeleprompterEditSaveState('idle');
      } finally {
        teleprompterEditAutosaveRef.current = null;
      }
    }, 250);

    return () => {
      if (teleprompterEditAutosaveRef.current) {
        clearTimeout(teleprompterEditAutosaveRef.current);
        teleprompterEditAutosaveRef.current = null;
      }
    };
  }, [
    teleprompterRecordingUrl,
    teleprompterRecordingDuration,
    teleprompterRecordingTime,
    teleprompterRecordingMimeType,
    teleprompterEditStorageReady,
    teleprompterTrimStart,
    teleprompterTrimEnd,
    teleprompterClipSegments,
    activeTeleprompterClipId,
    currentRecordingId,
    dateFilter,
    teleprompterTitle,
  ]);

  const resetTeleprompterScroll = () => {
    const overlayHeight = teleprompterOverlayRef.current?.clientHeight || 420;
    setTeleprompterOffset(Math.round(overlayHeight * 0.58));
    teleprompterLastFrameRef.current = null;
  };

  useEffect(() => {
    if (!showTeleprompter || !teleprompterScript) return;
    resetTeleprompterScroll();
  }, [showTeleprompter, teleprompterScript]);

  useEffect(() => {
    if (teleprompterScrollFrameRef.current) {
      cancelAnimationFrame(teleprompterScrollFrameRef.current);
      teleprompterScrollFrameRef.current = null;
    }
    teleprompterLastFrameRef.current = null;

    const shouldScrollTeleprompter = showTeleprompter && teleprompterCameraReady && isTeleprompterRecording && !teleprompterRecordingUrl;
    if (!shouldScrollTeleprompter) return;

    const pixelsPerSecond = teleprompterSpeed === 'slow' ? 14 : teleprompterSpeed === 'fast' ? 38 : 24;

    const scroll = (timestamp: number) => {
      const lastTimestamp = teleprompterLastFrameRef.current ?? timestamp;
      const elapsedSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.08);
      teleprompterLastFrameRef.current = timestamp;

      const textHeight = teleprompterTextRef.current?.scrollHeight || 600;
      const overlayHeight = teleprompterOverlayRef.current?.clientHeight || 420;
      const minOffset = -textHeight - 32;
      setTeleprompterOffset(currentOffset => {
        const nextOffset = currentOffset - pixelsPerSecond * elapsedSeconds;
        if (nextOffset <= minOffset) {
          return isTeleprompterRecording ? minOffset : Math.round(overlayHeight * 0.58);
        }
        return nextOffset;
      });

      teleprompterScrollFrameRef.current = requestAnimationFrame(scroll);
    };

    teleprompterScrollFrameRef.current = requestAnimationFrame(scroll);

    return () => {
      if (teleprompterScrollFrameRef.current) {
        cancelAnimationFrame(teleprompterScrollFrameRef.current);
        teleprompterScrollFrameRef.current = null;
      }
      teleprompterLastFrameRef.current = null;
    };
  }, [showTeleprompter, teleprompterCameraReady, teleprompterRecordingUrl, isTeleprompterRecording, teleprompterSpeed]);

  // Load existing recording when date changes
  useEffect(() => {
    if (replaceProgressDateKey === dateFilter) {
      return;
    }

    const hasActiveMediaForSelectedDate = activeMediaDateKeyRef.current === dateFilter
      || ((activeMediaDateKey === dateFilter || captureModeDateKey === dateFilter)
        && (showingPlayback || isAnalyzing || Boolean(videoBlob) || Boolean(videoUrl)));

    if (hasActiveMediaForSelectedDate) {
      return;
    }

    if (recordingsForSelectedDate.length > 0) {
      const latestRecording = recordingsForSelectedDate[0];
      const nextRecordingId = latestRecording.id > 0 ? latestRecording.id : null;
      setCurrentRecordingId(nextRecordingId);

      setShowingPlayback(false);
      setActiveMediaDateKey(null);
      activeMediaDateKeyRef.current = null;
      setCaptureModeDateKey(null);
      setVideoBlob(null);
      setVideoUrl(null);
      setGeneratedPost('');
      setIsAnalyzing(false);
      setVideoProcessingStage('idle');
      setVideoProcessingName('');
      setAnalysisError('');
      if (!nextRecordingId) {
        restoreLocalDraftsForDate(dateFilter);
      }
    } else {
      if (hasLocalSavedDayContent(dateFilter)) {
        setCurrentRecordingId(null);
        setShowingPlayback(false);
        setActiveMediaDateKey(null);
        activeMediaDateKeyRef.current = null;
        setCaptureModeDateKey(null);
        setVideoBlob(null);
        setVideoUrl(null);
        setGeneratedPost('');
        setSavedPosts([]);
        setIsAnalyzing(false);
        setVideoProcessingStage('idle');
        setVideoProcessingName('');
        setAnalysisError('');
        return;
      }

      // Reset for new day
      setCurrentRecordingId(null);
      setShowingPlayback(false);
      setActiveMediaDateKey(null);
      activeMediaDateKeyRef.current = null;
      setCaptureModeDateKey(null);
      setVideoBlob(null);
      setVideoUrl(null);
      setGeneratedPost('');
      setSavedPosts([]);
      setLinkedinDraftText('');
      setLinkedinDraftPostId(null);
      setLinkedinDraftSaveState('idle');
      setInstagramScriptDraftText('');
      setInstagramScriptDraftPostId(null);
      setInstagramScriptDraftSaveState('idle');
      setIsAnalyzing(false);
      setVideoProcessingStage('idle');
      setVideoProcessingName('');
      setVideoAnalysis(null);
      setAnalysisError('');
    }
  }, [recordingsForSelectedDate, dateFilter, activeMediaDateKey, captureModeDateKey, showingPlayback, isAnalyzing, videoBlob, videoUrl, replaceProgressDateKey]);

  const initCamera = async (mode: 'camera' | 'screen' | 'both' = 'camera'): Promise<boolean> => {
    try {
      setCameraError('');
      setCameraReady(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not available in this preview context.');
        return false;
      }

      // Stop any existing streams first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      let stream: MediaStream;

      if (mode === 'both') {
        // Loom-style: Screen + Camera PiP
        // First get screen
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
        screenStreamRef.current = screenStream;

        // Then get camera
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
          audio: true,
        });
        cameraStreamRef.current = cameraStream;

        // Handle screen share stop
        screenStream.getVideoTracks()[0].onended = () => {
          setRecordingMode('camera');
          setCameraReady(false);
        };

        // Set up canvas compositing
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = 1280;
          canvas.height = 720;
          const ctx = canvas.getContext('2d');

          // Create video elements for drawing
          const screenVideo = document.createElement('video');
          screenVideo.srcObject = screenStream;
          screenVideo.muted = true;
          screenVideo.play();

          const cameraVideo = document.createElement('video');
          cameraVideo.srcObject = cameraStream;
          cameraVideo.muted = true;
          cameraVideo.play();

          // Compositing loop
          const drawFrame = () => {
            if (!ctx || !canvasRef.current) return;

            // Draw screen (full canvas)
            ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

            // Draw camera PiP (bottom-right corner) - native aspect ratio (4:3)
            const pipWidth = 240;
            const pipHeight = 180; // 4:3 aspect ratio
            const pipMargin = 20;
            const pipX = canvas.width - pipWidth - pipMargin;
            const pipY = canvas.height - pipHeight - pipMargin;

            // Draw camera (mirrored) with rounded corners
            ctx.save();

            // Rounded rectangle clip
            const radius = 12;
            ctx.beginPath();
            ctx.moveTo(pipX + radius, pipY);
            ctx.lineTo(pipX + pipWidth - radius, pipY);
            ctx.quadraticCurveTo(pipX + pipWidth, pipY, pipX + pipWidth, pipY + radius);
            ctx.lineTo(pipX + pipWidth, pipY + pipHeight - radius);
            ctx.quadraticCurveTo(pipX + pipWidth, pipY + pipHeight, pipX + pipWidth - radius, pipY + pipHeight);
            ctx.lineTo(pipX + radius, pipY + pipHeight);
            ctx.quadraticCurveTo(pipX, pipY + pipHeight, pipX, pipY + pipHeight - radius);
            ctx.lineTo(pipX, pipY + radius);
            ctx.quadraticCurveTo(pipX, pipY, pipX + radius, pipY);
            ctx.closePath();
            ctx.clip();

            // Draw camera (mirrored)
            ctx.translate(pipX + pipWidth, pipY);
            ctx.scale(-1, 1);
            ctx.drawImage(cameraVideo, 0, 0, pipWidth, pipHeight);
            ctx.restore();

            // Draw border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(pipX + radius, pipY);
            ctx.lineTo(pipX + pipWidth - radius, pipY);
            ctx.quadraticCurveTo(pipX + pipWidth, pipY, pipX + pipWidth, pipY + radius);
            ctx.lineTo(pipX + pipWidth, pipY + pipHeight - radius);
            ctx.quadraticCurveTo(pipX + pipWidth, pipY + pipHeight, pipX + pipWidth - radius, pipY + pipHeight);
            ctx.lineTo(pipX + radius, pipY + pipHeight);
            ctx.quadraticCurveTo(pipX, pipY + pipHeight, pipX, pipY + pipHeight - radius);
            ctx.lineTo(pipX, pipY + radius);
            ctx.quadraticCurveTo(pipX, pipY, pipX + radius, pipY);
            ctx.closePath();
            ctx.stroke();

            animationFrameRef.current = requestAnimationFrame(drawFrame);
          };

          // Wait for videos to be ready
          await Promise.all([
            new Promise(r => screenVideo.onloadedmetadata = r),
            new Promise(r => cameraVideo.onloadedmetadata = r),
          ]);

          drawFrame();

          // Capture stream from canvas + audio from camera
          const canvasStream = canvas.captureStream(30);
          const audioTrack = cameraStream.getAudioTracks()[0];
          stream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);
        } else {
          throw new Error('Canvas not available');
        }
      } else if (mode === 'screen') {
        // Screen sharing mode - get screen + mic audio
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true, // System audio if available
        });

        // Get mic audio separately (more reliable)
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Combine screen video with mic audio
          const videoTrack = screenStream.getVideoTracks()[0];
          const audioTrack = audioStream.getAudioTracks()[0];
          stream = new MediaStream([videoTrack, audioTrack]);

          // Handle screen share stop (user clicks "Stop sharing")
          videoTrack.onended = () => {
            setRecordingMode('camera');
            setCameraReady(false);
          };
        } catch (audioErr) {
          // Fall back to just screen (may have system audio)
          stream = screenStream;
        }
      } else {
        // Camera mode (default)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      }

      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        await videoPreviewRef.current.play();
      }
      setCameraReady(true);
      return true;
    } catch (err: any) {
      console.warn('Media permission unavailable:', err?.name || err);
      const permissionMessage = window.self !== window.top
        ? 'Recording is blocked in this preview frame. Upload a video, or open the app in a new tab to grant browser permissions.'
        : 'Browser permission was not granted. Check site permissions, or upload a video instead.';
      if (mode === 'screen' || mode === 'both') {
        setCameraError(permissionMessage);
        setRecordingMode('camera');
      } else {
        setCameraError(permissionMessage);
      }
      setCameraReady(false);
      return false;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const stopTeleprompterCamera = () => {
    if (teleprompterMediaRecorderRef.current && teleprompterMediaRecorderRef.current.state !== 'inactive') {
      teleprompterMediaRecorderRef.current.stop();
    }
    if (teleprompterStreamRef.current) {
      teleprompterStreamRef.current.getTracks().forEach(track => track.stop());
      teleprompterStreamRef.current = null;
    }
    if (teleprompterVideoRef.current) {
      teleprompterVideoRef.current.srcObject = null;
    }
    if (teleprompterTimerRef.current) {
      clearInterval(teleprompterTimerRef.current);
      teleprompterTimerRef.current = null;
    }
    if (teleprompterScrollFrameRef.current) {
      cancelAnimationFrame(teleprompterScrollFrameRef.current);
      teleprompterScrollFrameRef.current = null;
    }
    teleprompterLastFrameRef.current = null;
    teleprompterStartTokenRef.current += 1;
    setTeleprompterCountdown(null);
    setTeleprompterCameraReady(false);
    setIsTeleprompterRecording(false);
  };

  const clearTeleprompterRecording = () => {
    teleprompterCaptionRequestRef.current += 1;
    teleprompterCaptionsSuppressedRef.current = true;
    if (teleprompterRecordingUrl) URL.revokeObjectURL(teleprompterRecordingUrl);
    if (teleprompterEditedUrl) URL.revokeObjectURL(teleprompterEditedUrl);
    if (teleprompterEditAutosaveRef.current) {
      clearTimeout(teleprompterEditAutosaveRef.current);
      teleprompterEditAutosaveRef.current = null;
    }
    teleprompterLastSavedEditSnapshotRef.current = '';
    setTeleprompterRecordingBlob(null);
    setTeleprompterRecordingUrl(null);
    setTeleprompterRecordingTime(0);
    setTeleprompterRecordingDuration(0);
    setTeleprompterTrimStart(0);
    setTeleprompterTrimEnd(0);
    setTeleprompterCcEnabled(false);
    setTeleprompterCcText('');
    setTeleprompterCcWords([]);
    setTeleprompterCcError('');
    setIsGeneratingTeleprompterCc(false);
    setTeleprompterEditedBlob(null);
    setTeleprompterEditedUrl(null);
    setTeleprompterEditPast([]);
    setTeleprompterEditFuture([]);
    setTeleprompterEditSaveState('idle');
    setTeleprompterEditStorageReady(false);
    setTeleprompterPreviewPlaying(false);
    teleprompterChunksRef.current = [];
    setMetaError('');
    setInstagramPublishSuccess(false);
    setInstagramPostId('');
    setShowScheduleDialog(false);
    setInstagramScheduleStatus('');
    resetTeleprompterScroll();
  };

  const initTeleprompterCamera = async (): Promise<boolean> => {
    try {
      setTeleprompterError('');

      if (!navigator.mediaDevices?.getUserMedia) {
        setTeleprompterError('Camera access is not available in this browser context.');
        return false;
      }

      stopCamera();
      setCameraReady(false);
      if (teleprompterStreamRef.current) {
        teleprompterStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });

      teleprompterStreamRef.current = stream;
      if (teleprompterVideoRef.current) {
        teleprompterVideoRef.current.srcObject = stream;
        teleprompterVideoRef.current.muted = true;
        await teleprompterVideoRef.current.play();
      }
      setTeleprompterCameraReady(true);
      return true;
    } catch (err: any) {
      console.warn('Teleprompter camera unavailable:', err?.name || err);
      setTeleprompterError(
        window.self !== window.top
          ? 'Camera recording is blocked in this preview frame. Open the app in a new tab to grant camera permission.'
          : 'Camera permission was not granted. Check site permissions and try again.'
      );
      setTeleprompterCameraReady(false);
      return false;
    }
  };

  const openTeleprompterForScript = async (script: VideoContentAnalysis['script'], overrideText?: string) => {
    const scriptText = overrideText?.trim() || getTeleprompterText(script);
    if (!scriptText) return;

    clearTeleprompterRecording();
    setFormat('instagram-video');
    window.localStorage.setItem(getSelectedFormatStorageKey(dateFilter), 'instagram-video');
    window.localStorage.setItem(getInstagramScriptDraftStorageKey(currentRecordingId, dateFilter), scriptText);
    window.localStorage.setItem(getInstagramScriptDraftStorageKey(null, dateFilter), scriptText);
    setTeleprompterTitle(script?.title || 'Follow-up video script');
    setTeleprompterScript(scriptText);
    setInstagramCaption(script?.title || '');
    setInstagramHashtags('#buildinpublic #founderjourney');
    setShowTeleprompter(true);
    setTeleprompterError('');
    setMetaError('');
    setInstagramPublishSuccess(false);
    setInstagramPostId('');
    setGeneratedPost('');

    await new Promise(resolve => requestAnimationFrame(resolve));
    await initTeleprompterCamera();

    window.setTimeout(() => {
      document.getElementById('teleprompter-review-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const openSavedRecordingForInstagram = async (recording: Recording) => {
    if (!recording.video_url) return;

    const recordingKey = `${recording.id}:${recording.video_url}`;
    setOpeningSavedRecordingKey(recordingKey);
    setMetaError('');

    try {
      const response = await fetch(recording.video_url);
      if (!response.ok) {
        throw new Error('Could not load this saved video for Instagram.');
      }

      const fetchedBlob = await response.blob();
      if (!fetchedBlob.size) {
        throw new Error('This saved video is empty.');
      }

      const contentType = fetchedBlob.type || response.headers.get('content-type') || 'video/mp4';
      const videoBlobForReview = fetchedBlob.type ? fetchedBlob : new Blob([fetchedBlob], { type: contentType });
      const objectUrl = URL.createObjectURL(videoBlobForReview);
      const recordingId = recording.id > 0 ? recording.id : null;
      const savedScriptText = (
        instagramScriptDraftText.trim()
        || (recordingId ? window.localStorage.getItem(getInstagramScriptDraftStorageKey(recordingId, dateFilter)) : '')
        || window.localStorage.getItem(getInstagramScriptDraftStorageKey(null, dateFilter))
        || ''
      ).trim();
      const displayTitle = getRecordingDisplayTitle(recording);
      const duration = Math.max(1, Math.round(recording.duration_seconds || 1));
      const initialClip = createTeleprompterClipSegment(0, duration);

      stopTeleprompterCamera();
      clearTeleprompterRecording();
      setFormat('instagram-video');
      window.localStorage.setItem(getSelectedFormatStorageKey(dateFilter), 'instagram-video');
      setCurrentRecordingId(recordingId);
      setShowTeleprompter(true);
      setTeleprompterTitle(displayTitle);
      setTeleprompterScript(savedScriptText || displayTitle);
      setTeleprompterRecordingBlob(videoBlobForReview);
      setTeleprompterRecordingUrl(objectUrl);
      setTeleprompterRecordingMimeType(contentType);
      setTeleprompterRecordingTime(duration);
      setTeleprompterRecordingDuration(duration);
      setTeleprompterTrimStart(0);
      setTeleprompterTrimEnd(duration);
      setTeleprompterClipSegments([initialClip]);
      setActiveTeleprompterClipId(initialClip.id);
      setTeleprompterCurrentTime(0);
      setTeleprompterEditorTool('clip');
      setTeleprompterPreviewPlaying(false);
      setInstagramCaption(displayTitle === 'Saved video' ? '' : displayTitle);
      setInstagramHashtags('#buildinpublic #founderjourney');
      setInstagramPublishSuccess(false);
      setInstagramPostId('');
      setShowScheduleDialog(false);
      setInstagramScheduleStatus('');
      setGeneratedPost('');
      setVideoAnalysis(current => {
        if (!current) return createSavedRecordingAnalysis(recording, savedScriptText);
        if (savedScriptText && !current.script) {
          return {
            ...current,
            recommendedFormat: 'instagram-video',
            script: {
              title: displayTitle,
              hook: '',
              body: savedScriptText,
            },
          };
        }
        return { ...current, recommendedFormat: 'instagram-video' };
      });

      window.setTimeout(() => {
        document.getElementById('teleprompter-review-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      console.error('Could not open saved recording for Instagram:', err);
      setMetaError(err.message || 'Could not open this saved video for Instagram.');
    } finally {
      setOpeningSavedRecordingKey(null);
    }
  };

  const persistLocalRecordingForDate = (recording: Recording): Recording => {
    const savedRecording = saveLocalVideoRecording(recording);
    setLocalRecordingsVersion(version => version + 1);
    if (replaceProgressDateKey === savedRecording.recording_date) {
      setReplaceProgressDateKey(null);
    }
    return savedRecording;
  };

  const closeTeleprompter = () => {
    stopTeleprompterCamera();
    clearTeleprompterRecording();
    setShowTeleprompter(false);
    setTeleprompterScript('');
    setTeleprompterTitle('Follow-up video script');
    setTeleprompterError('');
  };

  const startTeleprompterRecording = async () => {
    if (isTeleprompterRecording || teleprompterCountdown !== null) return;

    let stream = teleprompterStreamRef.current;
    if (!stream) {
      const ready = await initTeleprompterCamera();
      if (!ready || !teleprompterStreamRef.current) return;
      stream = teleprompterStreamRef.current;
    }

    clearTeleprompterRecording();
    setTeleprompterError('');
    teleprompterChunksRef.current = [];
    resetTeleprompterScroll();

    const startToken = teleprompterStartTokenRef.current + 1;
    teleprompterStartTokenRef.current = startToken;
    for (const count of [3, 2, 1]) {
      setTeleprompterCountdown(count);
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (teleprompterStartTokenRef.current !== startToken) {
        setTeleprompterCountdown(null);
        return;
      }
    }
    setTeleprompterCountdown(null);

    try {
      const mimeType = getSupportedRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const blobType = mimeType || 'video/webm';
      setTeleprompterRecordingMimeType(blobType);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          teleprompterChunksRef.current.push(event.data);
        }
      };

      const recordingDate = dateFilter;
      const titleAtStart = teleprompterTitle;

      recorder.onstop = () => {
        const blob = new Blob(teleprompterChunksRef.current, { type: blobType });
        setTeleprompterRecordingBlob(blob);
        setTeleprompterRecordingUrl(URL.createObjectURL(blob));
        void saveVideoRecording(blob, {
          recordingDate,
          title: `Talk-to-camera: ${titleAtStart}`,
          durationSeconds: teleprompterChunksRef.current.length || teleprompterRecordingTime || 1,
          setAsCurrent: false,
        });
      };

      teleprompterMediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsTeleprompterRecording(true);
      setTeleprompterRecordingTime(0);
      teleprompterTimerRef.current = setInterval(() => {
        setTeleprompterRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Teleprompter recording failed:', err);
      setTeleprompterError('Recording could not start in this browser.');
    }
  };

  const stopTeleprompterRecording = () => {
    if (teleprompterCountdown !== null) {
      teleprompterStartTokenRef.current += 1;
      setTeleprompterCountdown(null);
      return;
    }

    if (teleprompterMediaRecorderRef.current && isTeleprompterRecording) {
      teleprompterMediaRecorderRef.current.stop();
      setIsTeleprompterRecording(false);
      if (teleprompterTimerRef.current) {
        clearInterval(teleprompterTimerRef.current);
        teleprompterTimerRef.current = null;
      }
      if (teleprompterScrollFrameRef.current) {
        cancelAnimationFrame(teleprompterScrollFrameRef.current);
        teleprompterScrollFrameRef.current = null;
      }
      teleprompterLastFrameRef.current = null;
    }
  };

  const startMetaSignIn = async () => {
    setIsMetaSigningIn(true);
    setMetaError('');

    try {
      const { base, headers } = getMarketingContext();
      const response = await fetch(`${base}/connect/init`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ scopes: ['content_publishing'] }),
      });
      const data = await readApiResponse(response);
      if (!response.ok || !data.authUrl) {
        throw new Error(getApiErrorMessage(data, 'Could not start Instagram sign-in.'));
      }

      const popup = window.open(data.authUrl, 'instagram-connect', 'width=640,height=760');
      if (!popup) {
        throw new Error('Instagram sign-in popup was blocked. Allow popups for this site and try again.');
      }

      const connected = await new Promise<boolean>((resolve) => {
        let attempts = 0;
        const timer = window.setInterval(async () => {
          attempts += 1;
          const isConnected = await refreshInstagramConnection();
          if (isConnected) {
            window.clearInterval(timer);
            popup.close();
            resolve(true);
            return;
          }

          if (popup.closed || attempts >= 90) {
            window.clearInterval(timer);
            resolve(false);
          }
        }, 2000);
      });

      if (!connected) {
        setMetaConnected(false);
        setMetaError('Instagram sign-in did not finish. Complete the Meta popup, then try again.');
      } else {
        setMetaConnected(true);
        setMetaError('');
      }
    } catch (err: any) {
      console.error('Instagram setup failed:', err);
      setMetaError(err.message || 'Could not prepare Instagram publishing.');
    } finally {
      setIsMetaSigningIn(false);
    }
  };

  const uploadVideoBlob = async (blob: Blob, fileName: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const response = await fetch('/api/upload/file', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Could not upload the recorded video.');
    }

    const data = await response.json();
    const url = data.url || data.fileUrl || data.publicUrl;
    if (!url) {
      throw new Error('Upload finished without a video URL.');
    }
    return url;
  };

  const insertVideoRecordingUrl = async (linkUrl: string, options: SaveVideoRecordingOptions): Promise<number | null> => {
    if (!hasWorkspaceDbAuth()) return null;

    try {
      const payload = {
        video_url: linkUrl,
        duration_seconds: Math.max(1, Math.round(options.durationSeconds || recordingTime || 1)),
        recording_date: options.recordingDate,
        status: 'ready',
        title: options.title,
      };

      const insertResult = await window.__workspaceDb.from('video_recordings').insert(payload);
      let recordingId = getInsertedId(insertResult);
      if (!recordingId) {
        const rows = await getWorkspaceRows<Recording>(
          'video_recordings',
          [{ column: 'recording_date', operator: 'eq', value: options.recordingDate }],
          { column: 'created_at', direction: 'desc' }
        );
        const matchingRow = (rows || []).find((row: Recording) => row.video_url === linkUrl) || rows?.[0];
        recordingId = Number(matchingRow?.id) || null;
      }

      if (options.setAsCurrent && recordingId && selectedDateKeyRef.current === options.recordingDate) {
        setCurrentRecordingId(recordingId);
      }
      if (recordingId) {
        persistLocalRecordingForDate({
          id: recordingId,
          video_url: linkUrl,
          duration_seconds: payload.duration_seconds,
          recording_date: options.recordingDate,
          status: 'ready',
          title: options.title,
          created_at: new Date().toISOString(),
        });
      }
      refreshRecordings?.();
      return recordingId;
    } catch (err) {
      console.error('Failed to save video recording:', err);
      return null;
    }
  };

  const saveVideoRecording = async (blob: Blob, options: SaveVideoRecordingOptions): Promise<number | null> => {
    try {
      const linkUrl = await uploadVideoBlob(blob, getVideoUploadFileName(blob, options.title));
      const localRecording = persistLocalRecordingForDate({
        id: -Date.now(),
        video_url: linkUrl,
        duration_seconds: Math.max(1, Math.round(options.durationSeconds || recordingTime || 1)),
        recording_date: options.recordingDate,
        status: 'ready',
        title: options.title,
        created_at: new Date().toISOString(),
      });
      const recordingId = await insertVideoRecordingUrl(linkUrl, options);
      return recordingId || (localRecording.id > 0 ? localRecording.id : null);
    } catch (err) {
      console.error('Failed to upload video recording:', err);
      return null;
    }
  };

  const getTeleprompterReviewDuration = (): number => (
    Math.max(1, teleprompterRecordingDuration || teleprompterRecordingTime || 1)
  );

  const getTeleprompterClipSegmentsForDuration = (): TeleprompterClipSegment[] => {
    const duration = getTeleprompterReviewDuration();
    const sourceSegments = teleprompterClipSegments.length
      ? teleprompterClipSegments
      : [{ id: 'clip-full', start: teleprompterTrimStart, end: teleprompterTrimEnd || duration }];

    return sourceSegments
      .map(segment => {
        const start = clampNumber(segment.start, 0, Math.max(0, duration - 0.5));
        const end = clampNumber(segment.end || duration, Math.min(duration, start + 0.5), duration);
        return { ...segment, start, end };
      })
      .filter(segment => segment.end - segment.start >= 0.5);
  };

  const getActiveTeleprompterClip = (): TeleprompterClipSegment => {
    const segments = getTeleprompterClipSegmentsForDuration();
    const activeClip = segments.find(segment => segment.id === activeTeleprompterClipId) || segments[0];
    if (activeClip) return activeClip;
    const duration = getTeleprompterReviewDuration();
    return { id: 'clip-full', start: 0, end: duration };
  };

  const getTeleprompterTrimRange = () => {
    const duration = getTeleprompterReviewDuration();
    const activeClip = getActiveTeleprompterClip();
    const start = clampNumber(activeClip.start, 0, Math.max(0, duration - 0.5));
    const end = clampNumber(activeClip.end || duration, Math.min(duration, start + 0.5), duration);
    return { start, end, duration, clipId: activeClip.id };
  };

  const getTeleprompterRenderSegments = (): TeleprompterClipSegment[] => {
    const duration = getTeleprompterReviewDuration();
    const segments = getTeleprompterClipSegmentsForDuration()
      .map(segment => {
        const start = clampNumber(segment.start, 0, Math.max(0, duration - 0.5));
        const end = clampNumber(segment.end, Math.min(duration, start + 0.5), duration);
        return { ...segment, start, end };
      })
      .filter(segment => segment.end - segment.start >= 0.5);

    return segments.length ? segments : [{ id: 'clip-full', start: 0, end: duration }];
  };

  const getTeleprompterEditSourceKey = (): string => (
    teleprompterRecordingUrl || `${teleprompterTitle}:${teleprompterRecordingDuration || teleprompterRecordingTime || 0}`
  );

  const getCurrentTeleprompterEditStorageKey = (): string => (
    getTeleprompterEditStorageKey(currentRecordingId, dateFilter, getTeleprompterEditSourceKey())
  );

  const getCurrentTeleprompterEditSnapshot = (): TeleprompterEditState => (
    normalizeTeleprompterEditState({
      trimStart: teleprompterTrimStart,
      trimEnd: teleprompterTrimEnd,
      clipSegments: copyTeleprompterClipSegments(getTeleprompterClipSegmentsForDuration()),
      activeClipId: activeTeleprompterClipId,
    }, getTeleprompterReviewDuration())
  );

  const applyTeleprompterEditState = (state: TeleprompterEditState, durationOverride?: number) => {
    const duration = durationOverride || getTeleprompterReviewDuration();
    const normalizedState = normalizeTeleprompterEditState(state, duration);
    const activeClip = normalizedState.clipSegments.find(segment => segment.id === normalizedState.activeClipId)
      || normalizedState.clipSegments[0];
    const nextTime = activeClip?.start || 0;
    const video = teleprompterReviewVideoRef.current;

    setTeleprompterClipSegments(copyTeleprompterClipSegments(normalizedState.clipSegments));
    setActiveTeleprompterClipId(normalizedState.activeClipId);
    setTeleprompterTrimStart(normalizedState.trimStart);
    setTeleprompterTrimEnd(normalizedState.trimEnd);
    if (video) {
      video.pause();
      video.currentTime = nextTime;
    }
    setTeleprompterCurrentTime(nextTime);
    setTeleprompterPreviewPlaying(false);
  };

  const pushTeleprompterEditHistory = (
    previousState: TeleprompterEditState,
    nextState?: TeleprompterEditState
  ) => {
    const duration = getTeleprompterReviewDuration();
    const normalizedPrevious = normalizeTeleprompterEditState(previousState, duration);
    const normalizedNext = normalizeTeleprompterEditState(nextState || getCurrentTeleprompterEditSnapshot(), duration);
    if (serializeTeleprompterEditState(normalizedPrevious) === serializeTeleprompterEditState(normalizedNext)) return;

    setTeleprompterEditPast(current => [
      ...current.slice(-39),
      normalizedPrevious,
    ]);
    setTeleprompterEditFuture([]);
  };

  const undoTeleprompterEdit = () => {
    const previousState = teleprompterEditPast[teleprompterEditPast.length - 1];
    if (!previousState) return;
    const currentState = getCurrentTeleprompterEditSnapshot();
    setTeleprompterEditPast(current => current.slice(0, -1));
    setTeleprompterEditFuture(current => [
      currentState,
      ...current.slice(0, 39),
    ]);
    applyTeleprompterEditState(previousState);
  };

  const redoTeleprompterEdit = () => {
    const nextState = teleprompterEditFuture[0];
    if (!nextState) return;
    const currentState = getCurrentTeleprompterEditSnapshot();
    setTeleprompterEditPast(current => [
      ...current.slice(-39),
      currentState,
    ]);
    setTeleprompterEditFuture(current => current.slice(1));
    applyTeleprompterEditState(nextState);
  };

  const restoreSavedTeleprompterEditState = (duration: number): boolean => {
    if (typeof window === 'undefined') return false;
    const raw = window.localStorage.getItem(getCurrentTeleprompterEditStorageKey());
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      const savedDuration = Number(parsed?.duration);
      if (Number.isFinite(savedDuration) && Math.abs(savedDuration - duration) > Math.max(1, duration * 0.08)) {
        return false;
      }
      const normalizedState = normalizeTeleprompterEditState(parsed?.state || parsed, duration);
      applyTeleprompterEditState(normalizedState, duration);
      setTeleprompterEditPast([]);
      setTeleprompterEditFuture([]);
      teleprompterLastSavedEditSnapshotRef.current = serializeTeleprompterEditState(normalizedState);
      setTeleprompterEditSaveState('saved');
      return true;
    } catch (error) {
      console.warn('Could not restore saved video edits:', error);
      return false;
    }
  };

  const hasTeleprompterReviewEdits = (): boolean => {
    const { start, end, duration } = getTeleprompterTrimRange();
    const renderSegments = getTeleprompterRenderSegments();
    return renderSegments.length > 1
      || start > 0.05
      || end < duration - 0.05
      || (!teleprompterCaptionsSuppressedRef.current && teleprompterCcEnabled && Boolean(teleprompterCcText.trim()));
  };

  const handleTeleprompterReviewMetadata = () => {
    const video = teleprompterReviewVideoRef.current;
    const duration = Number.isFinite(video?.duration || 0) && video!.duration > 0
      ? video!.duration
      : Math.max(1, teleprompterRecordingTime || 1);
    setTeleprompterRecordingDuration(duration);

    const restoredSavedEdits = !teleprompterEditStorageReady && restoreSavedTeleprompterEditState(duration);
    if (!restoredSavedEdits) {
      setTeleprompterTrimStart(current => clampNumber(current, 0, Math.max(0, duration - 0.5)));
      setTeleprompterTrimEnd(current => current > 0 ? clampNumber(current, 0.5, duration) : duration);
      setTeleprompterClipSegments(current => {
        if (!current.length) {
          return [createTeleprompterClipSegment(0, duration)];
        }

        return current.map((segment, index) => {
          const start = clampNumber(segment.start, 0, Math.max(0, duration - 0.5));
          const end = current.length === 1 && index === 0 && start <= 0.05
            ? duration
            : clampNumber(segment.end, Math.min(duration, start + 0.5), duration);
          return { ...segment, start, end };
        });
      });
    }
    setTeleprompterCcWords(current => current.length && teleprompterCcText.trim()
      ? buildTimedCaptionWords(teleprompterCcText, duration)
      : current
    );
    setTeleprompterEditStorageReady(true);
  };

  const handleTeleprompterPreviewTimeUpdate = () => {
    const video = teleprompterReviewVideoRef.current;
    if (!video) return;
    const { start, end } = getTeleprompterTrimRange();
    setTeleprompterCurrentTime(video.currentTime);
    if (video.currentTime < start - 0.25) {
      video.currentTime = start;
      setTeleprompterCurrentTime(start);
      return;
    }
    if (video.currentTime >= end) {
      video.pause();
      video.currentTime = start;
      setTeleprompterCurrentTime(start);
      setTeleprompterPreviewPlaying(false);
    }
  };

  const toggleTeleprompterPreviewPlayback = async () => {
    const video = teleprompterReviewVideoRef.current;
    if (!video) return;
    const { start, end } = getTeleprompterTrimRange();
    if (video.paused) {
      if (video.currentTime < start || video.currentTime >= end) {
        video.currentTime = start;
        setTeleprompterCurrentTime(start);
      }
      await video.play();
      setTeleprompterPreviewPlaying(true);
      return;
    }
    video.pause();
    setTeleprompterPreviewPlaying(false);
  };

  const updateTeleprompterTrimStart = (value: number) => {
    const { end, clipId } = getTeleprompterTrimRange();
    const nextStart = clampNumber(value, 0, Math.max(0, end - 0.5));
    const video = teleprompterReviewVideoRef.current;
    setTeleprompterTrimStart(nextStart);
    setTeleprompterClipSegments(current => current.map(segment => (
      segment.id === clipId ? { ...segment, start: nextStart } : segment
    )));
    if (video) {
      video.pause();
      video.currentTime = nextStart;
    }
    setTeleprompterCurrentTime(nextStart);
    setTeleprompterPreviewPlaying(false);
  };

  const updateTeleprompterTrimEnd = (value: number) => {
    const { start, duration, clipId } = getTeleprompterTrimRange();
    const nextEnd = clampNumber(value, Math.min(duration, start + 0.5), duration);
    const video = teleprompterReviewVideoRef.current;
    setTeleprompterTrimEnd(nextEnd);
    setTeleprompterClipSegments(current => current.map(segment => (
      segment.id === clipId ? { ...segment, end: nextEnd } : segment
    )));
    if (video) {
      video.pause();
      if (video.currentTime < start || video.currentTime >= nextEnd) {
        video.currentTime = start;
        setTeleprompterCurrentTime(start);
      }
    }
    setTeleprompterPreviewPlaying(false);
  };

  const seekTeleprompterPreviewTo = (value: number) => {
    const duration = getTeleprompterReviewDuration();
    const segments = getTeleprompterClipSegmentsForDuration();
    const targetClip = segments.find(segment => value >= segment.start && value <= segment.end)
      || getActiveTeleprompterClip();
    const start = targetClip.start;
    const end = targetClip.end;
    const nextTime = clampNumber(value, start, Math.max(start, end - 0.02));
    const video = teleprompterReviewVideoRef.current;
    setActiveTeleprompterClipId(targetClip.id);
    setTeleprompterTrimStart(start);
    setTeleprompterTrimEnd(end);
    if (video) {
      video.pause();
      video.currentTime = clampNumber(nextTime, 0, duration);
    }
    setTeleprompterCurrentTime(clampNumber(nextTime, 0, duration));
    setTeleprompterPreviewPlaying(false);
  };

  const getTeleprompterTimelineValue = (clientX: number, mode: 'start' | 'end' | 'playhead' = 'playhead'): number => {
    const track = teleprompterTimelineRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const percent = rect.width > 0 ? clampNumber((clientX - rect.left) / rect.width, 0, 1) : 0;
    const segments = getTeleprompterClipSegmentsForDuration();
    const timelineDuration = Math.max(
      0.5,
      segments.reduce((total, segment) => total + Math.max(0, segment.end - segment.start), 0)
    );
    const editedTimelineTime = percent * timelineDuration;

    if (mode === 'start' || mode === 'end') {
      const activeClip = getActiveTeleprompterClip();
      const activeStartOnTimeline = getEditedTimelineTimeFromOriginalTime(activeClip.start, segments);
      const activeEndOnTimeline = activeStartOnTimeline + Math.max(0.5, activeClip.end - activeClip.start);
      const clampedTimelineTime = clampNumber(editedTimelineTime, activeStartOnTimeline, activeEndOnTimeline);
      return activeClip.start + (clampedTimelineTime - activeStartOnTimeline);
    }

    return getOriginalTimeFromEditedTimelineTime(editedTimelineTime, segments);
  };

  const handleTeleprompterTimelineSeek = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-timeline-control="true"]')) return;
    seekTeleprompterPreviewTo(getTeleprompterTimelineValue(event.clientX));
  };

  const startTeleprompterTimelineDrag = (mode: 'start' | 'end' | 'playhead') => (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const previousState = mode === 'playhead' ? null : getCurrentTeleprompterEditSnapshot();

    const updateFromPointer = (clientX: number) => {
      const value = getTeleprompterTimelineValue(clientX, mode);
      if (mode === 'start') {
        updateTeleprompterTrimStart(value);
        return;
      }
      if (mode === 'end') {
        updateTeleprompterTrimEnd(value);
        return;
      }
      seekTeleprompterPreviewTo(value);
    };

    updateFromPointer(event.clientX);
    const onMove = (moveEvent: PointerEvent) => updateFromPointer(moveEvent.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (previousState) {
        window.setTimeout(() => pushTeleprompterEditHistory(previousState), 0);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const addTeleprompterSplitAtPlayhead = () => {
    const previousState = getCurrentTeleprompterEditSnapshot();
    const { duration, clipId } = getTeleprompterTrimRange();
    const segments = getTeleprompterClipSegmentsForDuration();
    const activeIndex = Math.max(0, segments.findIndex(segment => segment.id === clipId));
    const activeClip = segments[activeIndex] || segments[0] || createTeleprompterClipSegment(0, duration);
    const splitPoint = clampNumber(
      teleprompterCurrentTime,
      activeClip.start + 0.5,
      Math.max(activeClip.start + 0.5, activeClip.end - 0.5)
    );

    if (splitPoint - activeClip.start < 0.5 || activeClip.end - splitPoint < 0.5) return;

    const firstClip = { ...activeClip, end: splitPoint };
    const secondClip = createTeleprompterClipSegment(splitPoint, activeClip.end);
    const nextSegments = [
      ...segments.slice(0, activeIndex),
      firstClip,
      secondClip,
      ...segments.slice(activeIndex + 1),
    ];
    const nextState = normalizeTeleprompterEditState({
      trimStart: secondClip.start,
      trimEnd: secondClip.end,
      clipSegments: nextSegments,
      activeClipId: secondClip.id,
    }, duration);

    pushTeleprompterEditHistory(previousState, nextState);
    setTeleprompterClipSegments(nextSegments);
    setActiveTeleprompterClipId(secondClip.id);
    setTeleprompterTrimStart(secondClip.start);
    setTeleprompterTrimEnd(secondClip.end);
    const video = teleprompterReviewVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = secondClip.start;
    }
    setTeleprompterCurrentTime(secondClip.start);
    setTeleprompterPreviewPlaying(false);
  };

  const selectTeleprompterClipSegment = (clipId: string) => {
    const duration = getTeleprompterReviewDuration();
    const clip = getTeleprompterClipSegmentsForDuration().find(segment => segment.id === clipId);
    if (!clip) return;
    const start = clampNumber(clip.start, 0, Math.max(0, duration - 0.5));
    const end = clampNumber(clip.end, Math.min(duration, start + 0.5), duration);
    const video = teleprompterReviewVideoRef.current;
    setActiveTeleprompterClipId(clip.id);
    setTeleprompterTrimStart(start);
    setTeleprompterTrimEnd(end);
    if (video) {
      video.pause();
      video.currentTime = start;
    }
    setTeleprompterCurrentTime(start);
    setTeleprompterPreviewPlaying(false);
  };

  const handleTeleprompterCcTextChange = (text: string) => {
    teleprompterCaptionsSuppressedRef.current = !text.trim();
    setTeleprompterCcText(text);
    setTeleprompterCcWords(buildTimedCaptionWords(text, getTeleprompterReviewDuration()));
    setTeleprompterCcEnabled(Boolean(text.trim()));
    setTeleprompterCcError('');
  };

  const extractAudioForTranscription = async (sourceBlob: Blob): Promise<Blob> => {
    if (sourceBlob.type.startsWith('audio/')) return sourceBlob;

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioMimeType = getSupportedAudioRecordingMimeType();
    if (!AudioContextCtor || !audioMimeType) {
      throw new Error('This browser cannot prepare audio for captions. Try Chrome or Edge.');
    }

    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(sourceBlob);
    video.src = objectUrl;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.muted = false;
    video.volume = 1;

    let audioContext: AudioContext | null = null;

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Could not load the video audio for captions.'));
      });

      audioContext = new AudioContextCtor();
      await audioContext.resume();
      const sourceNode = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      sourceNode.connect(destination);

      const recorder = new MediaRecorder(destination.stream, { mimeType: audioMimeType });
      const chunks: Blob[] = [];
      const durationMs = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(Math.max(video.duration * 1000 + 1500, 3000), 180000)
        : 60000;

      const finished = new Promise<Blob>((resolve, reject) => {
        let timeoutId: number | null = null;
        const stopRecorder = () => {
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          if (recorder.state !== 'inactive') recorder.stop();
        };

        recorder.ondataavailable = event => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          reject(new Error('Could not extract audio for captions.'));
        };
        recorder.onstop = () => {
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          const audioBlob = new Blob(chunks, { type: audioMimeType });
          if (!audioBlob.size) {
            reject(new Error('No audio was found in this video.'));
            return;
          }
          resolve(audioBlob);
        };
        video.onended = stopRecorder;
        timeoutId = window.setTimeout(stopRecorder, durationMs);
      });

      recorder.start(250);
      video.currentTime = 0;
      try {
        await video.play();
      } catch (playError) {
        video.muted = true;
        await video.play();
      }
      return await finished;
    } finally {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      audioContext?.close().catch(() => {});
    }
  };

  const transcribeVideoForCaptions = async (sourceBlob: Blob): Promise<{ text: string; cues: TimedCaptionWord[] }> => {
    const formData = new FormData();
    formData.append('file', sourceBlob, getVideoUploadFileName(sourceBlob, 'caption-source'));
    formData.append('prompt', [
      'Create accurate closed captions for this video.',
      'Return ONLY valid JSON in this exact shape:',
      '{"transcript":"full transcript in order","captions":[{"start":0.0,"end":1.5,"text":"caption phrase"}]}',
      'Use seconds for start and end. Each caption phrase should be 2-7 words, match the spoken words exactly, and be timed to when the phrase is heard.',
      'Do not include markdown, summaries, speaker labels, or commentary.',
      'If no speech is audible, return {"transcript":"","captions":[]}.',
    ].join(' '));

    const response = await fetch('/api/generate/video-analysis', {
      method: 'POST',
      body: formData,
    });
    const data = await readApiResponse(response);
    if (!response.ok || data.success === false) {
      throw new Error(getApiErrorMessage(data, 'Could not generate captions from the video.'));
    }

    const rawResult = String(data.result || data.text || '');
    const parsed = extractJsonObject(rawResult);
    const duration = getTeleprompterReviewDuration();
    const parsedCues = Array.isArray(parsed?.captions)
      ? normalizeTimedCaptionCues(parsed.captions, duration)
      : [];
    const hasUsableCueTiming = parsedCues.length <= 1
      || parsedCues.some((cue, index) => index > 0 && cue.start > parsedCues[index - 1].start + 0.05);
    const cueText = normalizeCaptionTranscriptResult(parsedCues.map(cue => cue.text).join(' '));
    const transcriptText = normalizeCaptionTranscriptResult(String(parsed?.transcript || ''));
    const text = transcriptText || cueText || normalizeCaptionTranscriptResult(rawResult);
    const cues = parsedCues.length
      && hasUsableCueTiming
      && hasUsableCaptionCueCoverage(parsedCues, text)
      ? parsedCues
      : buildTimedCaptionWords(text, duration);
    return { text, cues };
  };

  const transcribeFullVideoForCaptions = async (sourceBlob: Blob): Promise<{ text: string; cues: TimedCaptionWord[] }> => {
    const formData = new FormData();
    formData.append('file', sourceBlob, getVideoUploadFileName(sourceBlob, 'caption-source'));
    formData.append('prompt', [
      'Transcribe ALL spoken words in this video from beginning to end.',
      'Do not summarize. Do not stop after the first phrase.',
      'Include the complete transcript in chronological order.',
      'Return only the transcript text with normal punctuation.',
      'Do not include markdown, timestamps, speaker labels, or commentary.',
      'If no speech is audible, return an empty string.',
    ].join(' '));

    const response = await fetch('/api/generate/video-analysis', {
      method: 'POST',
      body: formData,
    });
    const data = await readApiResponse(response);
    if (!response.ok || data.success === false) {
      throw new Error(getApiErrorMessage(data, 'Could not transcribe the full video.'));
    }

    const duration = getTeleprompterReviewDuration();
    const text = normalizeCaptionTranscriptResult(String(data.result || data.text || ''));
    return { text, cues: buildTimedCaptionWords(text, duration) };
  };

  const transcribeSourceBlobForCaptions = async (sourceBlob: Blob): Promise<{ text: string; cues: TimedCaptionWord[] }> => {
    const formData = new FormData();
    formData.append('audio', sourceBlob, getVideoUploadFileName(sourceBlob, 'recording'));

    const response = await fetch('/api/generate/transcribe', {
      method: 'POST',
      body: formData,
    });
    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Could not transcribe the recorded video.'));
    }

    const duration = getTeleprompterReviewDuration();
    const text = normalizeCaptionTranscriptResult(String(data.text || data.transcript || data.result || ''));
    return {
      text,
      cues: getCaptionCuesFromTranscriptionData(data, text, duration),
    };
  };

  const transcribeAudioForCaptions = async (sourceBlob: Blob): Promise<{ text: string; cues: TimedCaptionWord[] }> => {
    const audioBlob = await extractAudioForTranscription(sourceBlob);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch('/api/generate/transcribe', {
      method: 'POST',
      body: formData,
    });
    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Could not generate captions.'));
    }

    const duration = getTeleprompterReviewDuration();
    const text = normalizeCaptionTranscriptResult(String(data.text || data.transcript || data.result || ''));
    return {
      text,
      cues: getCaptionCuesFromTranscriptionData(data, text, duration),
    };
  };

  const cancelTeleprompterCaptions = (message = '') => {
    teleprompterCaptionRequestRef.current += 1;
    teleprompterCaptionsSuppressedRef.current = true;
    setIsGeneratingTeleprompterCc(false);
    setTeleprompterCcEnabled(false);
    setTeleprompterCcText('');
    setTeleprompterCcWords([]);
    setTeleprompterCcError(message);
  };

  const generateTeleprompterAutoCaptions = async (blob: Blob) => {
    const requestId = teleprompterCaptionRequestRef.current + 1;
    teleprompterCaptionRequestRef.current = requestId;
    setIsGeneratingTeleprompterCc(true);
    setTeleprompterCcError('');

    try {
      const duration = getTeleprompterReviewDuration();
      let text = '';
      let cues: TimedCaptionWord[] = [];

      try {
        const result = await transcribeAudioForCaptions(blob);
        if (teleprompterCaptionRequestRef.current !== requestId) return;
        if (isUsableCaptionTranscript(result.text, duration)) {
          text = result.text;
        } else {
          console.warn('Auto captions audio transcription returned no usable speech:', result.text);
        }
      } catch (audioAttemptError) {
        console.warn('Auto captions audio transcription failed:', audioAttemptError);
        if (teleprompterCaptionRequestRef.current !== requestId) return;
        try {
          const result = await transcribeSourceBlobForCaptions(blob);
          if (teleprompterCaptionRequestRef.current !== requestId) return;
          if (isUsableCaptionTranscript(result.text, duration)) {
            text = result.text;
          } else {
            console.warn('Auto captions recorded video transcription returned no usable speech:', result.text);
          }
        } catch (sourceAttemptError) {
          console.warn('Auto captions recorded video transcription failed:', sourceAttemptError);
        }
      }

      if (teleprompterCaptionRequestRef.current !== requestId) return;
      if (!text) {
        teleprompterCaptionsSuppressedRef.current = true;
        setTeleprompterCcEnabled(false);
        setTeleprompterCcText('');
        setTeleprompterCcWords([]);
        setTeleprompterCcError('No speech was detected for captions.');
        return;
      }
      teleprompterCaptionsSuppressedRef.current = false;
      cues = buildTimedCaptionWords(text, duration);
      setTeleprompterCcText(text);
      setTeleprompterCcWords(cues);
      setTeleprompterCcEnabled(true);
      setTeleprompterEditorTool('captions');
    } catch (err: any) {
      if (teleprompterCaptionRequestRef.current !== requestId) return;
      console.warn('Auto captions failed:', err);
      teleprompterCaptionsSuppressedRef.current = true;
      setTeleprompterCcEnabled(false);
      setTeleprompterCcWords([]);
      setTeleprompterCcError(err.message || 'Could not generate captions.');
    } finally {
      if (teleprompterCaptionRequestRef.current === requestId) {
        setIsGeneratingTeleprompterCc(false);
      }
    }
  };

  useEffect(() => {
    if (!teleprompterRecordingBlob || !teleprompterRecordingUrl) return;
    void generateTeleprompterAutoCaptions(teleprompterRecordingBlob);
  }, [teleprompterRecordingBlob, teleprompterRecordingUrl]);

  useEffect(() => {
    if (!teleprompterRecordingUrl) return;

    const requestId = teleprompterTimelineFrameRequestRef.current + 1;
    teleprompterTimelineFrameRequestRef.current = requestId;
    const duration = getTeleprompterReviewDuration();
    generateTimelineFrameImages(teleprompterRecordingUrl, duration)
      .then(frames => {
        if (teleprompterTimelineFrameRequestRef.current === requestId) {
          setTeleprompterTimelineFrames(frames);
        }
      })
      .catch(error => {
        console.warn('Timeline frame generation failed:', error);
        if (teleprompterTimelineFrameRequestRef.current === requestId) {
          setTeleprompterTimelineFrames([]);
        }
      });
  }, [teleprompterRecordingUrl, teleprompterRecordingDuration]);

  const renderEditedTeleprompterRecording = async (): Promise<Blob> => {
    if (!teleprompterRecordingBlob || !teleprompterRecordingUrl) {
      throw new Error('Record a video before publishing.');
    }
    if (!hasTeleprompterReviewEdits()) {
      return teleprompterRecordingBlob;
    }
    if (teleprompterEditedBlob) {
      return teleprompterEditedBlob;
    }
    if (!HTMLCanvasElement.prototype.captureStream) {
      throw new Error('This browser cannot render video edits. Download the original recording or try a Chromium-based browser.');
    }

    setIsRenderingTeleprompterEdit(true);
    setMetaError('');

    try {
      const requestedSegments = getTeleprompterRenderSegments();
      const captionText = !teleprompterCaptionsSuppressedRef.current && teleprompterCcEnabled
        ? teleprompterCcText.trim()
        : '';
      const sourceVideo = document.createElement('video');
      sourceVideo.src = teleprompterRecordingUrl;
      sourceVideo.playsInline = true;
      sourceVideo.preload = 'auto';

      await new Promise<void>((resolve, reject) => {
        sourceVideo.onloadedmetadata = () => resolve();
        sourceVideo.onerror = () => reject(new Error('Could not load the recorded video for editing.'));
      });

      const sourceDuration = Number.isFinite(sourceVideo.duration) && sourceVideo.duration > 0
        ? sourceVideo.duration
        : getTeleprompterReviewDuration();
      const renderSegments = requestedSegments
        .map(segment => {
          const start = clampNumber(segment.start, 0, Math.max(0, sourceDuration - 0.5));
          const end = clampNumber(segment.end, Math.min(sourceDuration, start + 0.5), sourceDuration);
          return { ...segment, start, end };
        })
        .filter(segment => segment.end - segment.start >= 0.5);
      if (!renderSegments.length) throw new Error('No clip segments are available to render.');
      const captionWords = captionText
        ? buildTimedCaptionWords(captionText, sourceDuration)
        : [];

      const sourceWidth = sourceVideo.videoWidth || 720;
      const sourceHeight = sourceVideo.videoHeight || 1280;
      const scale = Math.min(1, 720 / sourceWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.round(sourceWidth * scale));
      canvas.height = Math.max(2, Math.round(sourceHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the video editor.');

      const canvasStream = canvas.captureStream(30);
      const audioTracks: MediaStreamTrack[] = [];
      let audioContext: AudioContext | null = null;

      try {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextCtor) {
          audioContext = new AudioContextCtor();
          await audioContext.resume();
          const sourceNode = audioContext.createMediaElementSource(sourceVideo);
          const destination = audioContext.createMediaStreamDestination();
          sourceNode.connect(destination);
          audioTracks.push(...destination.stream.getAudioTracks());
        }
      } catch (error) {
        console.warn('Could not capture edited-video audio with Web Audio:', error);
      }

      if (audioTracks.length === 0) {
        try {
          const captureStream = (sourceVideo as any).captureStream?.() || (sourceVideo as any).mozCaptureStream?.();
          if (captureStream) {
            audioTracks.push(...captureStream.getAudioTracks());
          }
        } catch (error) {
          console.warn('Could not capture edited-video audio from video stream:', error);
        }
      }

      const outputStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);
      const mimeType = getSupportedRecordingMimeType() || 'video/webm';
      const recorder = new MediaRecorder(outputStream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const stopped = new Promise<Blob>((resolve, reject) => {
        recorder.onerror = () => reject(new Error('Video edit rendering failed.'));
        recorder.onstop = () => {
          outputStream.getTracks().forEach(track => track.stop());
          audioContext?.close().catch(() => {});
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      const seekSourceVideoTo = (time: number) => new Promise<void>((resolve, reject) => {
        let settled = false;
        let timeoutId: number | null = null;
        const settle = () => {
          if (settled) return;
          settled = true;
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          sourceVideo.onseeked = null;
          sourceVideo.onerror = null;
          resolve();
        };

        sourceVideo.onseeked = settle;
        sourceVideo.onerror = () => reject(new Error('Could not seek to the selected clip.'));
        timeoutId = window.setTimeout(settle, 750);
        sourceVideo.currentTime = time;
        if (Math.abs(sourceVideo.currentTime - time) < 0.05) {
          window.requestAnimationFrame(settle);
        }
      });

      await seekSourceVideoTo(renderSegments[0].start);
      let activeRenderSegmentIndex = 0;

      const drawFrame = () => {
        const activeRenderSegment = renderSegments[activeRenderSegmentIndex];
        context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);

        const activeCaptionText = captionText
          ? getActiveCaptionTextAtTime(sourceVideo.currentTime, captionWords, captionText)
          : '';

        if (activeCaptionText) {
          const fontSize = Math.max(24, Math.round(canvas.width * 0.055));
          const lineHeight = Math.round(fontSize * 1.22);
          context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          const lines = wrapCanvasText(context, activeCaptionText, canvas.width - 72);
          const boxHeight = Math.max(lineHeight + 24, (lines.length * lineHeight) + 24);
          const boxWidth = canvas.width - 44;
          const boxX = 22;
          const boxY = canvas.height - boxHeight - Math.max(34, Math.round(canvas.height * 0.07));
          context.fillStyle = 'rgba(0,0,0,0.68)';
          drawRoundedRect(context, boxX, boxY, boxWidth, boxHeight, 18);
          context.fillStyle = '#fff';
          lines.forEach((line, index) => {
            const y = boxY + 12 + (lineHeight / 2) + (index * lineHeight);
            context.fillText(line, canvas.width / 2, y);
          });
        }

        if (sourceVideo.currentTime >= activeRenderSegment.end || sourceVideo.ended) {
          activeRenderSegmentIndex += 1;
          if (activeRenderSegmentIndex < renderSegments.length) {
            const nextSegment = renderSegments[activeRenderSegmentIndex];
            sourceVideo.pause();
            seekSourceVideoTo(nextSegment.start)
              .then(() => sourceVideo.play())
              .then(() => requestAnimationFrame(drawFrame))
              .catch(error => {
                console.warn('Could not continue rendering split clip:', error);
                if (recorder.state !== 'inactive') recorder.stop();
              });
            return;
          }
          sourceVideo.pause();
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        requestAnimationFrame(drawFrame);
      };

      recorder.start(250);
      await sourceVideo.play();
      drawFrame();
      const editedBlob = await stopped;
      if (editedBlob.size === 0) throw new Error('Video edit rendered an empty file.');

      if (teleprompterEditedUrl) URL.revokeObjectURL(teleprompterEditedUrl);
      setTeleprompterEditedBlob(editedBlob);
      setTeleprompterEditedUrl(URL.createObjectURL(editedBlob));
      return editedBlob;
    } finally {
      setIsRenderingTeleprompterEdit(false);
    }
  };

  const downloadTeleprompterReviewVideo = async () => {
    try {
      const blob = await renderEditedTeleprompterRecording();
      const url = hasTeleprompterReviewEdits()
        ? URL.createObjectURL(blob)
        : teleprompterRecordingUrl;
      if (!url) return;
      const extension = getVideoExtension(blob.type || teleprompterRecordingMimeType);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${teleprompterTitle.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'self-tape'}${hasTeleprompterReviewEdits() ? '-edited' : ''}.${extension}`;
      link.click();
      if (hasTeleprompterReviewEdits()) {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err: any) {
      setMetaError(err.message || 'Could not prepare the video download.');
    }
  };

  const uploadTeleprompterRecording = async (): Promise<string> => {
    if (!teleprompterRecordingBlob) {
      throw new Error('Record a video before publishing.');
    }

    const finalBlob = await renderEditedTeleprompterRecording();
    const editedSuffix = hasTeleprompterReviewEdits() ? '-edited' : '';
    return uploadVideoBlob(finalBlob, `self-tape${editedSuffix}.${getVideoExtension(finalBlob.type || teleprompterRecordingMimeType)}`);
  };

  const ensureInstagramSchedulerHook = async () => {
    const workspaceId = getWorkspaceId();
    const headers = getWorkspaceRequestHeaders();
    const hookCode = getInstagramPublishHookCode();
    const hooksResponse = await fetch(`/api/workspaces/${workspaceId}/hooks`, {
      credentials: 'include',
      headers,
    });
    const hooksData = await readApiResponse(hooksResponse);
    if (!hooksResponse.ok) {
      throw new Error(getApiErrorMessage(hooksData, 'Could not prepare the Instagram scheduler hook.'));
    }

    const hooks = Array.isArray(hooksData) ? hooksData : Array.isArray(hooksData.hooks) ? hooksData.hooks : [];
    const existingHook = hooks.find((hook: any) => hook?.name === INSTAGRAM_SCHEDULE_HOOK_NAME);
    const payload = {
      name: INSTAGRAM_SCHEDULE_HOOK_NAME,
      description: 'Publishes scheduled Raw-to-Post Instagram reels.',
      code: hookCode,
      language: 'javascript',
      enabled: true,
      metadata: { timeout: 300000 },
    };

    const response = await fetch(
      existingHook?.id
        ? `/api/workspaces/${workspaceId}/hooks/${existingHook.id}`
        : `/api/workspaces/${workspaceId}/hooks`,
      {
        method: existingHook?.id ? 'PATCH' : 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      }
    );
    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data, 'Could not save the Instagram scheduler hook.'));
    }
  };

  const createInstagramPublishSchedule = async (input: {
    scheduledAt: string;
    videoUrl: string;
    caption: string;
  }): Promise<{ id?: string }> => {
    const workspaceId = getWorkspaceId();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const payload = {
      destination: 'instagram_reel',
      videoUrl: input.videoUrl,
      caption: input.caption,
      workspaceDbToken: window.__workspaceDb?.token || '',
    };
    const response = await fetch(`/api/workspaces/${workspaceId}/schedules`, {
      method: 'POST',
      credentials: 'include',
      headers: getWorkspaceRequestHeaders(),
      body: JSON.stringify({
        name: 'Publish Raw-to-Post Instagram reel',
        description: `Publish this Raw-to-Post reel at ${new Date(input.scheduledAt).toLocaleString()}.`,
        scheduledAt: input.scheduledAt,
        scheduleType: 'one_time',
        timezone,
        actionType: 'hook',
        actionPayload: {
          hookName: INSTAGRAM_SCHEDULE_HOOK_NAME,
          payload,
        },
      }),
    });
    const data = await readApiResponse(response);
    if (!response.ok || data.success === false) {
      throw new Error(getApiErrorMessage(data, 'Could not schedule the Instagram post.'));
    }
    return {
      id: String(data.schedule?.id || data.task?.id || data.id || ''),
    };
  };

  const openInstagramScheduleDialog = () => {
    setScheduledDateTime(current => current || getDefaultScheduleDateTimeValue());
    setInstagramScheduleStatus('');
    setMetaError('');
    setShowScheduleDialog(true);
  };

  const scheduleTeleprompterVideoToInstagram = async () => {
    if (!teleprompterRecordingBlob) {
      setMetaError('Record a video before scheduling.');
      return;
    }
    if (isGeneratingTeleprompterCc) {
      cancelTeleprompterCaptions();
    }

    const scheduledAt = scheduledDateTime ? new Date(scheduledDateTime) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      setMetaError('Pick a valid date and time.');
      return;
    }
    if (scheduledAt.getTime() <= Date.now() + 60 * 1000) {
      setMetaError('Pick a future time at least one minute from now.');
      return;
    }

    const hashtags = normalizeHashtags(instagramHashtags);
    const caption = [instagramCaption.trim(), hashtags].filter(Boolean).join('\n\n');
    if (!caption.trim()) {
      setMetaError('Add a caption and a few hashtags before scheduling.');
      return;
    }

    setIsSchedulingInstagram(true);
    setMetaError('');
    setInstagramScheduleStatus('');

    try {
      const connected = metaConnected || await refreshInstagramConnection();
      if (!connected) {
        await startMetaSignIn();
        const connectedAfterSignIn = await refreshInstagramConnection();
        if (!connectedAfterSignIn) {
          throw new Error('Connect Instagram before scheduling this post.');
        }
      }

      const videoLink = await uploadTeleprompterRecording();
      await ensureInstagramSchedulerHook();
      const schedule = await createInstagramPublishSchedule({
        scheduledAt: scheduledAt.toISOString(),
        videoUrl: videoLink,
        caption,
      });

      syncScheduledInstagramToContentCalendar({
        scheduledAt: scheduledAt.toISOString(),
        scheduleId: schedule.id,
        caption,
        videoTitle: teleprompterTitle || 'Scheduled Instagram reel',
      });
      setInstagramScheduleStatus(`Scheduled for ${scheduledAt.toLocaleString()}.`);
      setShowScheduleDialog(false);
    } catch (err: any) {
      console.error('Instagram scheduling failed:', err);
      setMetaError(err.message || 'Could not schedule the Instagram post.');
    } finally {
      setIsSchedulingInstagram(false);
    }
  };

  const publishTeleprompterVideoToInstagram = async () => {
    if (!metaConnected) {
      await startMetaSignIn();
      return;
    }
    if (!teleprompterRecordingBlob) {
      setMetaError('Record a video before publishing.');
      return;
    }
    if (isGeneratingTeleprompterCc) {
      cancelTeleprompterCaptions();
    }

    const hashtags = normalizeHashtags(instagramHashtags);
    const caption = [instagramCaption.trim(), hashtags].filter(Boolean).join('\n\n');
    if (!caption.trim()) {
      setMetaError('Add a caption and a few hashtags before publishing.');
      return;
    }

    setIsPublishingInstagram(true);
    setMetaError('');
    setInstagramPublishSuccess(false);
    setInstagramPostId('');

    try {
      const { base, headers } = getMarketingContext();
      const linkUrl = await uploadTeleprompterRecording();
      const payload = {
        destination: 'instagram_reel',
        videoUrl: linkUrl,
        caption,
      };

      const response = await fetch(`${base}/posts/video`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await readApiResponse(response);
      if (!response.ok || data.success === false) {
        if (data.error === 'INSTAGRAM_NOT_CONNECTED') {
          setMetaConnected(false);
          throw new Error('Connect Instagram in this app, then try again.');
        }
        throw new Error(getApiErrorMessage(data, 'Could not publish to Instagram.'));
      }

      setInstagramPostId(String(data.mediaId || data.postId || data.id || ''));
      setInstagramPublishSuccess(true);
      setMetaConnected(true);
    } catch (err: any) {
      console.error('Instagram publish failed:', err);
      setMetaError(err.message || 'Could not publish to Instagram.');
    } finally {
      setIsPublishingInstagram(false);
    }
  };

  const renderCarouselImages = async (): Promise<string[]> => {
    const normalizedDraft = normalizeEditableCarouselDraft({
      title: carouselDraftTitle,
      slides: carouselSlides,
      caption: carouselCaption,
      theme: carouselTheme,
    });
    if (!normalizedDraft.slides.length) {
      throw new Error('Generate or add at least one carousel slide first.');
    }

    await ensureCarouselFontLoaded(normalizedDraft.theme!);

    const images: string[] = [];
    for (let index = 0; index < normalizedDraft.slides.length; index += 1) {
      const canvas = renderCarouselSlideCanvas(
        normalizedDraft.slides[index],
        index,
        normalizedDraft.slides.length,
        normalizedDraft.title,
        normalizedDraft.theme!
      );
      images.push(await canvasToDataUrl(canvas));
    }
    return images;
  };

  const persistCarouselDeck = async (): Promise<string> => {
    const deckId = getCarouselDeckId(dateFilter, currentRecordingId);
    const workspaceId = getWorkspaceId();
    const code = buildCarouselDeckCode(carouselDraftTitle, carouselSlides, carouselTheme);
    const response = await fetch(`/api/slides/${workspaceId}/${deckId}`, {
      method: 'POST',
      credentials: 'include',
      headers: getWorkspaceRequestHeaders(),
      body: JSON.stringify({ code }),
    });
    const data = await readApiResponse(response);
    if (!response.ok || data.success === false) {
      throw new Error(getApiErrorMessage(data, 'Could not save the carousel deck.'));
    }
    return deckId;
  };

  const generateCarouselWithSlidesApi = async () => {
    const sourceCarousel = videoAnalysis?.carousel;
    const founderGuidance = carouselBrandGuidance.trim();
    const prompt = [
      'Create an Instagram carousel from this Raw-to-Post idea. Optimize it for social performance: the first slide must be a concise scroll-stopping hook, every slide must advance one distinct idea without repeating the previous slide, and the final slide must end with a question, call to action, or crisp concluding claim.',
      RAW_TO_POST_STYLE_RULES,
      RAW_TO_POST_REFERENCE_EXAMPLES,
      founderGuidance ? `Founder brand guidelines/customization request:\n${founderGuidance}` : '',
      founderGuidance ? 'Apply the founder guidance to the voice, slide structure, examples, terminology, CTA, and level of specificity. Keep each slide concise enough for an editable Instagram carousel.' : '',
      sourceCarousel?.title || carouselDraftTitle || videoAnalysis?.summary || 'Founder update carousel',
      sourceCarousel ? formatCarousel(sourceCarousel) : getCarouselDraftText(carouselDraftTitle, carouselSlides),
      videoAnalysis?.summary ? `Source video summary: ${videoAnalysis.summary}` : '',
    ].filter(Boolean).join('\n\n');

    if (!prompt.trim()) {
      setCarouselError('Upload a video or write a carousel idea first.');
      return;
    }

    setIsGeneratingCarousel(true);
    setCarouselError('');
    setCarouselPublishSuccess(false);
    setCarouselPublishStatus('');

    try {
      const response = await fetch('/api/posts/generate-react-slides', {
        method: 'POST',
        credentials: 'include',
        headers: getWorkspaceRequestHeaders(),
        body: JSON.stringify({
          workspaceId: getWorkspaceId(),
          prompt,
          numberOfSlides: Math.max(4, Math.min(8, carouselSlides.length || sourceCarousel?.slides.length || 5)),
        }),
      });
      const data = await readApiResponse(response);
      if (!response.ok || !Array.isArray(data.slides)) {
        throw new Error(getApiErrorMessage(data, 'Could not generate the carousel slides.'));
      }

      const generatedDraft = carouselDraftFromReactSlides(
        sourceCarousel?.title || carouselDraftTitle || 'Instagram carousel',
        data.slides
      );
      if (!generatedDraft) {
        throw new Error('The slide generator returned no editable slides.');
      }

      const caption = getCarouselCaptionFromDraft(generatedDraft.title, generatedDraft.slides);
      const nextTheme = carouselTheme;
      setCarouselDraftTitle(generatedDraft.title);
      setCarouselSlides(generatedDraft.slides);
      setCarouselCaption(caption);
      setCarouselTheme(nextTheme);
      setCarouselActiveSlide(0);
      setFormat('instagram-carousel');
      window.localStorage.setItem(getSelectedFormatStorageKey(dateFilter), 'instagram-carousel');
      await saveCarouselDraft(generatedDraft.title, generatedDraft.slides, caption, undefined, undefined, nextTheme);
    } catch (err: any) {
      console.error('Carousel generation failed:', err);
      setCarouselError(err.message || 'Could not generate the carousel slides.');
    } finally {
      setIsGeneratingCarousel(false);
    }
  };

  const downloadCarouselImages = async () => {
    setCarouselError('');
    try {
      const images = await renderCarouselImages();
      images.forEach((image, index) => {
        const link = document.createElement('a');
        link.href = image;
        link.download = `${(carouselDraftTitle || 'carousel').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-slide-${index + 1}.png`;
        link.click();
      });
    } catch (err: any) {
      setCarouselError(err.message || 'Could not export the carousel images.');
    }
  };

  const publishCarouselToInstagram = async () => {
    if (!metaConnected) {
      await startMetaSignIn();
      return;
    }
    if (!carouselSlides.length) {
      setCarouselError('Generate or add at least one carousel slide before publishing.');
      return;
    }

    const hashtags = normalizeHashtags(instagramHashtags);
    const caption = [carouselCaption.trim(), hashtags].filter(Boolean).join('\n\n');
    if (!caption.trim()) {
      setCarouselError('Add a caption and a few hashtags before publishing.');
      return;
    }

    setIsPublishingCarousel(true);
    setCarouselError('');
    setMetaError('');
    setCarouselPublishSuccess(false);
    setCarouselPublishStatus('Rendering carousel images...');

    try {
      const connected = metaConnected || await refreshInstagramConnection();
      if (!connected) {
        await startMetaSignIn();
        const connectedAfterSignIn = await refreshInstagramConnection();
        if (!connectedAfterSignIn) {
          throw new Error('Connect Instagram before publishing this carousel.');
        }
      }

      const images = await renderCarouselImages();
      let deckId = getCarouselDeckId(dateFilter, currentRecordingId);
      try {
        deckId = await persistCarouselDeck();
      } catch (deckError) {
        console.warn('Could not persist carousel deck before publishing:', deckError);
      }

      setCarouselPublishStatus('Posting carousel to Instagram...');
      const response = await fetch(`/api/slides/${getWorkspaceId()}/${deckId}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: getWorkspaceRequestHeaders(),
        body: JSON.stringify({
          destination: 'instagram_feed',
          caption,
          images,
        }),
      });
      const data = await readApiResponse(response);
      if (!response.ok || data.success === false) {
        if (data.error === 'INSTAGRAM_NOT_CONNECTED' || data.code === 'INSTAGRAM_NOT_CONNECTED') {
          setMetaConnected(false);
          throw new Error('Connect Instagram in this app, then try again.');
        }
        throw new Error(getApiErrorMessage(data, 'Could not publish the carousel to Instagram.'));
      }

      await saveCarouselDraft(carouselDraftTitle, carouselSlides, carouselCaption);
      setCarouselPublishSuccess(true);
      setCarouselPublishStatus('Posted to Instagram.');
      setInstagramPostId(String(data.mediaId || data.postId || data.id || ''));
      setMetaConnected(true);
    } catch (err: any) {
      console.error('Carousel publish failed:', err);
      setCarouselError(err.message || 'Could not publish the carousel to Instagram.');
      setCarouselPublishStatus('');
    } finally {
      setIsPublishingCarousel(false);
    }
  };

  const startRecording = useCallback(async () => {
    let stream = streamRef.current;
    if (!stream) {
      const ready = await initCamera(recordingMode);
      if (!ready || !streamRef.current) return;
      stream = streamRef.current;
    }
    const recordingDate = dateFilter;

    setShowingPlayback(false);
    setActiveMediaDateKey(null);
    activeMediaDateKeyRef.current = null;
    setCaptureModeDateKey(recordingDate);
    setVideoBlob(null);
    setVideoUrl(null);
    setCameraReady(false);
    setCameraError('');
    setGeneratedPost('');
    setCurrentRecordingId(null);
    setLinkedinDraftText('');
    setLinkedinDraftPostId(null);
    setLinkedinDraftSaveState('idle');
    setInstagramScriptDraftText('');
    setInstagramScriptDraftPostId(null);
    setInstagramScriptDraftSaveState('idle');
    setCarouselDraftTitle('');
    setCarouselSlides([]);
    setCarouselActiveSlide(0);
    setCarouselCaption('');
    setCarouselTheme({ ...DEFAULT_CAROUSEL_THEME });
    setCarouselDraftPostId(null);
    setCarouselDraftSaveState('idle');
    setCarouselPublishSuccess(false);
    setCarouselPublishStatus('');
    setCarouselError('');
    setIsAnalyzing(false);
    setVideoProcessingStage('idle');
    setVideoProcessingName('');
    setVideoAnalysis(null);
    setAnalysisError('');
    chunksRef.current = [];
    setRecordingTime(0);

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setVideoBlob(blob);
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setShowingPlayback(true);
      setActiveMediaDateKey(recordingDate);
      activeMediaDateKeyRef.current = recordingDate;
      setCaptureModeDateKey(recordingDate);
      setIsAnalyzing(true);
      setVideoProcessingStage('saving');
      setVideoProcessingName('Raw camera recording');
      void (async () => {
        const recordingId = await saveVideoRecording(blob, {
          recordingDate,
          title: 'Raw camera recording',
          durationSeconds: chunksRef.current.length || recordingTime || 1,
          setAsCurrent: true,
        });
        if (selectedDateKeyRef.current === recordingDate) {
          setVideoProcessingStage('analyzing');
        }
        await analyzeVideoForContent(blob, recordingId, recordingDate);
      })();
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000); // Collect data every second
    setIsRecording(true);

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, [recordingMode, dateFilter, recordingTime]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

	  const loadVideoFile = (file: File) => {
	    if (!isVideoFile(file)) {
	      setCameraError('Please choose a video file.');
	      setIsAnalyzing(false);
	      setVideoProcessingStage('idle');
	      setVideoProcessingName('');
	      return;
	    }

    const recordingDate = dateFilter;
    stopCamera();
    setCameraReady(false);
    setCameraError('');
    setShowingPlayback(true);
    setActiveMediaDateKey(recordingDate);
    activeMediaDateKeyRef.current = recordingDate;
    setCaptureModeDateKey(recordingDate);
    setVideoBlob(file);
    setGeneratedPost('');
    setCurrentRecordingId(null);
    setLinkedinDraftText('');
    setLinkedinDraftPostId(null);
    setLinkedinDraftSaveState('idle');
    setInstagramScriptDraftText('');
    setInstagramScriptDraftPostId(null);
    setInstagramScriptDraftSaveState('idle');
    setIsAnalyzing(true);
    setVideoProcessingStage('saving');
    setVideoProcessingName(file.name || 'Uploaded video');
    setVideoAnalysis(null);
    setAnalysisError('');

    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) {
        setRecordingTime(Math.max(1, Math.round(probe.duration)));
      }
      URL.revokeObjectURL(probe.src);
    };
    probe.onerror = () => URL.revokeObjectURL(probe.src);
    probe.src = URL.createObjectURL(file);

    void (async () => {
      const recordingId = await saveVideoRecording(file, {
        recordingDate,
        title: file.name || 'Uploaded video',
        durationSeconds: recordingTime || 1,
        setAsCurrent: true,
      });
      if (selectedDateKeyRef.current === recordingDate) {
        setVideoProcessingStage('analyzing');
      }
      await analyzeVideoForContent(file, recordingId, recordingDate);
    })();
  };

  const handleVideoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) loadVideoFile(file);
    event.target.value = '';
  };

  const resetRecording = () => {
    setShowingPlayback(false);
    setActiveMediaDateKey(null);
    activeMediaDateKeyRef.current = null;
    setCaptureModeDateKey(dateFilter);
    setVideoBlob(null);
    setVideoUrl(null);
    setGeneratedPost('');
    setRecordingTime(0);
    setCurrentRecordingId(null);
    setLinkedinDraftText('');
    setLinkedinDraftPostId(null);
    setLinkedinDraftSaveState('idle');
    setInstagramScriptDraftText('');
    setInstagramScriptDraftPostId(null);
    setInstagramScriptDraftSaveState('idle');
    setIsAnalyzing(false);
    setVideoProcessingStage('idle');
    setVideoProcessingName('');
    setVideoAnalysis(null);
    setAnalysisError('');
    // Re-init camera preview
    if (videoPreviewRef.current && streamRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current;
    }
  };

  // Analyze the recorded video (visuals + spoken content) and produce a content plan.
  // Non-blocking: a failure here never stops the user from uploading or recording again.
  const analyzeVideoForContent = async (blob: Blob, recordingIdOverride?: number | null, recordingDateOverride?: string) => {
    const shouldDisplayForRequest = () => !recordingDateOverride || selectedDateKeyRef.current === recordingDateOverride;
    if (shouldDisplayForRequest()) {
      setIsAnalyzing(true);
      setVideoProcessingStage('analyzing');
      setVideoAnalysis(null);
      setAnalysisError('');
    }
    console.log('🔍 [Video Analysis] Starting content opportunity analysis...');

    try {
      const formData = new FormData();
      formData.append('file', blob, getVideoUploadFileName(blob, 'recording'));
      formData.append('prompt', `You are a social media strategist for founders who build in public. Analyze this video update — what the founder talks about, the tone, and what's shown on screen — and decide how it should become social content.

Think holistically. Some raw videos are strong enough to become a social clip. Others are better used as source material for a separate post, talk-to-camera script, or carousel. Do not force every recording into a raw clip.

Available Raw-to-Post formats:
- "instagram-video": a personal talk-to-camera follow-up. Best for showing the founder's lived experience, their "why", niche knowledge about their target user or community, or problems they've personally faced.
- "instagram-carousel": a multi-slide post. Best for numbered tips, lessons, an "about me" post, explaining product features, or turning a rough idea into step-by-step insight.

If the founder mentions an idea with content potential, generate at least one concrete asset that builds on that idea:
- For an instagram-video opportunity, write a fresh talk-to-camera script the founder can record as follow-up content.
- For an instagram-carousel opportunity, draft the carousel slides.

Talk-to-camera script quality rules:
- Lead with a concise scroll-stopping hook. It should be a bold central claim, a sharp question, or a thought-provoking statement that makes the viewer want the next sentence.
- Give every sentence a job. Cut throat-clearing, generic setup, filler, and any repeated idea. Do not say the same point twice in different words.
- Use a clear spoken arc: hook -> specific context, tension, or story -> one useful insight or turn -> founder/product relevance if it naturally follows -> engaging close.
- End with a question, a call to action, or a concluding sentence that sharpens the central claim and encourages replies, saves, or shares.
- Use successful structure patterns as reference, not as topics to copy: surprising historical or cultural contrast that reframes a problem; high-stakes day-in-the-life story with concrete moments, vulnerability, outcome, and lesson; hooks that sound like bold observations rather than introductions.
- Do not copy or mention the example topics, names, grief community, martial arts hooks, or any unrelated business unless they appear in the founder's video.
- Keep the script tight enough for 45-75 seconds, written in natural spoken lines.
- Set script.hook to the exact first spoken line. Set script.body to the rest of the spoken script after the hook, without repeating the hook. Set script.cta to the final closing line only if it is not already included in script.body.

Carousel quality rules:
- The first slide must work as a concise scroll-stopping hook.
- Each slide must advance one distinct idea. No repeated claims or filler.
- The final slide must end with a question, call to action, or crisp concluding claim.

For raw clip guidance, evaluate the recorded video itself before recommending follow-up content. Only mark rawClip.usable true if the actual recorded video can work on its own after editing. If true, provide a punchy hook, ideal start/end seconds or segments to keep, and a clear narrative structure. Prefer segments that remove filler, dead space, restarts, or rambling. If the raw video is not strong enough, mark usable false and be candid about why: mention issues like hesitant delivery, rambling, weak structure, dead space, poor framing, or inconsistent eye contact when present. Then connect that evaluation to the follow-up content plan by naming the core idea, insight, or story that is still worth turning into the Instagram video script or carousel below.

${RAW_TO_POST_STYLE_RULES}

${RAW_TO_POST_REFERENCE_EXAMPLES}

Respond with ONLY a JSON object (no markdown, no preamble) in exactly this shape:
{
  "summary": "one sentence summary of what the founder discussed",
  "contentPotential": "strong" | "needs-development" | "low",
  "recommendedFormat": "instagram-video" | "instagram-carousel",
  "reasoning": "one short sentence explaining the recommendation",
  "contentOpportunities": [
    { "format": "instagram-video" | "instagram-carousel", "title": "short content title", "why": "why this format fits" }
  ],
  "linkedinPost": null,
  "script": {
    "title": "short video title",
    "hook": "concise scroll-stopping first spoken line",
    "body": "rest of the 45-75 second talk-to-camera script after the hook; purposeful, non-repetitive spoken lines",
    "cta": "final question, CTA, or crisp concluding claim if not already included in body"
  } | null,
  "carousel": {
    "title": "carousel title",
    "slides": [
      { "title": "slide headline", "body": "1-2 concise lines" }
    ]
  } | null,
  "rawClip": {
    "usable": true | false,
    "reasoning": "evaluate the raw video itself, then explain how the strongest underlying idea should become the follow-up content below",
    "hook": "punchy hook for the edited clip",
    "clipStartSeconds": 0,
    "clipEndSeconds": 45,
    "segments": [
      { "startSeconds": 0, "endSeconds": 12, "reason": "why this segment belongs" }
    ],
    "structure": ["hook", "context", "insight", "payoff"],
    "caption": "short caption for the clip"
  }
}`);

      const response = await fetch('/api/generate/video-analysis', {
        method: 'POST',
        body: formData,
      });

      console.log('🔍 [Video Analysis] Response status:', response.status);

      const data = await readApiResponse(response);
      if (!response.ok || data.success === false) {
        console.error('🔍 [Video Analysis] ❌ Failed:', data);
        if (shouldDisplayForRequest()) {
          setAnalysisError('Video analysis failed. Try recording again or upload a different clip.');
        }
        return;
      }

      const raw = data.result ?? data.text ?? data.analysis ?? '';
      console.log('🔍 [Video Analysis] Raw result:', raw);

      const parsed = parseContentAnalysis(raw);
      if (parsed) {
        const targetRecordingId = recordingIdOverride ?? currentRecordingId;
        const targetRecordingDate = recordingDateOverride || dateFilter;
        const shouldDisplayResult = shouldDisplayForRequest();
        const nextFormat = getDefaultDraftFormat(parsed);
        const scriptDraft = getTeleprompterText(parsed.script);
        const editableCarouselDraft = carouselDraftFromAnalysis(parsed.carousel);
        window.localStorage.setItem(getSelectedFormatStorageKey(targetRecordingDate), nextFormat);
        if (parsed.linkedinPost?.body) {
          window.localStorage.setItem(getLinkedInDraftStorageKey(targetRecordingId, targetRecordingDate), parsed.linkedinPost.body);
          window.localStorage.setItem(getLinkedInDraftStorageKey(null, targetRecordingDate), parsed.linkedinPost.body);
          syncRawDraftToContentCalendar('linkedin', parsed.linkedinPost.body, targetRecordingDate, targetRecordingId, parsed.linkedinPost.title);
        }
        if (scriptDraft) {
          window.localStorage.setItem(getInstagramScriptDraftStorageKey(targetRecordingId, targetRecordingDate), scriptDraft);
          window.localStorage.setItem(getInstagramScriptDraftStorageKey(null, targetRecordingDate), scriptDraft);
          syncRawDraftToContentCalendar('instagram-video', scriptDraft, targetRecordingDate, targetRecordingId, parsed.script?.title);
        }
        if (editableCarouselDraft) {
          window.localStorage.setItem(getInstagramCarouselDraftStorageKey(targetRecordingId, targetRecordingDate), JSON.stringify(editableCarouselDraft));
          window.localStorage.setItem(getInstagramCarouselDraftStorageKey(null, targetRecordingDate), JSON.stringify(editableCarouselDraft));
          syncRawDraftToContentCalendar(
            'instagram-carousel',
            getCarouselDraftText(editableCarouselDraft.title, editableCarouselDraft.slides),
            targetRecordingDate,
            targetRecordingId,
            editableCarouselDraft.title
          );
        }

        if (shouldDisplayResult) {
          setVideoAnalysis(parsed);
          setFormat(nextFormat);
          setGeneratedPost('');
          setLinkedinDraftText(parsed.linkedinPost?.body || '');
          setLinkedinDraftPostId(null);
          setLinkedinDraftSaveState('idle');
          setInstagramScriptDraftText(scriptDraft);
          setInstagramScriptDraftPostId(null);
          setInstagramScriptDraftSaveState('idle');
          if (editableCarouselDraft) {
            setCarouselDraftTitle(editableCarouselDraft.title);
            setCarouselSlides(editableCarouselDraft.slides);
            setCarouselCaption(editableCarouselDraft.caption || getCarouselCaptionFromDraft(editableCarouselDraft.title, editableCarouselDraft.slides));
            setCarouselTheme(editableCarouselDraft.theme || { ...DEFAULT_CAROUSEL_THEME });
            setCarouselActiveSlide(0);
            setCarouselDraftPostId(null);
            setCarouselDraftSaveState('idle');
            setCarouselPublishSuccess(false);
            setCarouselPublishStatus('');
            setCarouselError('');
          } else {
            setCarouselDraftTitle('');
            setCarouselSlides([]);
            setCarouselCaption('');
            setCarouselTheme({ ...DEFAULT_CAROUSEL_THEME });
            setCarouselActiveSlide(0);
            setCarouselDraftPostId(null);
            setCarouselDraftSaveState('idle');
          }
        }
        void saveContentPlanSnapshot(parsed, targetRecordingId, targetRecordingDate);
        if (parsed.linkedinPost?.body) {
          void saveLinkedInDraft(parsed.linkedinPost.body, targetRecordingId, targetRecordingDate);
        }
        if (scriptDraft) {
          void saveInstagramScriptDraft(scriptDraft, targetRecordingId, targetRecordingDate);
        }
        if (editableCarouselDraft) {
          void saveCarouselDraft(
            editableCarouselDraft.title,
            editableCarouselDraft.slides,
            editableCarouselDraft.caption,
            targetRecordingId,
            targetRecordingDate
          );
        }
        console.log('🔍 [Video Analysis] ✅ Recommended:', parsed.recommendedFormat, '—', parsed.reasoning);
      } else {
        if (shouldDisplayForRequest()) {
          setAnalysisError('Video analysis returned an unexpected format. Try recording again or upload a different clip.');
        }
        console.warn('🔍 [Video Analysis] Could not parse a valid content plan from result.');
      }
    } catch (err) {
      console.error('🔍 [Video Analysis] Error:', err);
      if (shouldDisplayForRequest()) {
        setAnalysisError('Video analysis failed. Try recording again or upload a different clip.');
      }
    } finally {
      if (shouldDisplayForRequest()) {
        setIsAnalyzing(false);
        setVideoProcessingStage('idle');
        setVideoProcessingName('');
      }
    }
  };

  const toggleFavorite = async (postId: number, isFavorite: boolean) => {
    if (!hasWorkspaceDbAuth()) return;
    try {
      await updateWorkspaceRow('video_posts', postId, { is_favorite: !isFavorite });
      // Refresh posts
      if (currentRecordingId) {
        const posts = await getPostsForRecording(currentRecordingId);
        setSavedPosts(posts || []);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const deletePost = async (postId: number) => {
    if (!hasWorkspaceDbAuth()) return;
    try {
      await deleteWorkspaceRow('video_posts', postId);
      setSavedPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const copyToClipboard = (text: string, target = 'generic') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTarget(target);
      setTimeout(() => {
        setCopiedTarget(current => current === target ? null : current);
      }, 2000);
    });
  };

  const openPreviewInNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const useSuggestedContent = (nextFormat: PostFormat, content: string) => {
    setFormat(nextFormat);
    window.localStorage.setItem(getSelectedFormatStorageKey(dateFilter), nextFormat);
    setGeneratedPost(content);
    syncRawDraftToContentCalendar(nextFormat, content, dateFilter, currentRecordingId);
  };

  const refreshSavedPosts = async (): Promise<GeneratedPost[]> => {
    if (!currentRecordingId || !hasWorkspaceDbAuth()) return [];
    const posts = await getPostsForRecording(currentRecordingId);
    const nextPosts = posts || [];
    setSavedPosts(nextPosts);
    return nextPosts;
  };

  const getPostsForRecording = async (recordingId: number): Promise<GeneratedPost[]> => {
    if (!hasWorkspaceDbAuth()) return [];
    return getWorkspaceRows<GeneratedPost>(
      'video_posts',
      [{ column: 'recording_id', operator: 'eq', value: recordingId }],
      { column: 'created_at', direction: 'desc' }
    );
  };

  const saveVideoPostDraftRow = async (
    recordingId: number,
    postFormat: string,
    content: string,
    preferredPostId?: number | null
  ): Promise<number | null> => {
    if (!hasWorkspaceDbAuth()) return null;
    const postsForRecording = await getPostsForRecording(recordingId);
    const existingDraft = (preferredPostId
      ? postsForRecording.find(post => post.id === preferredPostId) || null
      : null) || getLatestSavedDraft(postsForRecording, postFormat);

    if (existingDraft) {
      try {
        await updateWorkspaceRow('video_posts', existingDraft.id, { content });
        return existingDraft.id;
      } catch (err) {
        console.warn(`Failed to update ${postFormat} draft; inserting a replacement row instead.`, err);
      }
    }

    const insertResult = await window.__workspaceDb.from('video_posts').insert({
      recording_id: recordingId,
      post_format: postFormat,
      content,
      is_favorite: false,
    });
    return getInsertedId(insertResult);
  };

  const saveGeneratedContentDraft = async (postFormat: PostFormat, content: string, recordingId?: number | null) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    syncRawDraftToContentCalendar(postFormat, trimmedContent, dateFilter, recordingId, postFormat === 'instagram-carousel' ? videoAnalysis?.carousel?.title : undefined);

    if (!recordingId || !hasWorkspaceDbAuth()) return;

    try {
      await saveVideoPostDraftRow(recordingId, postFormat, content);
    } catch (err) {
      console.error(`Failed to autosave ${postFormat} draft:`, err);
    }
  };

  const saveContentPlanSnapshot = async (analysis: VideoContentAnalysis, recordingId?: number | null, dateOverride?: string) => {
    const content = JSON.stringify(analysis);
    const storageDate = dateOverride || dateFilter;
    window.localStorage.setItem(getContentPlanStorageKey(recordingId ?? null, storageDate), content);
    window.localStorage.setItem(getContentPlanStorageKey(null, storageDate), content);

    if (!recordingId || !hasWorkspaceDbAuth()) return;

    try {
      await saveVideoPostDraftRow(recordingId, 'content-plan', content);
    } catch (err) {
      console.error('Failed to autosave content plan:', err);
    }
  };

  const saveLinkedInDraft = async (content: string, recordingIdOverride?: number | null, dateOverride?: string) => {
    const recordingId = recordingIdOverride ?? currentRecordingId;
    const trimmedContent = content.trim();
    const storageDate = dateOverride || dateFilter;
    const storageKey = getLinkedInDraftStorageKey(recordingId, storageDate);
    const shouldReflectState = selectedDateKeyRef.current === storageDate;
    window.localStorage.setItem(storageKey, content);
    window.localStorage.setItem(getLinkedInDraftStorageKey(null, storageDate), content);

    if (!trimmedContent) {
      if (shouldReflectState) setLinkedinDraftSaveState('idle');
      return;
    }

    syncRawDraftToContentCalendar('linkedin', trimmedContent, storageDate, recordingId, videoAnalysis?.linkedinPost?.title);

    if (!recordingId || !hasWorkspaceDbAuth()) {
      if (shouldReflectState) setLinkedinDraftSaveState('local');
      return;
    }

    if (shouldReflectState) setLinkedinDraftSaveState('saving');
    try {
      const savedPostId = await saveVideoPostDraftRow(recordingId, 'linkedin', content, linkedinDraftPostId);

      const nextPosts = await getPostsForRecording(recordingId);
      const isCurrentRecording = recordingId === currentRecordingId || shouldReflectState;
      if (isCurrentRecording) {
        setSavedPosts(nextPosts);
        const savedLinkedInDraft = getLatestLinkedInDraft(nextPosts);
        setLinkedinDraftPostId(savedLinkedInDraft?.id || savedPostId || null);
        setLinkedinDraftSaveState('saved');
      }
    } catch (err) {
      console.error('Failed to autosave LinkedIn draft:', err);
      if (shouldReflectState) {
        setLinkedinDraftSaveState('local');
      }
    }
  };

  const handleLinkedInDraftChange = (value: string) => {
    setLinkedinDraftText(value);
    setGeneratedPost('');
    setLinkedinDraftSaveState('saving');
    window.localStorage.setItem(getLinkedInDraftStorageKey(currentRecordingId, dateFilter), value);

    if (linkedinDraftAutosaveRef.current) {
      clearTimeout(linkedinDraftAutosaveRef.current);
    }
    linkedinDraftAutosaveRef.current = setTimeout(() => {
      saveLinkedInDraft(value);
    }, 350);
  };

  const saveInstagramScriptDraft = async (content: string, recordingIdOverride?: number | null, dateOverride?: string) => {
    const recordingId = recordingIdOverride ?? currentRecordingId;
    const trimmedContent = content.trim();
    const storageDate = dateOverride || dateFilter;
    const storageKey = getInstagramScriptDraftStorageKey(recordingId, storageDate);
    const shouldReflectState = selectedDateKeyRef.current === storageDate;
    window.localStorage.setItem(storageKey, content);
    window.localStorage.setItem(getInstagramScriptDraftStorageKey(null, storageDate), content);

    if (!trimmedContent) {
      if (shouldReflectState) setInstagramScriptDraftSaveState('idle');
      return;
    }

    syncRawDraftToContentCalendar('instagram-video', trimmedContent, storageDate, recordingId, videoAnalysis?.script?.title);

    if (!recordingId || !hasWorkspaceDbAuth()) {
      if (shouldReflectState) setInstagramScriptDraftSaveState('local');
      return;
    }

    if (shouldReflectState) setInstagramScriptDraftSaveState('saving');
    try {
      const savedPostId = await saveVideoPostDraftRow(recordingId, 'instagram-video', content, instagramScriptDraftPostId);

      const nextPosts = await getPostsForRecording(recordingId);
      const isCurrentRecording = recordingId === currentRecordingId || shouldReflectState;
      if (isCurrentRecording) {
        setSavedPosts(nextPosts);
        const savedInstagramScriptDraft = getLatestInstagramScriptDraft(nextPosts);
        setInstagramScriptDraftPostId(savedInstagramScriptDraft?.id || savedPostId || null);
        setInstagramScriptDraftSaveState('saved');
      }
    } catch (err) {
      console.error('Failed to autosave Instagram script:', err);
      if (shouldReflectState) {
        setInstagramScriptDraftSaveState('local');
      }
    }
  };

  const handleInstagramScriptDraftChange = (value: string) => {
    setInstagramScriptDraftText(value);
    setGeneratedPost('');
    setInstagramScriptDraftSaveState('saving');
    setFormat('instagram-video');
    window.localStorage.setItem(getSelectedFormatStorageKey(dateFilter), 'instagram-video');
    window.localStorage.setItem(getInstagramScriptDraftStorageKey(currentRecordingId, dateFilter), value);

    if (instagramScriptDraftAutosaveRef.current) {
      clearTimeout(instagramScriptDraftAutosaveRef.current);
    }
    instagramScriptDraftAutosaveRef.current = setTimeout(() => {
      saveInstagramScriptDraft(value);
    }, 350);
  };

  const saveCarouselDraft = async (
    title: string,
    slides: EditableCarouselSlide[],
    caption?: string,
    recordingIdOverride?: number | null,
    dateOverride?: string,
    themeOverride?: CarouselTheme
  ) => {
    const recordingId = recordingIdOverride ?? currentRecordingId;
    const storageDate = dateOverride || dateFilter;
    const draftTheme = themeOverride || carouselTheme;
    const normalizedDraft = normalizeEditableCarouselDraft({ title, slides, caption, theme: draftTheme });
    const readableContent = getCarouselDraftText(normalizedDraft.title, normalizedDraft.slides);
    const shouldReflectState = selectedDateKeyRef.current === storageDate;

    window.localStorage.setItem(getInstagramCarouselDraftStorageKey(recordingId, storageDate), JSON.stringify(normalizedDraft));
    window.localStorage.setItem(getInstagramCarouselDraftStorageKey(null, storageDate), JSON.stringify(normalizedDraft));

    if (!normalizedDraft.slides.length) {
      if (shouldReflectState) setCarouselDraftSaveState('idle');
      return;
    }

    syncRawDraftToContentCalendar('instagram-carousel', readableContent, storageDate, recordingId, normalizedDraft.title);

    if (!recordingId || !hasWorkspaceDbAuth()) {
      if (shouldReflectState) setCarouselDraftSaveState('local');
      return;
    }

    if (shouldReflectState) setCarouselDraftSaveState('saving');
    try {
      const savedPostId = await saveVideoPostDraftRow(recordingId, 'instagram-carousel', readableContent, carouselDraftPostId);
      const nextPosts = await getPostsForRecording(recordingId);
      const isCurrentRecording = recordingId === currentRecordingId || shouldReflectState;
      if (isCurrentRecording) {
        setSavedPosts(nextPosts);
        const savedCarouselDraft = getLatestSavedDraft(nextPosts, 'instagram-carousel');
        setCarouselDraftPostId(savedCarouselDraft?.id || savedPostId || null);
        setCarouselDraftSaveState('saved');
      }
    } catch (err) {
      console.error('Failed to autosave carousel draft:', err);
      if (shouldReflectState) setCarouselDraftSaveState('local');
    }
  };

  const scheduleCarouselDraftAutosave = (
    title: string,
    slides: EditableCarouselSlide[],
    caption = carouselCaption,
    themeOverride?: CarouselTheme
  ) => {
    setCarouselDraftSaveState('saving');
    setCarouselPublishSuccess(false);
    setCarouselPublishStatus('');
    setCarouselError('');
    if (carouselDraftAutosaveRef.current) {
      clearTimeout(carouselDraftAutosaveRef.current);
    }
    carouselDraftAutosaveRef.current = setTimeout(() => {
      saveCarouselDraft(title, slides, caption, undefined, undefined, themeOverride);
    }, 350);
  };

  const updateCarouselTitle = (value: string) => {
    setCarouselDraftTitle(value);
    scheduleCarouselDraftAutosave(value, carouselSlides);
  };

  const updateCarouselCaption = (value: string) => {
    setCarouselCaption(value);
    scheduleCarouselDraftAutosave(carouselDraftTitle, carouselSlides, value);
  };

  const updateCarouselBrandGuidance = (value: string) => {
    setCarouselBrandGuidance(value);
    const keys = [
      getInstagramCarouselGuidanceStorageKey(currentRecordingId, dateFilter),
      getInstagramCarouselGuidanceStorageKey(null, dateFilter),
    ];
    keys.forEach(key => {
      if (value.trim()) {
        window.localStorage.setItem(key, value);
      } else {
        window.localStorage.removeItem(key);
      }
    });
  };

  const updateCarouselTheme = (partial: Partial<CarouselTheme>) => {
    const nextTheme = { ...carouselTheme, ...partial };
    setCarouselTheme(nextTheme);
    scheduleCarouselDraftAutosave(carouselDraftTitle, carouselSlides, carouselCaption, nextTheme);
  };

  const updateCarouselSlide = (slideId: string, field: 'title' | 'body', value: string) => {
    setCarouselSlides(currentSlides => {
      const nextSlides = currentSlides.map(slide => (
        slide.id === slideId ? { ...slide, [field]: value } : slide
      ));
      scheduleCarouselDraftAutosave(carouselDraftTitle, nextSlides);
      return nextSlides;
    });
  };

  const addCarouselSlide = () => {
    setCarouselSlides(currentSlides => {
      const nextSlide = {
        id: createSlideId(currentSlides.length),
        title: `Slide ${currentSlides.length + 1}`,
        body: 'Add one clear point here.',
      };
      const nextSlides = [...currentSlides, nextSlide].slice(0, 10);
      setCarouselActiveSlide(nextSlides.length - 1);
      scheduleCarouselDraftAutosave(carouselDraftTitle || 'Instagram carousel', nextSlides);
      return nextSlides;
    });
  };

  const removeCarouselSlide = (slideId: string) => {
    setCarouselSlides(currentSlides => {
      const nextSlides = currentSlides.filter(slide => slide.id !== slideId);
      setCarouselActiveSlide(index => Math.max(0, Math.min(index, nextSlides.length - 1)));
      scheduleCarouselDraftAutosave(carouselDraftTitle, nextSlides);
      return nextSlides;
    });
  };

  const clearLocalProgressForDate = (date: string, recordingIds: number[]) => {
    window.localStorage.setItem(getReplacedAtStorageKey(date), String(Date.now()));
    window.localStorage.removeItem(getVideoRecordingsStorageKey(date));
    window.localStorage.removeItem(getContentPlanStorageKey(null, date));
    window.localStorage.removeItem(getLinkedInDraftStorageKey(null, date));
    window.localStorage.removeItem(getInstagramScriptDraftStorageKey(null, date));
    window.localStorage.removeItem(getInstagramCarouselDraftStorageKey(null, date));
    window.localStorage.removeItem(getInstagramCarouselGuidanceStorageKey(null, date));
    window.localStorage.removeItem(getSelectedFormatStorageKey(date));

    recordingIds.forEach(recordingId => {
      window.localStorage.removeItem(getContentPlanStorageKey(recordingId, date));
      window.localStorage.removeItem(getLinkedInDraftStorageKey(recordingId, date));
      window.localStorage.removeItem(getInstagramScriptDraftStorageKey(recordingId, date));
      window.localStorage.removeItem(getInstagramCarouselDraftStorageKey(recordingId, date));
      window.localStorage.removeItem(getInstagramCarouselGuidanceStorageKey(recordingId, date));
      window.localStorage.removeItem(getTeleprompterEditStorageKey(recordingId, date, ''));
    });
    setLocalRecordingsVersion(version => version + 1);
  };

  const deleteWorkspaceProgressForDate = async (recordingIds: number[]) => {
    if (!hasWorkspaceDbAuth() || recordingIds.length === 0) return;

    await Promise.all(recordingIds.map(async recordingId => {
      try {
        const posts = await getPostsForRecording(recordingId);
        await Promise.all(posts.map(post => deleteWorkspaceRow('video_posts', post.id)));
      } catch (err) {
        console.warn('Failed to delete generated posts for recording:', recordingId, err);
      }

      try {
        await deleteWorkspaceRow('video_recordings', recordingId);
      } catch (err) {
        console.warn('Failed to delete saved recording:', recordingId, err);
      }
    }));
  };

  const replaceDayProgressWithNewRecording = async () => {
    const replacementDate = dateFilter;
    const recordingIds = recordingsForSelectedDate
      .map(recording => recording.id)
      .filter(id => id > 0);

    setIsReplacingProgress(true);
    setReplaceProgressDateKey(replacementDate);
    clearLocalProgressForDate(replacementDate, recordingIds);
    stopCamera();
    stopTeleprompterCamera();
    clearDayWorkspaceState();
    setRecordingMode('camera');
    setCaptureModeDateKey(replacementDate);
    setCameraError('');
    setShowReplaceProgressDialog(false);

    try {
      await deleteWorkspaceProgressForDate(recordingIds);
      refreshRecordings?.();
      await initCamera('camera');
    } finally {
      setIsReplacingProgress(false);
    }
  };

  const clearDayWorkspaceState = () => {
    if (videoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl);
    }
    setShowingPlayback(false);
    setActiveMediaDateKey(null);
    activeMediaDateKeyRef.current = null;
    setCaptureModeDateKey(null);
    setVideoBlob(null);
    setVideoUrl(null);
    setGeneratedPost('');
    setCurrentRecordingId(null);
    setSavedPosts([]);
    setLinkedinDraftText('');
    setLinkedinDraftPostId(null);
    setLinkedinDraftSaveState('idle');
    setInstagramScriptDraftText('');
    setInstagramScriptDraftPostId(null);
    setInstagramScriptDraftSaveState('idle');
    setIsAnalyzing(false);
    setVideoProcessingStage('idle');
    setVideoProcessingName('');
    setVideoAnalysis(null);
    setAnalysisError('');
    setShowHistory(false);
    setShowTeleprompter(false);
    setTeleprompterScript('');
    setTeleprompterTitle('Follow-up video script');
    setMetaError('');
    setShowScheduleDialog(false);
    setInstagramScheduleStatus('');
    setInstagramPublishSuccess(false);
    setInstagramPostId('');
  };

  const handleSelectDate = (date: Date) => {
    if (isRecording) {
      void stopRecording();
    }

    if (linkedinDraftAutosaveRef.current) {
      clearTimeout(linkedinDraftAutosaveRef.current);
      linkedinDraftAutosaveRef.current = null;
    }
    if (instagramScriptDraftAutosaveRef.current) {
      clearTimeout(instagramScriptDraftAutosaveRef.current);
      instagramScriptDraftAutosaveRef.current = null;
    }
    if (carouselDraftAutosaveRef.current) {
      clearTimeout(carouselDraftAutosaveRef.current);
      carouselDraftAutosaveRef.current = null;
    }
    if (linkedinDraftText.trim()) {
      void saveLinkedInDraft(linkedinDraftText);
    }
    if (instagramScriptDraftText.trim()) {
      void saveInstagramScriptDraft(instagramScriptDraftText);
    }
    if (carouselSlides.length > 0) {
      void saveCarouselDraft(carouselDraftTitle, carouselSlides, carouselCaption);
    }

    stopCamera();
    stopTeleprompterCamera();
    clearDayWorkspaceState();
    setSelectedDate(new Date(date));
  };

  const isToday = (date: Date) => formatDate(date) === formatDate(today);
  const isSelected = (date: Date) => formatDate(date) === formatDate(selectedDate);
  const selectedFormat = FORMAT_OPTIONS.find(f => f.value === format)!;
  const isReplacingProgressForSelectedDate = replaceProgressDateKey === dateFilter;
  const hasExistingRecording = recordingsForSelectedDate.length > 0 && !isReplacingProgressForSelectedDate;
  const hasScriptedTeleprompterRecordingForSelectedDate = recordingsForSelectedDate.some(isGeneratedScriptRecording);
  const scriptActionLabel = hasScriptedTeleprompterRecordingForSelectedDate ? 'Retake video' : 'Use script';
  const hasActiveMediaDate = activeMediaDateKey === dateFilter || activeMediaDateKeyRef.current === dateFilter;
  const isCaptureModeForSelectedDate = captureModeDateKey === dateFilter;
  const showPlaybackForSelectedDate = showingPlayback && hasActiveMediaDate && Boolean(videoUrl);
  const activeVideoProcessingStage: VideoProcessingStage = videoProcessingStage !== 'idle'
    ? videoProcessingStage
    : isAnalyzing && !videoAnalysis
      ? 'analyzing'
      : 'idle';
  const showVideoProcessingStatus = showPlaybackForSelectedDate && activeVideoProcessingStage !== 'idle';
  const videoProcessingPrimaryText = activeVideoProcessingStage === 'saving'
    ? 'Video received. Saving recording...'
    : 'Video received. Building content plan...';
  const videoProcessingSecondaryText = activeVideoProcessingStage === 'saving'
    ? 'Your clip is ready to preview while Bipp saves it.'
    : 'Bipp is analyzing the visuals and spoken context now.';
  const draftOpportunities = videoAnalysis ? getDraftOpportunities(videoAnalysis) : [];
  const savedLinkedInDraft = getLatestLinkedInDraft(savedPosts);
  const savedInstagramScriptDraft = getLatestInstagramScriptDraft(savedPosts);
  const shouldShowSavedLinkedInDraft = !videoAnalysis && Boolean(linkedinDraftText.trim());
  const shouldShowSavedInstagramScriptDraft = !videoAnalysis && Boolean(instagramScriptDraftText.trim());
  const linkedinDraftStatusLabel = linkedinDraftSaveState === 'saving'
    ? 'Saving...'
    : linkedinDraftSaveState === 'saved'
      ? currentRecordingId ? 'Autosaved' : 'Saved locally'
      : linkedinDraftSaveState === 'local'
        ? 'Saved locally'
        : linkedinDraftSaveState === 'error'
          ? 'Autosave failed'
          : savedLinkedInDraft
            ? 'Autosaved'
            : '';
  const instagramScriptDraftStatusLabel = instagramScriptDraftSaveState === 'saving'
    ? 'Saving...'
    : instagramScriptDraftSaveState === 'saved'
      ? currentRecordingId ? 'Autosaved' : 'Saved locally'
      : instagramScriptDraftSaveState === 'local'
        ? 'Saved locally'
        : instagramScriptDraftSaveState === 'error'
          ? 'Autosave failed'
        : savedInstagramScriptDraft
          ? 'Autosaved'
          : '';
  const carouselDraftStatusLabel = carouselDraftSaveState === 'saving'
    ? 'Saving...'
    : carouselDraftSaveState === 'saved'
      ? currentRecordingId ? 'Autosaved' : 'Saved locally'
      : carouselDraftSaveState === 'local'
        ? 'Saved locally'
        : carouselDraftSaveState === 'error'
          ? 'Autosave failed'
          : '';
  const savedLinkedInCopyTarget = `linkedin-saved-draft-${dateFilter}`;
  const contentPlanLinkedInCopyTarget = `linkedin-content-plan-${dateFilter}`;
  const generatedPostCopyTarget = `generated-post-${dateFilter}-${format}`;
  const activeCarouselSlide = carouselSlides[Math.min(carouselActiveSlide, Math.max(0, carouselSlides.length - 1))];
  const carouselActionDisabled = isGeneratingCarousel || isPublishingCarousel || isMetaSigningIn;
  const teleprompterReviewTrimRange = getTeleprompterTrimRange();
  const teleprompterReviewHasEdits = hasTeleprompterReviewEdits();
  const teleprompterTrimmedDuration = Math.max(
    0.5,
    teleprompterReviewTrimRange.end - teleprompterReviewTrimRange.start
  );
  const teleprompterSafeCaptionWords = teleprompterCcText.trim()
    ? buildTimedCaptionWords(teleprompterCcText, teleprompterReviewTrimRange.duration)
    : [];
  const teleprompterCaptionPreview = !teleprompterCaptionsSuppressedRef.current && teleprompterCcEnabled
    ? getActiveCaptionTextAtTime(teleprompterCurrentTime, teleprompterSafeCaptionWords, teleprompterCcText)
    : '';
  const teleprompterClipSegmentsForReview = getTeleprompterClipSegmentsForDuration();
  const activeTeleprompterClipKey = activeTeleprompterClipId || teleprompterClipSegmentsForReview[0]?.id || 'clip-full';
  const teleprompterFinalClipDuration = teleprompterClipSegmentsForReview.reduce(
    (total, segment) => total + Math.max(0, segment.end - segment.start),
    0
  );
  const teleprompterTimelineDuration = Math.max(0.5, teleprompterFinalClipDuration || teleprompterReviewTrimRange.duration);
  let teleprompterTimelineCursor = 0;
  const teleprompterSegmentTimelineMetrics = teleprompterClipSegmentsForReview.map(segment => {
    const segmentDuration = Math.max(0, segment.end - segment.start);
    const left = (teleprompterTimelineCursor / teleprompterTimelineDuration) * 100;
    const width = Math.max(1, (segmentDuration / teleprompterTimelineDuration) * 100);
    teleprompterTimelineCursor += segmentDuration;
    return { id: segment.id, left, width, duration: segmentDuration };
  });
  const activeTeleprompterTimelineMetric = teleprompterSegmentTimelineMetrics.find(metric => metric.id === activeTeleprompterClipKey)
    || teleprompterSegmentTimelineMetrics[0];
  const teleprompterTrimStartPercent = activeTeleprompterTimelineMetric?.left || 0;
  const teleprompterTrimEndPercent = activeTeleprompterTimelineMetric
    ? Math.min(100, activeTeleprompterTimelineMetric.left + activeTeleprompterTimelineMetric.width)
    : 100;
  const teleprompterEditedTimelineTime = getEditedTimelineTimeFromOriginalTime(teleprompterCurrentTime, teleprompterClipSegmentsForReview);
  const teleprompterPlayheadPercent = clampNumber((teleprompterEditedTimelineTime / teleprompterTimelineDuration) * 100, 0, 100);
  const teleprompterTimelineCellCount = Math.max(8, teleprompterTimelineFrames.length || 0);
  const teleprompterTimelineCells = Array.from({ length: teleprompterTimelineCellCount }, (_, index) => {
    if (!teleprompterTimelineFrames.length) return `fallback-${index}`;
    const editedTime = teleprompterTimelineDuration * ((index + 0.5) / teleprompterTimelineCellCount);
    const originalTime = getOriginalTimeFromEditedTimelineTime(editedTime, teleprompterClipSegmentsForReview);
    const sourceDuration = Math.max(1, teleprompterReviewTrimRange.duration);
    const frameIndex = Math.round(clampNumber(((originalTime / sourceDuration) * teleprompterTimelineFrames.length) - 0.5, 0, teleprompterTimelineFrames.length - 1));
    return teleprompterTimelineFrames[frameIndex] || `fallback-${index}`;
  });
  const canUndoTeleprompterEdit = teleprompterEditPast.length > 0;
  const canRedoTeleprompterEdit = teleprompterEditFuture.length > 0;
  const teleprompterHasTimelineEdits = teleprompterClipSegmentsForReview.length > 1
    || teleprompterReviewTrimRange.start > 0.05
    || teleprompterReviewTrimRange.end < teleprompterReviewTrimRange.duration - 0.05;
  const teleprompterEditSaveLabel = teleprompterHasTimelineEdits && teleprompterEditSaveState === 'saving'
    ? 'Autosaving edits...'
    : teleprompterHasTimelineEdits && teleprompterEditSaveState === 'saved'
      ? 'Edits autosaved'
      : '';
  const teleprompterReviewActionDisabled = isPublishingInstagram
    || isMetaSigningIn
    || isSchedulingInstagram
    || isRenderingTeleprompterEdit;

  return (
    <div className="min-h-full flex flex-col w-full" style={{ background: '#fafafa' }}>
      {/* Hidden canvas for PiP compositing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {showReplaceProgressDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.48)' }}>
          <div className="w-full max-w-md rounded-2xl p-5 shadow-xl" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: '#111827' }}>
                  Replace this day's progress?
                </h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: '#4b5563' }}>
                  This will erase all saved videos, generated ideas, drafts, and scripts for {formatDisplayDate(selectedDate)} so you can speak to camera again and generate new content from scratch.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setShowReplaceProgressDialog(false)}
                disabled={isReplacingProgress}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                style={{ background: '#f3f4f6', color: '#374151' }}
              >
                Keep progress
              </button>
              <button
                onClick={replaceDayProgressWithNewRecording}
                disabled={isReplacingProgress}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: '#dc2626' }}
              >
                {isReplacingProgress && <Loader2 className="w-4 h-4 animate-spin" />}
                Replace and record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flow Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: '#e5e5e5', background: '#fff' }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: '#666' }}>
          <span className="font-medium" style={{ color: '#3b82f6' }}>Record</span>
          <span>→</span>
          <span className="font-medium" style={{ color: '#3b82f6' }}>Analyze</span>
          <span>→</span>
          <span className="font-medium" style={{ color: '#3b82f6' }}>Plan</span>
        </div>
        {savedPosts.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: showHistory ? '#3b82f6' : '#f5f5f5',
              color: showHistory ? '#fff' : '#333'
            }}
          >
            <History className="w-3.5 h-3.5" />
            {savedPosts.length} posts
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Week Calendar */}
        <div className="px-5 py-4 border-b" style={{ borderColor: '#e5e5e5', background: '#fff' }}>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: '#666' }} />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" style={{ color: '#3b82f6' }} />
              <span className="text-sm font-medium" style={{ color: '#111' }}>
                {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="px-2 py-1 text-xs font-medium rounded-lg transition-colors"
                  style={{ background: '#e5e5e5', color: '#333' }}
                >
                  Today
                </button>
              )}
              <button
                onClick={() => setWeekOffset(prev => prev + 1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5" style={{ color: '#666' }} />
              </button>
            </div>
          </div>

          {/* Day Pills */}
          <div className="flex gap-2">
            {weekDates.map((date, i) => {
              const selected = isSelected(date);
              const todayDate = isToday(date);
              return (
                <button
                  key={i}
                  onClick={() => handleSelectDate(date)}
                  className="flex-1 flex flex-col items-center py-2 rounded-xl transition-all"
                  style={{
                    background: selected ? '#3b82f6' : todayDate ? '#dbeafe' : '#f5f5f5',
                    color: selected ? '#fff' : '#333',
                  }}
                >
                  <span className="text-xs font-medium">{DAYS_OF_WEEK[i]}</span>
                  <span className="text-lg font-bold">{date.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Prompt */}
        <div key={`prompt-${dateFilter}`} className="px-5 py-3" style={{ background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
          {hasExistingRecording ? (
            <p className="text-sm" style={{ color: '#666' }}>
              <span className="font-medium" style={{ color: '#111' }}>
                {formatDisplayDate(selectedDate)}
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>
                ✓ Recording saved
              </span>
            </p>
          ) : (
            <>
              <p className="text-sm font-medium" style={{ color: '#111' }}>
                {formatDisplayDate(selectedDate)} — What did you work on?
              </p>
              <p className="text-sm mt-1 leading-snug" style={{ color: '#666' }}>
                This is your brain dump, not your final post. Just talk it through — Bipp turns it into content ideas.
              </p>
            </>
          )}
        </div>

        {/* History Panel */}
        {showHistory && savedPosts.length > 0 && (
          <div className="px-5 py-4" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e5e5' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#111' }}>
              Generated Posts for {formatDisplayDate(selectedDate)}
            </h3>
            <div className="space-y-3">
              {savedPosts.map(post => {
                const postFormat = FORMAT_OPTIONS.find(f => f.value === post.post_format);
                const historyCopyTarget = `history-post-${post.id}`;
                const isHistoryPostCopied = copiedTarget === historyCopyTarget;
                return (
                  <div
                    key={post.id}
                    className="rounded-xl p-4"
                    style={{ background: '#fff', border: '1px solid #e5e5e5' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium" style={{ color: '#666' }}>
                        {postFormat?.icon} {postFormat?.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleFavorite(post.id, post.is_favorite)}
                          className="p-1.5 rounded-lg transition-all hover:bg-gray-100"
                        >
                          <Star
                            className="w-4 h-4"
                            style={{ color: post.is_favorite ? '#eab308' : '#ccc' }}
                            fill={post.is_favorite ? '#eab308' : 'none'}
                          />
                        </button>
                        <button
                          onClick={() => copyToClipboard(post.content, historyCopyTarget)}
                          className={`flex items-center rounded-lg transition-all hover:bg-gray-100 ${isHistoryPostCopied && post.post_format === 'linkedin' ? 'gap-1.5 px-2 py-1.5' : 'p-1.5'}`}
                          style={{
                            background: isHistoryPostCopied ? '#dcfce7' : undefined,
                            color: isHistoryPostCopied ? '#16a34a' : '#666',
                          }}
                        >
                          {isHistoryPostCopied ? (
                            <Check className="w-4 h-4" style={{ color: '#16a34a' }} />
                          ) : (
                            <Copy className="w-4 h-4" style={{ color: '#666' }} />
                          )}
                          {isHistoryPostCopied && post.post_format === 'linkedin' && (
                            <span className="text-xs font-medium">Copied</span>
                          )}
                        </button>
                        <button
                          onClick={() => deletePost(post.id)}
                          className="p-1.5 rounded-lg transition-all hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm line-clamp-3" style={{ color: '#333' }}>
                      {post.content}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Video Section - Only show if no existing recording or user wants to record new */}
        {!hasExistingRecording || showPlaybackForSelectedDate || isRecording || isCaptureModeForSelectedDate ? (
          <div key={`capture-${dateFilter}`} className="p-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: '#000', aspectRatio: '16/9', position: 'relative' }}
            >
              {/* Camera Preview (when not showing playback) */}
              {!showPlaybackForSelectedDate && (
                <video
                  key={`preview-${dateFilter}`}
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: recordingMode === 'camera' ? 'scaleX(-1)' : 'none', // Mirror only for camera
                  }}
                />
              )}

              {/* Video Playback (after recording) */}
              {showPlaybackForSelectedDate && videoUrl && (
                <video
                  key={`playback-${dateFilter}-${videoUrl}`}
                  ref={videoPlaybackRef}
                  src={videoUrl}
                  controls
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
	                  }}
	                />
	              )}

	              {showVideoProcessingStatus && (
	                <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(15,23,42,0.86)', color: '#fff', backdropFilter: 'blur(8px)' }}>
	                  <div className="flex min-w-0 items-center gap-2">
	                    {activeVideoProcessingStage === 'saving' ? (
	                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
	                    ) : (
	                      <Sparkles className="h-4 w-4 shrink-0" />
	                    )}
	                    <div className="min-w-0">
	                      <p className="truncate text-xs font-semibold">{videoProcessingPrimaryText}</p>
	                      {videoProcessingName && (
	                        <p className="truncate text-[11px]" style={{ color: '#cbd5e1' }}>{videoProcessingName}</p>
	                      )}
	                    </div>
	                  </div>
	                  <span className="rounded-full px-2 py-1 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
	                    {activeVideoProcessingStage === 'saving' ? 'Saving' : 'Analyzing'}
	                  </span>
	                </div>
	              )}

	              {/* Camera Error */}
	              {cameraError && !showPlaybackForSelectedDate && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4">
                  <Camera className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm max-w-md leading-relaxed">{cameraError}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: '#3b82f6', color: '#fff' }}
                    >
                      <Upload className="w-4 h-4" />
                      Upload Video
                    </button>
                    <button
                      onClick={() => initCamera(recordingMode)}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
                    >
                      Retry
                    </button>
                    <button
                      onClick={openPreviewInNewTab}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      New Tab
                    </button>
                  </div>
                </div>
              )}

              {!cameraReady && !cameraError && !showPlaybackForSelectedDate && !isRecording && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4">
                  <Camera className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm mb-3 opacity-80 max-w-sm leading-relaxed">No polish needed — just talk through what you're working on.</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => initCamera(recordingMode)}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: '#3b82f6' }}
                    >
                      Enable Preview
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
                    >
                      <Upload className="w-4 h-4" />
                      Upload Video
                    </button>
                    <button
                      onClick={openPreviewInNewTab}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      New Tab
                    </button>
                  </div>
                </div>
              )}

              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.9)' }}>
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-sm font-medium">{formatTimer(recordingTime)}</span>
                </div>
              )}
            </div>

            {/* Recording Controls */}
            <div className="flex flex-col items-center gap-3 mt-4">
              {/* Mode Toggle - only show when not recording */}
              {!isRecording && !showPlaybackForSelectedDate && (
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#f5f5f5' }}>
	                  <button
	                    onClick={() => {
	                      if (recordingMode !== 'camera') {
	                        setRecordingMode('camera');
	                        setCameraError('');
	                        setCameraReady(false);
	                      }
	                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: recordingMode === 'camera' ? '#fff' : 'transparent',
                      color: recordingMode === 'camera' ? '#3b82f6' : '#666',
                      boxShadow: recordingMode === 'camera' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    <Camera className="w-4 h-4" />
                    Camera
                  </button>
	                  <button
	                    onClick={() => {
	                      if (recordingMode !== 'screen') {
	                        setRecordingMode('screen');
	                        setCameraError('');
	                        setCameraReady(false);
	                      }
	                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: recordingMode === 'screen' ? '#fff' : 'transparent',
                      color: recordingMode === 'screen' ? '#3b82f6' : '#666',
                      boxShadow: recordingMode === 'screen' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    <Monitor className="w-4 h-4" />
                    Screen
                  </button>
	                  <button
	                    onClick={() => {
	                      if (recordingMode !== 'both') {
	                        setRecordingMode('both');
	                        setCameraError('');
	                        setCameraReady(false);
	                      }
	                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: recordingMode === 'both' ? '#fff' : 'transparent',
                      color: recordingMode === 'both' ? '#3b82f6' : '#666',
                      boxShadow: recordingMode === 'both' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    <div className="relative w-4 h-4">
                      <Monitor className="w-4 h-4 absolute" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-current border border-white" />
                    </div>
                    Both
                  </button>
                </div>
              )}

              <div className="flex items-center gap-4">
              {!isRecording && !showPlaybackForSelectedDate && (
                <>
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all"
                    style={{ background: '#3b82f6' }}
                  >
                    <div className="w-4 h-4 rounded-full bg-white" />
                    Start Recording
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all"
                    style={{ background: '#f5f5f5', color: '#333' }}
                  >
                    <Upload className="w-4 h-4" />
                    Upload Video
                  </button>
                </>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all"
                  style={{ background: '#ef4444' }}
                >
                  <Square className="w-4 h-4 fill-current" />
                  Stop Recording ({formatTimer(recordingTime)})
                </button>
              )}

              {showPlaybackForSelectedDate && (
                <>
                  <button
                    onClick={resetRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all"
                    style={{ background: '#f5f5f5', color: '#333' }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Record Again
                  </button>
                </>
              )}
              </div>

            </div>
          </div>
        ) : (
          /* Existing recording notice */
          <div key={`saved-${dateFilter}`} className="p-5">
            <div
              className="rounded-2xl p-6 text-center"
              style={{ background: '#fff', border: '1px solid #e5e5e5' }}
            >
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#dcfce7' }}>
                <Check className="w-6 h-6" style={{ color: '#16a34a' }} />
              </div>
              <h3 className="font-semibold mb-1" style={{ color: '#111' }}>Recording Saved</h3>
              <p className="text-sm mb-4" style={{ color: '#666' }}>
                You already have a recording for this day. Generate more posts below or record a new one.
              </p>
              <button
                onClick={() => setShowReplaceProgressDialog(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all mx-auto"
                style={{ background: '#f5f5f5', color: '#333' }}
              >
                <RotateCcw className="w-4 h-4" />
                Record New Video
              </button>
              {recordingsForSelectedDate.some(recording => recording.video_url) && (
                <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
                  {recordingsForSelectedDate
                    .filter(recording => recording.video_url)
                    .map(recording => {
                      const recordingActionKey = `${recording.id}:${recording.video_url}`;
                      const isOpeningRecording = openingSavedRecordingKey === recordingActionKey;
                      const isScriptedRecording = isGeneratedScriptRecording(recording);
                      return (
                        <div key={`${dateFilter}-${recording.id}`} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e5', background: '#fafafa' }}>
                          <div className="px-3 py-2">
                            <p className="text-xs font-semibold truncate" style={{ color: '#111' }}>
                              {recording.title || 'Saved video'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openSavedRecordingForInstagram(recording)}
                            disabled={Boolean(openingSavedRecordingKey)}
                            className="group relative block w-full overflow-hidden text-left disabled:opacity-70"
                            style={{ aspectRatio: '16/9', maxHeight: 220, background: '#000' }}
                          >
                            <video
                              src={recording.video_url}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full"
                              style={{ objectFit: 'contain' }}
                            />
                            <div className="absolute inset-0 flex items-end justify-center p-3" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.72))' }}>
                              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ background: 'rgba(59,130,246,0.95)' }}>
                                {isOpeningRecording ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                {isOpeningRecording ? 'Opening...' : isScriptedRecording ? 'Edit + post filmed take' : 'Edit + post to Instagram'}
                              </span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
              {metaError && !showTeleprompter && (
                <p className="mt-3 text-xs" style={{ color: '#dc2626' }}>
                  {metaError}
                </p>
              )}
            </div>
          </div>
        )}

        {shouldShowSavedLinkedInDraft && (
          <div className="px-5 pb-5">
            <div className="rounded-lg p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#111' }}>LinkedIn draft</p>
                  <p className="text-xs mt-1" style={{ color: '#166534' }}>
                    Saved for {formatDisplayDate(selectedDate)}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(linkedinDraftText, savedLinkedInCopyTarget)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100"
                  style={{
                    background: copiedTarget === savedLinkedInCopyTarget ? '#dcfce7' : undefined,
                    color: copiedTarget === savedLinkedInCopyTarget ? '#16a34a' : '#166534',
                  }}
                >
                  {copiedTarget === savedLinkedInCopyTarget ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedTarget === savedLinkedInCopyTarget ? 'Copied' : 'Copy'}
                </button>
              </div>
              <textarea
                value={linkedinDraftText}
                onChange={(event) => handleLinkedInDraftChange(event.target.value)}
                rows={Math.max(8, Math.min(18, linkedinDraftText.split('\n').length + 4))}
                className="w-full resize-y rounded-lg p-3 text-sm leading-relaxed outline-none"
                style={{ color: '#333', background: 'rgba(255,255,255,0.72)', border: '1px solid #bbf7d0' }}
                placeholder="Edit your LinkedIn draft..."
              />
              {linkedinDraftStatusLabel && (
                <p className="text-xs mt-2" style={{ color: linkedinDraftSaveState === 'error' ? '#dc2626' : '#166534' }}>
                  {linkedinDraftStatusLabel}
                </p>
              )}
            </div>
          </div>
        )}

        {shouldShowSavedInstagramScriptDraft && (
          <div className="px-5 pb-5">
            <div className="rounded-lg p-4" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#111' }}>Instagram video script</p>
                  <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                    Saved for {formatDisplayDate(selectedDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openTeleprompterForScript({ title: 'Instagram video script', hook: '', body: instagramScriptDraftText }, instagramScriptDraftText)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ background: '#3b82f6' }}
                  >
                    {scriptActionLabel}
                  </button>
                  <button
                    onClick={() => copyToClipboard(instagramScriptDraftText)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100"
                    style={{ color: '#4b5563' }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
              </div>
              <textarea
                value={instagramScriptDraftText}
                onChange={(event) => handleInstagramScriptDraftChange(event.target.value)}
                rows={Math.max(8, Math.min(18, instagramScriptDraftText.split('\n').length + 4))}
                className="w-full resize-y rounded-lg p-3 text-sm leading-relaxed outline-none"
                style={{ color: '#333', background: '#fff', border: '1px solid #e5e7eb' }}
                placeholder="Edit your Instagram video script..."
              />
              {instagramScriptDraftStatusLabel && (
                <p className="text-xs mt-2" style={{ color: instagramScriptDraftSaveState === 'error' ? '#dc2626' : '#4b5563' }}>
                  {instagramScriptDraftStatusLabel}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Content Plan */}
        {(showPlaybackForSelectedDate || isAnalyzing || videoAnalysis || analysisError) && (
          <div className="px-5 pb-5">
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #bfdbfe', background: '#fff' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #bfdbfe', background: '#f0f7ff' }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: '#3b82f6' }} />
	                  <span className="text-sm font-semibold" style={{ color: '#111' }}>Content plan</span>
                </div>
                {videoAnalysis && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#dbeafe', color: '#2563eb' }}>
	                    {videoAnalysis.contentPotential === 'strong' ? 'Strong idea' : videoAnalysis.contentPotential === 'low' ? 'Needs more detail' : 'Develop into content'}
                  </span>
                )}
              </div>

	              <div className="p-4 flex flex-col gap-4">
	                {isAnalyzing && !videoAnalysis ? (
	                  <div className="rounded-lg p-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
	                    <div className="flex items-start gap-3">
	                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: '#dbeafe', color: '#2563eb' }}>
	                        <Loader2 className="h-4 w-4 animate-spin" />
	                      </div>
	                      <div className="min-w-0">
	                        <p className="text-sm font-semibold" style={{ color: '#111827' }}>{videoProcessingPrimaryText}</p>
	                        <p className="mt-1 text-sm leading-relaxed" style={{ color: '#4b5563' }}>
	                          {videoProcessingSecondaryText}
	                          {videoProcessingName ? ` ${videoProcessingName}` : ''}
	                        </p>
	                      </div>
	                    </div>
	                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
	                      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#fff', border: '1px solid #bfdbfe' }}>
	                        <Check className="h-4 w-4 shrink-0" style={{ color: '#16a34a' }} />
	                        <span className="text-xs font-semibold" style={{ color: '#111827' }}>Video received</span>
	                      </div>
	                      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#fff', border: '1px solid #bfdbfe' }}>
	                        {activeVideoProcessingStage === 'saving' ? (
	                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: '#2563eb' }} />
	                        ) : (
	                          <Check className="h-4 w-4 shrink-0" style={{ color: '#16a34a' }} />
	                        )}
	                        <span className="text-xs font-semibold" style={{ color: '#111827' }}>Saving recording</span>
	                      </div>
	                      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#fff', border: '1px solid #bfdbfe' }}>
	                        {activeVideoProcessingStage === 'analyzing' ? (
	                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: '#2563eb' }} />
	                        ) : (
	                          <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: '#dbeafe' }} />
	                        )}
	                        <span className="text-xs font-semibold" style={{ color: '#111827' }}>Analyzing content</span>
	                      </div>
	                    </div>
	                  </div>
	                ) : analysisError ? (
                  <p className="text-sm" style={{ color: '#ef4444' }}>{analysisError}</p>
	                ) : videoAnalysis ? (
	                  <>
	                    <div className="rounded-lg p-4" style={{ background: videoAnalysis.rawClip.usable ? '#f5f3ff' : '#f9fafb', border: videoAnalysis.rawClip.usable ? '1px solid #ddd6fe' : '1px solid #e5e7eb' }}>
	                      <div className="flex items-start justify-between gap-3">
	                        <div>
	                          <p className="text-sm font-semibold" style={{ color: '#111' }}>
	                            Raw clip recommendation
	                          </p>
	                          <p className="text-sm mt-1 leading-relaxed" style={{ color: '#4b5563' }}>
	                            {videoAnalysis.rawClip.reasoning || (videoAnalysis.rawClip.usable
	                              ? 'This recording has enough structure to become a short social clip after trimming.'
	                              : 'The raw recording is not strong enough as a standalone clip, but the core idea can be developed into the content formats below.')}
	                          </p>
	                          {videoAnalysis.rawClip.hook && videoAnalysis.rawClip.usable && (
	                            <p className="text-sm mt-2 font-medium" style={{ color: '#111' }}>
	                              Hook: {videoAnalysis.rawClip.hook}
	                            </p>
	                          )}
	                        </div>
		                      </div>
	                      {videoAnalysis.rawClip.usable && getClipSegments(videoAnalysis, recordingTime).length > 0 && (
	                        <div className="mt-3 flex flex-wrap gap-2">
	                          {getClipSegments(videoAnalysis, recordingTime).map((segment, index) => (
	                            <span key={index} className="text-xs px-2 py-1 rounded-full" style={{ background: '#ede9fe', color: '#6d28d9' }}>
	                              Keep {Math.round(segment.startSeconds)}s-{Math.round(segment.endSeconds)}s
	                            </span>
	                          ))}
	                        </div>
	                      )}
	                    </div>

		                    <div>
		                      <p className="text-sm font-medium" style={{ color: '#111' }}>
		                        {draftOpportunities.length > 1 ? `Selected: ${getFormatLabel(format)}` : 'Recommendation'}
		                      </p>
		                      <p className="text-sm mt-1" style={{ color: '#4b5563' }}>
		                        {getSelectedFormatReasoning(videoAnalysis, format)}
		                      </p>
		                    </div>

	                    {draftOpportunities.length > 1 && (
	                      <div className="grid gap-2 sm:grid-cols-3">
	                        {draftOpportunities.map((opportunity, index) => (
                          <button
                            key={`${opportunity.format}-${index}`}
                            onClick={() => {
                              setFormat(opportunity.format);
                              window.localStorage.setItem(getSelectedFormatStorageKey(dateFilter), opportunity.format);
                            }}
                            className="text-left rounded-lg p-3 transition-all hover:bg-blue-50"
                            style={{ border: '1px solid #e5e7eb', background: format === opportunity.format ? '#eff6ff' : '#fff' }}
                          >
                            <div className="text-xs font-semibold mb-1" style={{ color: '#2563eb' }}>
                              {getFormatLabel(opportunity.format)}
                            </div>
	                            <div className="text-sm font-medium" style={{ color: '#111' }}>{opportunity.title}</div>
	                            <div className="text-xs mt-1" style={{ color: '#6b7280' }}>{getOpportunityActionLabel(opportunity.format)}</div>
	                          </button>
	                        ))}
	                      </div>
	                    )}

	                    {format === 'linkedin' && videoAnalysis.linkedinPost && (
	                      <div className="rounded-lg p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#111' }}>LinkedIn draft</p>
                            {videoAnalysis.linkedinPost.title && (
                              <p className="text-xs mt-1" style={{ color: '#166534' }}>{videoAnalysis.linkedinPost.title}</p>
                            )}
	                          </div>
	                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(formatEditableLinkedInDraft(videoAnalysis.linkedinPost?.title, linkedinDraftText), contentPlanLinkedInCopyTarget)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100"
                              style={{
                                background: copiedTarget === contentPlanLinkedInCopyTarget ? '#dcfce7' : undefined,
                                color: copiedTarget === contentPlanLinkedInCopyTarget ? '#16a34a' : '#166534',
                              }}
                            >
                              {copiedTarget === contentPlanLinkedInCopyTarget ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              {copiedTarget === contentPlanLinkedInCopyTarget ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
	                        <textarea
	                          value={linkedinDraftText}
	                          onChange={(event) => handleLinkedInDraftChange(event.target.value)}
	                          rows={Math.max(8, Math.min(18, linkedinDraftText.split('\n').length + 4))}
	                          className="w-full resize-y rounded-lg p-3 text-sm leading-relaxed outline-none"
	                          style={{ color: '#333', background: 'rgba(255,255,255,0.72)', border: '1px solid #bbf7d0' }}
	                          placeholder="Edit your LinkedIn draft..."
	                        />
	                        {linkedinDraftStatusLabel && (
	                          <p className="text-xs mt-2" style={{ color: linkedinDraftSaveState === 'error' ? '#dc2626' : '#166534' }}>
	                            {linkedinDraftStatusLabel}
	                          </p>
	                        )}
	                      </div>
	                    )}

	                    {showTeleprompter && teleprompterScript && (
		                      <div id="teleprompter-review-panel" className="rounded-lg overflow-hidden" style={{ background: '#111827', border: '1px solid #1f2937' }}>
	                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ background: '#0f172a', borderBottom: '1px solid #263244' }}>
	                          <div>
	                            <p className="text-sm font-semibold" style={{ color: '#fff' }}>Self-tape recorder</p>
	                            <p className="text-xs mt-1" style={{ color: '#cbd5e1' }}>{teleprompterTitle}</p>
	                          </div>
	                          <div className="flex items-center gap-2">
	                            <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
	                              {(['slow', 'medium', 'fast'] as const).map(speed => (
	                                <button
	                                  key={speed}
	                                  onClick={() => setTeleprompterSpeed(speed)}
	                                  className="px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all"
	                                  style={{
	                                    background: teleprompterSpeed === speed ? '#3b82f6' : 'transparent',
	                                    color: teleprompterSpeed === speed ? '#fff' : '#cbd5e1',
	                                  }}
	                                >
	                                  {speed}
	                                </button>
	                              ))}
	                            </div>
	                            <button
	                              onClick={closeTeleprompter}
	                              className="px-3 py-1.5 rounded-lg text-xs font-medium"
	                              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
	                            >
	                              Close
	                            </button>
	                          </div>
	                        </div>

	                        <div className="p-4">
	                          <div className="mx-auto" style={{ maxWidth: 420 }}>
	                            <div className="relative overflow-hidden rounded-xl" style={{ background: '#000', aspectRatio: '9/16', maxHeight: 620 }}>
	                              <video
	                                ref={teleprompterVideoRef}
	                                autoPlay
	                                muted
	                                playsInline
	                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
	                              />
	                              <div className="absolute inset-x-0 top-0 h-28" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.74), rgba(0,0,0,0))' }} />
	                              <div className="absolute inset-x-0 bottom-0 h-36" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.86), rgba(0,0,0,0))' }} />
	                              <div ref={teleprompterOverlayRef} className="absolute inset-x-5 top-10 bottom-24 overflow-hidden pointer-events-none">
	                                <div
	                                  ref={teleprompterTextRef}
	                                  className="text-center font-semibold whitespace-pre-wrap"
	                                  style={{
	                                    color: '#fff',
	                                    fontSize: 25,
	                                    lineHeight: 1.38,
	                                    textShadow: '0 2px 14px rgba(0,0,0,0.95)',
	                                    transform: `translateY(${teleprompterOffset}px)`,
	                                  }}
	                                >
	                                  {teleprompterScript}
	                                </div>
	                              </div>
	                              {isTeleprompterRecording && (
	                                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(239,68,68,0.92)' }}>
	                                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
	                                  <span className="text-xs font-semibold text-white">{formatTimer(teleprompterRecordingTime)}</span>
	                                </div>
	                              )}
	                              {teleprompterCountdown !== null && (
	                                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.34)' }}>
	                                  <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.92)', color: '#111' }}>
	                                    <span className="text-5xl font-bold">{teleprompterCountdown}</span>
	                                  </div>
	                                </div>
	                              )}
	                              {!teleprompterCameraReady && (
	                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-5" style={{ background: 'rgba(0,0,0,0.76)', color: '#fff' }}>
	                                  <Camera className="w-10 h-10 mb-3 opacity-70" />
	                                  <p className="text-sm mb-3">Record a self-tape with your camera.</p>
	                                  <button
	                                    onClick={initTeleprompterCamera}
	                                    className="px-4 py-2 rounded-lg text-sm font-semibold"
	                                    style={{ background: '#3b82f6', color: '#fff' }}
	                                  >
	                                    Enable camera
	                                  </button>
	                                </div>
	                              )}
	                            </div>

	                            {teleprompterError && (
	                              <div className="mt-3 rounded-lg p-3" style={{ background: '#fee2e2', color: '#991b1b' }}>
	                                <p className="text-sm">{teleprompterError}</p>
	                                {window.self !== window.top && (
	                                  <button
	                                    onClick={openPreviewInNewTab}
	                                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
	                                    style={{ background: '#fff', color: '#991b1b' }}
	                                  >
	                                    <ExternalLink className="w-3.5 h-3.5" />
	                                    New Tab
	                                  </button>
	                                )}
	                              </div>
	                            )}

	                            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
	                              {!isTeleprompterRecording && teleprompterCountdown === null ? (
	                                <button
	                                  onClick={startTeleprompterRecording}
	                                  disabled={!teleprompterCameraReady}
	                                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
	                                  style={{ background: '#ef4444', color: '#fff' }}
	                                >
	                                  <span className="w-3 h-3 rounded-full bg-white" />
	                                  Start self-tape
	                                </button>
	                              ) : (
	                                <button
	                                  onClick={stopTeleprompterRecording}
	                                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
	                                  style={{ background: '#fff', color: '#ef4444' }}
	                                >
	                                  <Square className="w-4 h-4 fill-current" />
	                                  {teleprompterCountdown !== null ? 'Cancel' : 'Stop'}
	                                </button>
	                              )}
	                              {teleprompterRecordingUrl && (
	                                <button
	                                  onClick={clearTeleprompterRecording}
	                                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
	                                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
	                                >
	                                  <RotateCcw className="w-4 h-4" />
	                                  Record again
	                                </button>
	                              )}
	                            </div>
	                          </div>

	                          {teleprompterRecordingUrl && (
	                            <div className="mx-auto mt-4 rounded-lg overflow-hidden" style={{ maxWidth: 620, background: '#020617', border: '1px solid rgba(255,255,255,0.14)' }}>
	                              <div className="flex items-center justify-between gap-3 px-4 py-3">
	                                <p className="text-sm font-semibold" style={{ color: '#fff' }}>Review recording</p>
	                                <div className="flex flex-wrap items-center justify-end gap-2">
	                                  <button
	                                    onClick={metaConnected ? publishTeleprompterVideoToInstagram : startMetaSignIn}
	                                    disabled={teleprompterReviewActionDisabled}
	                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
	                                    style={{ background: instagramPublishSuccess ? '#16a34a' : '#3b82f6', color: '#fff' }}
	                                  >
	                                    {(isPublishingInstagram || isMetaSigningIn || isRenderingTeleprompterEdit) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
	                                    {instagramPublishSuccess
	                                      ? 'Posted'
	                                      : isRenderingTeleprompterEdit
	                                        ? 'Rendering...'
	                                      : metaConnected
	                                        ? isPublishingInstagram ? 'Posting...' : 'Post to Instagram'
	                                        : isMetaSigningIn ? 'Connecting...' : 'Connect Instagram'}
	                                  </button>
	                                  <button
	                                    type="button"
	                                    title="Schedule Instagram post"
	                                    onClick={openInstagramScheduleDialog}
	                                    disabled={teleprompterReviewActionDisabled}
	                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold disabled:opacity-60"
	                                    style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
	                                  >
	                                    {isSchedulingInstagram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
	                                  </button>
	                                  <button
	                                    type="button"
	                                    onClick={downloadTeleprompterReviewVideo}
	                                    disabled={teleprompterReviewActionDisabled}
	                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
	                                    style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
	                                  >
	                                    {isRenderingTeleprompterEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
	                                    {isRenderingTeleprompterEdit ? 'Rendering...' : 'Save to device'}
	                                  </button>
	                                </div>
	                              </div>
	                              {(metaConnected || showScheduleDialog) && (
	                                <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
	                                  <label className="block">
	                                    <span className="text-xs font-semibold" style={{ color: '#cbd5e1' }}>Caption</span>
	                                    <textarea
	                                      value={instagramCaption}
	                                      onChange={(event) => {
	                                        setInstagramCaption(event.target.value);
	                                        setInstagramPublishSuccess(false);
	                                        setInstagramScheduleStatus('');
	                                      }}
	                                      rows={4}
	                                      className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
	                                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff' }}
	                                      placeholder="Write a caption for Instagram..."
	                                    />
	                                  </label>
	                                  <label className="block">
	                                    <span className="text-xs font-semibold" style={{ color: '#cbd5e1' }}>Hashtags</span>
	                                    <textarea
	                                      value={instagramHashtags}
	                                      onChange={(event) => {
	                                        setInstagramHashtags(event.target.value);
	                                        setInstagramPublishSuccess(false);
	                                        setInstagramScheduleStatus('');
	                                      }}
	                                      rows={4}
	                                      className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
	                                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff' }}
	                                      placeholder="#buildinpublic #founderjourney #startup"
	                                    />
	                                  </label>
	                                </div>
	                              )}
	                              {showScheduleDialog && (
	                                <div className="mx-4 mb-4 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
	                                  <div className="flex flex-wrap items-end gap-3">
	                                    <label className="min-w-[220px] flex-1">
	                                      <span className="text-xs font-semibold" style={{ color: '#cbd5e1' }}>Schedule for</span>
	                                      <input
	                                        type="datetime-local"
	                                        value={scheduledDateTime}
	                                        onChange={(event) => {
	                                          setScheduledDateTime(event.target.value);
	                                          setInstagramScheduleStatus('');
	                                          setMetaError('');
	                                        }}
	                                        className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
	                                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff' }}
	                                      />
	                                    </label>
	                                    <div className="flex items-center gap-2">
	                                      <button
	                                        type="button"
	                                        onClick={() => setShowScheduleDialog(false)}
	                                        disabled={isSchedulingInstagram}
	                                        className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
	                                        style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
	                                      >
	                                        Cancel
	                                      </button>
	                                      <button
	                                        type="button"
	                                        onClick={scheduleTeleprompterVideoToInstagram}
	                                        disabled={teleprompterReviewActionDisabled}
	                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
	                                        style={{ background: '#3b82f6', color: '#fff' }}
	                                      >
	                                        {(isSchedulingInstagram || isRenderingTeleprompterEdit) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
	                                        {isRenderingTeleprompterEdit ? 'Rendering...' : isSchedulingInstagram ? 'Scheduling...' : 'Schedule'}
	                                      </button>
	                                    </div>
	                                  </div>
	                                  <p className="mt-2 text-xs" style={{ color: '#94a3b8' }}>
	                                    Bipp will upload this recording now and publish it to Instagram at the selected time.
	                                  </p>
	                                </div>
	                              )}
	                              <div className="px-4 pb-4 space-y-4">
	                                <div className="flex justify-center">
	                                  <div className="relative w-full overflow-hidden rounded-[24px]" style={{ maxWidth: 300, aspectRatio: '9 / 16', background: '#000', boxShadow: '0 18px 45px rgba(0,0,0,0.34)' }}>
	                                    <video
	                                      ref={teleprompterReviewVideoRef}
	                                      src={teleprompterRecordingUrl}
	                                      playsInline
	                                      onLoadedMetadata={handleTeleprompterReviewMetadata}
	                                      onTimeUpdate={handleTeleprompterPreviewTimeUpdate}
	                                      onPlay={() => setTeleprompterPreviewPlaying(true)}
	                                      onPause={() => setTeleprompterPreviewPlaying(false)}
	                                      className="absolute inset-0 h-full w-full"
	                                      style={{ objectFit: 'cover', background: '#000' }}
	                                    />
	                                    <div className="absolute inset-x-0 top-0 h-24" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0))' }} />
	                                    <div className="absolute inset-x-0 bottom-0 h-36" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.82), rgba(0,0,0,0))' }} />
	                                    <div className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'rgba(0,0,0,0.62)', color: '#fff' }}>
	                                      {formatTrimTime(teleprompterCurrentTime)}
	                                    </div>
	                                    <button
	                                      type="button"
	                                      onClick={toggleTeleprompterPreviewPlayback}
	                                      className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
	                                      style={{ background: 'rgba(255,255,255,0.9)', color: '#111827', boxShadow: '0 10px 30px rgba(0,0,0,0.28)' }}
	                                    >
	                                      {teleprompterPreviewPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
	                                    </button>
	                                    {(teleprompterCaptionPreview || isGeneratingTeleprompterCc) && (
	                                      <div className="pointer-events-none absolute inset-x-4 bottom-20 flex justify-center">
	                                        <div
	                                          className="max-w-full rounded-xl px-4 py-2 text-center text-lg font-extrabold leading-snug"
	                                          style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.95)' }}
	                                        >
	                                          {teleprompterCaptionPreview || 'Generating captions...'}
	                                        </div>
	                                      </div>
	                                    )}
	                                  </div>
	                                </div>

	                                <div className="space-y-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}>
	                                  <div className="flex flex-wrap items-center justify-between gap-3">
	                                    <div className="flex items-center gap-2">
	                                      <button
	                                        type="button"
	                                        onClick={toggleTeleprompterPreviewPlayback}
	                                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
	                                        style={{ background: '#fff', color: '#111827' }}
	                                      >
	                                        {teleprompterPreviewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
	                                        {teleprompterPreviewPlaying ? 'Pause' : 'Play'}
	                                      </button>
	                                      <button
	                                        type="button"
	                                        onClick={undoTeleprompterEdit}
	                                        disabled={!canUndoTeleprompterEdit}
	                                        title="Undo edit"
	                                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
	                                        style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
	                                      >
	                                        <Undo2 className="w-3.5 h-3.5" />
	                                        Undo
	                                      </button>
	                                      <button
	                                        type="button"
	                                        onClick={redoTeleprompterEdit}
	                                        disabled={!canRedoTeleprompterEdit}
	                                        title="Redo edit"
	                                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
	                                        style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
	                                      >
	                                        <Redo2 className="w-3.5 h-3.5" />
	                                        Redo
	                                      </button>
	                                      <button
	                                        type="button"
	                                        onClick={addTeleprompterSplitAtPlayhead}
	                                        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
	                                        style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
	                                      >
	                                        <Scissors className="w-3.5 h-3.5" />
	                                        Split
	                                      </button>
	                                    </div>
	                                    <p className="text-xs" style={{ color: '#cbd5e1' }}>
	                                      {formatTrimTime(teleprompterReviewTrimRange.start)}-{formatTrimTime(teleprompterReviewTrimRange.end)} · {formatTrimTime(teleprompterTrimmedDuration)}
	                                      {teleprompterEditSaveLabel && <span> · {teleprompterEditSaveLabel}</span>}
	                                    </p>
	                                  </div>

	                                  <div
	                                    ref={teleprompterTimelineRef}
	                                    onPointerDown={handleTeleprompterTimelineSeek}
	                                    className="relative h-24 cursor-pointer select-none overflow-hidden rounded-xl"
	                                    style={{ background: '#0f172a', touchAction: 'none' }}
	                                  >
	                                    <div className="absolute inset-0 flex">
	                                      {teleprompterTimelineCells.map((frame, index) => (
	                                        <div
	                                          key={`${frame}-${index}`}
	                                          className="h-full flex-1"
	                                          style={{
	                                            backgroundImage: frame.startsWith('data:') ? `url(${frame})` : 'linear-gradient(135deg, #1f2937, #020617)',
	                                            backgroundSize: 'cover',
	                                            backgroundPosition: 'center',
	                                            borderRight: index === teleprompterTimelineCells.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.12)',
	                                          }}
	                                        />
	                                      ))}
	                                    </div>
	                                    <div
	                                      className="absolute inset-y-1 rounded-lg"
	                                      style={{
	                                        left: `${teleprompterTrimStartPercent}%`,
	                                        width: `${Math.max(1, teleprompterTrimEndPercent - teleprompterTrimStartPercent)}%`,
	                                        border: '2px solid #f8fafc',
	                                        boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.85)',
	                                      }}
	                                    />
	                                    {teleprompterClipSegmentsForReview.map((segment, index) => {
	                                      const metric = teleprompterSegmentTimelineMetrics.find(item => item.id === segment.id);
	                                      const left = metric?.left || 0;
	                                      const width = metric?.width || 100;
	                                      const isSelected = segment.id === activeTeleprompterClipKey;
	                                      return (
	                                      <button
	                                        key={segment.id}
	                                        type="button"
	                                        data-timeline-control="true"
	                                        onClick={(event) => {
	                                          event.stopPropagation();
	                                          selectTeleprompterClipSegment(segment.id);
	                                        }}
	                                        className="absolute bottom-2 top-2 rounded-lg"
	                                        style={{
	                                          left: `${left}%`,
	                                          width: `${width}%`,
	                                          border: isSelected ? '2px solid #38bdf8' : '1px solid rgba(250,204,21,0.8)',
	                                          background: isSelected ? 'rgba(56,189,248,0.18)' : 'rgba(250,204,21,0.12)',
	                                        }}
	                                        title={`Clip ${index + 1}`}
	                                      />
	                                      );
	                                    })}
	                                    <button
	                                      type="button"
	                                      data-timeline-control="true"
	                                      onPointerDown={startTeleprompterTimelineDrag('playhead')}
	                                      className="absolute top-0 bottom-0 w-0.5"
	                                      style={{ left: `${teleprompterPlayheadPercent}%`, background: '#38bdf8', transform: 'translateX(-50%)' }}
	                                      title="Drag playhead"
	                                    >
	                                      <span className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full" style={{ background: '#38bdf8' }} />
	                                    </button>
	                                    <button
	                                      type="button"
	                                      data-timeline-control="true"
	                                      onPointerDown={startTeleprompterTimelineDrag('start')}
	                                      className="absolute top-1/2 h-16 w-4 -translate-y-1/2 rounded-full"
	                                      style={{ left: `${teleprompterTrimStartPercent}%`, background: '#fff', transform: 'translate(-50%, -50%)', boxShadow: '0 6px 16px rgba(0,0,0,0.35)' }}
	                                      title="Trim start"
	                                    />
	                                    <button
	                                      type="button"
	                                      data-timeline-control="true"
	                                      onPointerDown={startTeleprompterTimelineDrag('end')}
	                                      className="absolute top-1/2 h-16 w-4 -translate-y-1/2 rounded-full"
	                                      style={{ left: `${teleprompterTrimEndPercent}%`, background: '#fff', transform: 'translate(-50%, -50%)', boxShadow: '0 6px 16px rgba(0,0,0,0.35)' }}
	                                      title="Trim end"
	                                    />
	                                  </div>

	                                  <div className="flex flex-wrap gap-2">
	                                    {teleprompterClipSegmentsForReview.map((segment, index) => {
	                                      const isSelected = segment.id === activeTeleprompterClipKey;
	                                      return (
	                                        <button
	                                          key={segment.id}
	                                          type="button"
	                                          onClick={() => selectTeleprompterClipSegment(segment.id)}
	                                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
	                                          style={{
	                                            background: isSelected ? '#3b82f6' : 'rgba(255,255,255,0.1)',
	                                            color: '#fff',
	                                          }}
	                                        >
	                                          Clip {index + 1} · {formatTrimTime(segment.end - segment.start)}
	                                        </button>
	                                      );
	                                    })}
	                                    {teleprompterClipSegmentsForReview.length > 1 && (
	                                      <span className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1' }}>
	                                        Final {formatTrimTime(teleprompterFinalClipDuration)}
	                                      </span>
	                                    )}
	                                  </div>
	                                </div>

	                                <div className="grid grid-cols-3 gap-2">
	                                  <button
	                                    type="button"
	                                    onClick={() => setTeleprompterEditorTool('clip')}
	                                    className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-xs font-semibold"
	                                    style={{ background: teleprompterEditorTool === 'clip' ? '#fff' : 'rgba(255,255,255,0.08)', color: teleprompterEditorTool === 'clip' ? '#111827' : '#fff' }}
	                                  >
	                                    <Scissors className="h-4 w-4" />
	                                    Clip
	                                  </button>
	                                  <button
	                                    type="button"
	                                    onClick={() => setTeleprompterEditorTool('captions')}
	                                    className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-xs font-semibold"
	                                    style={{ background: teleprompterEditorTool === 'captions' ? '#fff' : 'rgba(255,255,255,0.08)', color: teleprompterEditorTool === 'captions' ? '#111827' : '#fff' }}
	                                  >
	                                    <Sparkles className="h-4 w-4" />
	                                    Captions
	                                  </button>
	                                  <button
	                                    type="button"
	                                    onClick={clearTeleprompterRecording}
	                                    className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-xs font-semibold"
	                                    style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
	                                  >
	                                    <RotateCcw className="h-4 w-4" />
	                                    Retake
	                                  </button>
	                                </div>

	                                {teleprompterEditorTool === 'captions' && (
	                                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="rounded-full px-2 py-1 text-[11px] font-semibold" style={{ background: teleprompterCcEnabled ? '#16a34a' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
                                          CC {teleprompterCcEnabled ? 'On' : 'Off'}
                                        </span>
                                        {isGeneratingTeleprompterCc && <span className="text-xs" style={{ color: '#bfdbfe' }}>Generating...</span>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {isGeneratingTeleprompterCc ? (
                                          <button
                                            type="button"
                                            onClick={() => cancelTeleprompterCaptions()}
                                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                                            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                                          >
                                            <X className="h-3.5 w-3.5" />
                                            Cancel CC
                                          </button>
                                        ) : teleprompterCcText.trim() ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => setTeleprompterCcEnabled(enabled => !enabled)}
                                              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                                              style={{ background: teleprompterCcEnabled ? '#3b82f6' : 'rgba(255,255,255,0.1)', color: '#fff' }}
                                            >
                                              {teleprompterCcEnabled ? 'Hide CC' : 'Show CC'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => cancelTeleprompterCaptions()}
                                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                                              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                                              title="Remove captions"
                                            >
                                              <X className="h-4 w-4" />
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => teleprompterRecordingBlob && generateTeleprompterAutoCaptions(teleprompterRecordingBlob)}
                                            disabled={!teleprompterRecordingBlob}
                                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                                            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                                          >
                                            <Sparkles className="h-3.5 w-3.5" />
                                            Generate captions
                                          </button>
                                        )}
                                      </div>
                                    </div>
	                                    <textarea
	                                      value={teleprompterCcText}
	                                      onChange={(event) => handleTeleprompterCcTextChange(event.target.value)}
	                                      rows={3}
	                                      className="mt-3 w-full rounded-lg px-3 py-2 text-sm outline-none"
	                                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff' }}
	                                      placeholder="Captions will appear here after recording..."
	                                    />
	                                    {teleprompterCcError && (
	                                      <p className="mt-2 text-xs" style={{ color: '#fca5a5' }}>{teleprompterCcError}</p>
	                                    )}
	                                  </div>
	                                )}

	                                {isRenderingTeleprompterEdit ? (
	                                  <p className="text-xs" style={{ color: '#bfdbfe' }}>
	                                    Rendering the trimmed video with captions...
	                                  </p>
	                                ) : teleprompterReviewHasEdits ? (
	                                  <p className="text-xs" style={{ color: '#94a3b8' }}>
	                                    Trim and CC edits will be applied when you post, schedule, or save.
	                                  </p>
	                                ) : null}
	                              </div>
	                              {teleprompterRecordingBlob && (
	                                <p className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>
	                                  {formatTimer(teleprompterRecordingTime)} · {(teleprompterRecordingBlob.size / 1024 / 1024).toFixed(1)} MB · {getVideoExtension(teleprompterRecordingMimeType).toUpperCase()}
	                                </p>
	                              )}
	                              {instagramPublishSuccess && (
	                                <p className="px-4 pb-3 text-xs" style={{ color: '#86efac' }}>
	                                  Posted to Instagram{instagramPostId ? ` (${instagramPostId})` : ''}.
	                                </p>
	                              )}
	                              {instagramScheduleStatus && (
	                                <p className="px-4 pb-3 text-xs" style={{ color: '#bfdbfe' }}>
	                                  {instagramScheduleStatus}
	                                </p>
	                              )}
	                              {metaError && (
	                                <p className="px-4 pb-3 text-xs" style={{ color: '#fca5a5' }}>
	                                  {metaError}
	                                </p>
	                              )}
	                            </div>
	                          )}
	                        </div>
	                      </div>
	                    )}

	                    {format === 'instagram-video' && videoAnalysis.script && (
	                      <div className="rounded-lg p-4" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
	                        <div className="flex items-center justify-between gap-3 mb-3">
	                          <div>
	                            <p className="text-sm font-semibold" style={{ color: '#111' }}>Follow-up video script</p>
	                            {videoAnalysis.script.hook && (
	                              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Hook: {videoAnalysis.script.hook}</p>
	                            )}
	                          </div>
	                          <div className="flex items-center gap-2">
	                            <button
	                              onClick={() => openTeleprompterForScript(videoAnalysis.script!, instagramScriptDraftText)}
	                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
	                              style={{ background: '#3b82f6' }}
	                            >
	                              {scriptActionLabel}
	                            </button>
	                            <button
	                              onClick={() => copyToClipboard(formatEditableScriptDraft(videoAnalysis.script, instagramScriptDraftText))}
	                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100"
	                              style={{ color: '#4b5563' }}
	                            >
	                              <Copy className="w-3.5 h-3.5" />
	                              Copy
	                            </button>
	                          </div>
	                        </div>
	                        <textarea
	                          value={instagramScriptDraftText}
	                          onChange={(event) => handleInstagramScriptDraftChange(event.target.value)}
	                          rows={Math.max(8, Math.min(18, instagramScriptDraftText.split('\n').length + 4))}
	                          className="w-full resize-y rounded-lg p-3 text-sm leading-relaxed outline-none"
	                          style={{ color: '#333', background: '#fff', border: '1px solid #e5e7eb' }}
	                          placeholder="Edit your Instagram video script..."
	                        />
	                        {instagramScriptDraftStatusLabel && (
	                          <p className="text-xs mt-2" style={{ color: instagramScriptDraftSaveState === 'error' ? '#dc2626' : '#4b5563' }}>
	                            {instagramScriptDraftStatusLabel}
	                          </p>
	                        )}
	                      </div>
	                    )}

	                    {format === 'instagram-carousel' && (videoAnalysis.carousel || carouselSlides.length > 0) && (
	                      <div className="rounded-lg overflow-hidden" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
	                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: '1px solid #fed7aa', background: '#ffedd5' }}>
	                          <div>
	                            <p className="text-sm font-semibold" style={{ color: '#111' }}>Editable Instagram carousel</p>
	                            <p className="text-xs mt-1" style={{ color: '#9a3412' }}>
	                              {carouselSlides.length ? `${carouselSlides.length} slides ready to edit` : 'Generate slides from the idea in this video'}
	                            </p>
	                          </div>
	                          <div className="flex flex-wrap items-center gap-2">
	                            <button
	                              type="button"
	                              onClick={generateCarouselWithSlidesApi}
	                              disabled={carouselActionDisabled}
	                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
	                              style={{ background: '#fff', color: '#9a3412', border: '1px solid #fed7aa' }}
	                            >
	                              {isGeneratingCarousel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
	                              {carouselSlides.length ? 'Regenerate' : 'Generate'}
	                            </button>
	                            <button
	                              type="button"
	                              onClick={() => copyToClipboard(getCarouselDraftText(carouselDraftTitle || videoAnalysis.carousel?.title || '', carouselSlides.length ? carouselSlides : (videoAnalysis.carousel?.slides || []).map((slide, index) => ({ id: createSlideId(index), title: slide.title, body: slide.body }))))}
	                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
	                              style={{ background: '#fff', color: '#9a3412', border: '1px solid #fed7aa' }}
	                            >
	                              <Copy className="w-3.5 h-3.5" />
	                              Copy
	                            </button>
	                            <button
	                              type="button"
	                              onClick={downloadCarouselImages}
	                              disabled={!carouselSlides.length || carouselActionDisabled}
	                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
	                              style={{ background: '#fff', color: '#9a3412', border: '1px solid #fed7aa' }}
	                            >
	                              <Download className="w-3.5 h-3.5" />
	                              PNGs
	                            </button>
	                            <button
	                              type="button"
	                              onClick={metaConnected ? publishCarouselToInstagram : startMetaSignIn}
	                              disabled={!carouselSlides.length || carouselActionDisabled}
	                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
	                              style={{ background: carouselPublishSuccess ? '#16a34a' : '#f97316' }}
	                            >
	                              {(isPublishingCarousel || isMetaSigningIn) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
	                              {carouselPublishSuccess
	                                ? 'Posted'
	                                : metaConnected
	                                  ? isPublishingCarousel ? 'Posting...' : 'Post to Instagram'
	                                  : isMetaSigningIn ? 'Connecting...' : 'Connect Instagram'}
	                            </button>
	                          </div>
	                        </div>

	                        <div className="grid gap-4 p-4 lg:grid-cols-[320px_1fr]">
	                          <div>
                            <div className="mx-auto overflow-hidden rounded-xl shadow-sm" style={{ width: 'min(100%, 320px)', aspectRatio: '4/5', background: `linear-gradient(135deg, ${carouselTheme.bgFrom} 0%, ${carouselTheme.bgMid} 52%, ${carouselTheme.bgTo} 100%)`, border: '1px solid #fed7aa', position: 'relative', fontFamily: carouselTheme.fontStack }}>
                              <div style={{ position: 'absolute', right: -56, top: -56, width: 150, height: 150, borderRadius: '9999px', background: 'rgba(59,130,246,0.14)' }} />
                              <div style={{ position: 'absolute', left: -76, bottom: -76, width: 190, height: 190, borderRadius: '9999px', background: hexWithAlpha(carouselTheme.accent, 0.16) }} />
                              {activeCarouselSlide ? (
                                <div className="relative z-10 flex h-full flex-col p-6">
                                  <div className="mb-5 flex items-center justify-between">
                                    <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: carouselTheme.accent, color: '#fff' }}>
                                      {carouselActiveSlide + 1}/{carouselSlides.length}
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: carouselTheme.subtitleColor }}>Bipp</span>
                                  </div>
                                  <p className="mb-3 text-xs font-bold uppercase" style={{ color: carouselTheme.subtitleColor, letterSpacing: 0 }}>
                                    {carouselDraftTitle || videoAnalysis.carousel?.title || 'Instagram carousel'}
                                  </p>
                                  <h3 className="font-black leading-tight" style={{ color: carouselTheme.titleColor, letterSpacing: 0, fontSize: Math.round(carouselTheme.titleSize * 0.3) }}>
                                    {activeCarouselSlide.title}
                                  </h3>
                                  <p className="mt-4 whitespace-pre-line font-medium leading-relaxed" style={{ color: carouselTheme.bodyColor, fontSize: Math.round(carouselTheme.bodySize * 0.3) }}>
                                    {activeCarouselSlide.body}
                                  </p>
                                  <div className="mt-auto flex gap-1">
                                    {carouselSlides.map((slide, index) => (
                                      <span
                                        key={slide.id}
                                        className="h-1.5 rounded-full"
                                        style={{ width: index === carouselActiveSlide ? 22 : 8, background: index === carouselActiveSlide ? carouselTheme.accent : hexWithAlpha(carouselTheme.accent, 0.4) }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="relative z-10 flex h-full flex-col items-center justify-center p-6 text-center">
                                  <Sparkles className="w-8 h-8 mb-3" style={{ color: carouselTheme.accent }} />
	                                  <p className="text-sm font-semibold" style={{ color: '#111827' }}>Generate editable slides from this idea.</p>
	                                </div>
	                              )}
	                            </div>
	                            {carouselSlides.length > 0 && (
	                              <div className="mt-3 flex items-center justify-center gap-2">
	                                <button
	                                  type="button"
	                                  onClick={() => setCarouselActiveSlide(index => Math.max(0, index - 1))}
	                                  className="h-8 w-8 rounded-lg"
	                                  style={{ background: '#fff', border: '1px solid #fed7aa', color: '#9a3412' }}
	                                >
	                                  <ChevronLeft className="mx-auto h-4 w-4" />
	                                </button>
	                                <button
	                                  type="button"
	                                  onClick={() => setCarouselActiveSlide(index => Math.min(carouselSlides.length - 1, index + 1))}
	                                  className="h-8 w-8 rounded-lg"
	                                  style={{ background: '#fff', border: '1px solid #fed7aa', color: '#9a3412' }}
	                                >
	                                  <ChevronRight className="mx-auto h-4 w-4" />
	                                </button>
	                              </div>
	                            )}
	                          </div>

	                          <div className="space-y-3">
	                            <label className="block">
	                              <span className="text-xs font-semibold" style={{ color: '#9a3412' }}>Carousel title</span>
	                              <input
	                                value={carouselDraftTitle}
	                                onChange={(event) => updateCarouselTitle(event.target.value)}
	                                className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
	                                style={{ background: '#fff', border: '1px solid #fed7aa', color: '#111' }}
	                                placeholder="Name this carousel..."
	                              />
	                            </label>

	                            <details className="rounded-lg" style={{ background: '#fff', border: '1px solid #fed7aa' }}>
	                              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold" style={{ color: '#9a3412' }}>
	                                <span className="inline-flex items-center gap-1.5">
	                                  <Sparkles className="h-3.5 w-3.5" />
	                                  Customize with agent
	                                </span>
	                              </summary>
	                              <div className="space-y-2 p-3">
	                                <label className="block">
	                                  <span className="text-xs font-medium" style={{ color: '#9a3412' }}>Brand guidelines / prompt</span>
	                                  <textarea
	                                    value={carouselBrandGuidance}
	                                    onChange={(event) => updateCarouselBrandGuidance(event.target.value)}
	                                    rows={3}
	                                    className="mt-1 w-full resize-y rounded-lg px-3 py-2 text-xs leading-relaxed outline-none"
	                                    style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#111' }}
	                                    placeholder="Direct founder voice, no jargon, punchy slide titles, mention B2B operators, use the brand CTA."
	                                  />
	                                </label>
	                                <div className="flex flex-wrap items-center gap-2">
	                                  <button
	                                    type="button"
	                                    onClick={generateCarouselWithSlidesApi}
	                                    disabled={!carouselBrandGuidance.trim() || carouselActionDisabled}
	                                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60"
	                                    style={{ background: '#f97316', color: '#fff' }}
	                                  >
	                                    {isGeneratingCarousel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
	                                    Apply prompt
	                                  </button>
	                                  {carouselBrandGuidance.trim() && (
	                                    <button
	                                      type="button"
	                                      onClick={() => updateCarouselBrandGuidance('')}
	                                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
	                                      style={{ background: '#fff', color: '#9a3412', border: '1px solid #fed7aa' }}
	                                    >
	                                      <X className="h-3 w-3" />
	                                      Clear
	                                    </button>
	                                  )}
	                                </div>
	                              </div>
	                            </details>

	                            <details className="rounded-lg" style={{ background: '#fff', border: '1px solid #fed7aa' }}>
	                              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold" style={{ color: '#9a3412' }}>
	                                Theme &amp; typography
	                              </summary>
	                              <div className="space-y-3 p-3">
	                                <label className="block">
	                                  <span className="text-xs font-medium" style={{ color: '#9a3412' }}>Font</span>
	                                  <select
	                                    value={carouselTheme.fontLabel}
	                                    onChange={(event) => {
	                                      const font = CAROUSEL_FONTS.find(f => f.label === event.target.value);
	                                      if (font) {
	                                        ensureCarouselFontLoaded({ ...carouselTheme, fontStack: font.stack, googleFamily: font.googleFamily, fontLabel: font.label });
	                                        updateCarouselTheme({ fontLabel: font.label, fontStack: font.stack, googleFamily: font.googleFamily });
	                                      }
	                                    }}
	                                    className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
	                                    style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#111' }}
	                                  >
	                                    {CAROUSEL_FONTS.map(font => (
	                                      <option key={font.label} value={font.label}>{font.label}</option>
	                                    ))}
	                                  </select>
	                                </label>

	                                <div>
	                                  <span className="text-xs font-medium" style={{ color: '#9a3412' }}>Title size: {carouselTheme.titleSize}px</span>
	                                  <input
	                                    type="range"
	                                    min={48}
	                                    max={110}
	                                    step={1}
	                                    value={carouselTheme.titleSize}
	                                    onChange={(event) => updateCarouselTheme({ titleSize: Number(event.target.value) })}
	                                    className="mt-1 w-full"
	                                  />
	                                </div>

	                                <div>
	                                  <span className="text-xs font-medium" style={{ color: '#9a3412' }}>Body size: {carouselTheme.bodySize}px</span>
	                                  <input
	                                    type="range"
	                                    min={28}
	                                    max={64}
	                                    step={1}
	                                    value={carouselTheme.bodySize}
	                                    onChange={(event) => updateCarouselTheme({ bodySize: Number(event.target.value) })}
	                                    className="mt-1 w-full"
	                                  />
	                                </div>

	                                <div className="grid grid-cols-2 gap-2">
	                                  <label className="block">
	                                    <span className="text-xs font-medium" style={{ color: '#9a3412' }}>Accent</span>
	                                    <input
	                                      type="color"
	                                      value={carouselTheme.accent}
	                                      onChange={(event) => updateCarouselTheme({ accent: event.target.value })}
	                                      className="mt-1 h-8 w-full rounded cursor-pointer"
	                                      style={{ border: '1px solid #fed7aa' }}
	                                    />
	                                  </label>
	                                  <label className="block">
	                                    <span className="text-xs font-medium" style={{ color: '#9a3412' }}>Subtitle</span>
	                                    <input
	                                      type="color"
	                                      value={carouselTheme.subtitleColor}
	                                      onChange={(event) => updateCarouselTheme({ subtitleColor: event.target.value })}
	                                      className="mt-1 h-8 w-full rounded cursor-pointer"
	                                      style={{ border: '1px solid #fed7aa' }}
	                                    />
	                                  </label>
	                                  <label className="block">
	                                    <span className="text-xs font-medium" style={{ color: '#9a3412' }}>Title text</span>
	                                    <input
	                                      type="color"
	                                      value={carouselTheme.titleColor}
	                                      onChange={(event) => updateCarouselTheme({ titleColor: event.target.value })}
	                                      className="mt-1 h-8 w-full rounded cursor-pointer"
	                                      style={{ border: '1px solid #fed7aa' }}
	                                    />
	                                  </label>
	                                  <label className="block">
	                                    <span className="text-xs font-medium" style={{ color: '#9a3412' }}>Body text</span>
	                                    <input
	                                      type="color"
	                                      value={carouselTheme.bodyColor}
	                                      onChange={(event) => updateCarouselTheme({ bodyColor: event.target.value })}
	                                      className="mt-1 h-8 w-full rounded cursor-pointer"
	                                      style={{ border: '1px solid #fed7aa' }}
	                                    />
	                                  </label>
	                                </div>

	                                <div className="grid grid-cols-3 gap-2">
	                                  <label className="block">
	                                    <span className="text-xs font-medium" style={{ color: '#9a3412' }}>BG top</span>
	                                    <input
	                                      type="color"
	                                      value={carouselTheme.bgFrom}
	                                      onChange={(event) => updateCarouselTheme({ bgFrom: event.target.value })}
	                                      className="mt-1 h-8 w-full rounded cursor-pointer"
	                                      style={{ border: '1px solid #fed7aa' }}
	                                    />
	                                  </label>
	                                  <label className="block">
	                                    <span className="text-xs font-medium" style={{ color: '#9a3412' }}>BG mid</span>
	                                    <input
	                                      type="color"
	                                      value={carouselTheme.bgMid}
	                                      onChange={(event) => updateCarouselTheme({ bgMid: event.target.value })}
	                                      className="mt-1 h-8 w-full rounded cursor-pointer"
	                                      style={{ border: '1px solid #fed7aa' }}
	                                    />
	                                  </label>
	                                  <label className="block">
	                                    <span className="text-xs font-medium" style={{ color: '#9a3412' }}>BG bottom</span>
	                                    <input
	                                      type="color"
	                                      value={carouselTheme.bgTo}
	                                      onChange={(event) => updateCarouselTheme({ bgTo: event.target.value })}
	                                      className="mt-1 h-8 w-full rounded cursor-pointer"
	                                      style={{ border: '1px solid #fed7aa' }}
	                                    />
	                                  </label>
	                                </div>

	                                <button
	                                  type="button"
	                                  onClick={() => updateCarouselTheme({ ...DEFAULT_CAROUSEL_THEME })}
	                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
	                                  style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}
	                                >
	                                  <RotateCcw className="w-3 h-3" />
	                                  Reset theme
	                                </button>
	                              </div>
	                            </details>

	                            {carouselSlides.length > 0 && (
	                              <div className="flex flex-wrap gap-1.5">
	                                {carouselSlides.map((slide, index) => (
	                                  <button
	                                    key={slide.id}
	                                    type="button"
	                                    onClick={() => setCarouselActiveSlide(index)}
	                                    className="h-8 min-w-8 rounded-lg px-2 text-xs font-semibold"
	                                    style={{
	                                      background: index === carouselActiveSlide ? '#f97316' : '#fff',
	                                      color: index === carouselActiveSlide ? '#fff' : '#9a3412',
	                                      border: '1px solid #fed7aa',
	                                    }}
	                                  >
	                                    {index + 1}
	                                  </button>
	                                ))}
	                                <button
	                                  type="button"
	                                  onClick={addCarouselSlide}
	                                  className="h-8 rounded-lg px-3 text-xs font-semibold"
	                                  style={{ background: '#fff', color: '#9a3412', border: '1px solid #fed7aa' }}
	                                >
	                                  Add slide
	                                </button>
	                              </div>
	                            )}

	                            {activeCarouselSlide && (
	                              <div className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #fed7aa' }}>
	                                <div className="mb-2 flex items-center justify-between gap-3">
	                                  <p className="text-xs font-semibold" style={{ color: '#9a3412' }}>Slide {carouselActiveSlide + 1}</p>
	                                  {carouselSlides.length > 1 && (
	                                    <button
	                                      type="button"
	                                      onClick={() => removeCarouselSlide(activeCarouselSlide.id)}
	                                      className="inline-flex items-center gap-1 text-xs font-semibold"
	                                      style={{ color: '#dc2626' }}
	                                    >
	                                      <Trash2 className="h-3.5 w-3.5" />
	                                      Remove
	                                    </button>
	                                  )}
	                                </div>
	                                <input
	                                  value={activeCarouselSlide.title}
	                                  onChange={(event) => updateCarouselSlide(activeCarouselSlide.id, 'title', event.target.value)}
	                                  className="w-full rounded-lg px-3 py-2 text-sm font-semibold outline-none"
	                                  style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#111' }}
	                                  placeholder="Slide headline"
	                                />
	                                <textarea
	                                  value={activeCarouselSlide.body}
	                                  onChange={(event) => updateCarouselSlide(activeCarouselSlide.id, 'body', event.target.value)}
	                                  rows={4}
	                                  className="mt-2 w-full resize-y rounded-lg px-3 py-2 text-sm outline-none"
	                                  style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#111' }}
	                                  placeholder="Slide body"
	                                />
	                              </div>
	                            )}

	                            <div className="grid gap-3 sm:grid-cols-2">
	                              <label className="block">
	                                <span className="text-xs font-semibold" style={{ color: '#9a3412' }}>Caption</span>
	                                <textarea
	                                  value={carouselCaption}
	                                  onChange={(event) => updateCarouselCaption(event.target.value)}
	                                  rows={4}
	                                  className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
	                                  style={{ background: '#fff', border: '1px solid #fed7aa', color: '#111' }}
	                                  placeholder="Write the Instagram caption..."
	                                />
	                              </label>
	                              <label className="block">
	                                <span className="text-xs font-semibold" style={{ color: '#9a3412' }}>Hashtags</span>
	                                <textarea
	                                  value={instagramHashtags}
	                                  onChange={(event) => {
	                                    setInstagramHashtags(event.target.value);
	                                    setCarouselPublishSuccess(false);
	                                    setCarouselPublishStatus('');
	                                  }}
	                                  rows={4}
	                                  className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none"
	                                  style={{ background: '#fff', border: '1px solid #fed7aa', color: '#111' }}
	                                  placeholder="#buildinpublic #founderjourney"
	                                />
	                              </label>
	                            </div>

	                            {carouselDraftStatusLabel && (
	                              <p className="text-xs" style={{ color: '#9a3412' }}>{carouselDraftStatusLabel}</p>
	                            )}
	                            {carouselPublishStatus && (
	                              <p className="text-xs" style={{ color: carouselPublishSuccess ? '#16a34a' : '#2563eb' }}>{carouselPublishStatus}</p>
	                            )}
	                            {carouselError && (
	                              <p className="text-xs" style={{ color: '#dc2626' }}>{carouselError}</p>
	                            )}
	                            {metaError && format === 'instagram-carousel' && (
	                              <p className="text-xs" style={{ color: '#dc2626' }}>{metaError}</p>
	                            )}
	                          </div>
	                        </div>
	                      </div>
	                    )}

	                    {!hasContentDraft(videoAnalysis, format) && (
	                      <div className="rounded-lg p-4" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
	                        <p className="text-sm" style={{ color: '#4b5563' }}>
	                          No draft came back for {getFormatLabel(format)}. Pick another available format above or upload a clearer clip.
	                        </p>
	                      </div>
	                    )}

		                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Selected Draft Output */}
        {generatedPost && format !== 'linkedin' && (
          <div className="px-5 pb-5 space-y-4">
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e5', background: '#fff' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #e5e5e5', background: '#f9fafb' }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: '#3b82f6' }} />
                  <span className="text-sm font-semibold" style={{ color: '#111' }}>Selected {selectedFormat.label}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(generatedPost, generatedPostCopyTarget)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: copiedTarget === generatedPostCopyTarget ? '#dcfce7' : '#f5f5f5',
                    color: copiedTarget === generatedPostCopyTarget ? '#16a34a' : '#333',
                  }}
                >
                  {copiedTarget === generatedPostCopyTarget ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedTarget === generatedPostCopyTarget ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#111' }}>
                  {generatedPost}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
