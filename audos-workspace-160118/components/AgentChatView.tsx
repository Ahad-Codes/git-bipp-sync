/**
 * AgentChatView — per-space agent UI.
 *
 * THIS FILE IS THE PER-SPACE AGENT APPEARANCE. Edit it to restyle the agent
 * element (colors, spacing, copy, layout, message bubbles, header card,
 * suggestion chips, empty state, input bar, etc.). Your edits PERSIST across
 * recompiles.
 *
 * The runtime hook `useAgentChatRuntime` and the `AgentChat.tsx` shell are
 * platform-managed and force-overwritten on each compile — do not put any
 * logic / state / fetch / effect work in here. This view is purely
 * presentational; it consumes the runtime and renders.
 *
 * DESIGN: Buffer-inspired clean, premium SaaS aesthetic
 * - Clean white backgrounds with subtle shadows
 * - Blue (#3B82F6) as primary accent
 * - Light, airy, professional feel
 * - Generous whitespace and rounded corners
 *
 * FEATURES:
 * - Voice recording with browser-native transcription
 * - Story-gathering onboarding prompts
 * - Immersive input experience
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bot,
  Send,
  BookOpen,
  CalendarDays,
  Edit3,
  Save,
  Sparkles,
  Loader2,
  FolderOpen,
  Search,
  ListChecks,
  Paperclip,
  X,
  FileImage,
  File,
  XCircle,
  MessageSquare,
  Megaphone,
  Mic,
  Square,
  Target,
  Users,
  Wand2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getFriendlyTerm, getToolColor } from '../lib/friendly-terms';
import type { AgentChatRuntime } from './useAgentChatRuntime';

interface AgentChatViewProps {
  runtime: AgentChatRuntime;
}

// Buffer-inspired color palette
const COLORS = {
  blue: '#3B82F6',
  blueHover: '#2563EB',
  blueLight: '#EFF6FF',
  coral: '#E57356',
  purple: '#8B5CF6',
  green: '#10B981',
  white: '#FFFFFF',
  offWhite: '#FAFAFA',
  lightGray: '#F3F4F6',
  mediumGray: '#E5E7EB',
  darkGray: '#6B7280',
  charcoal: '#1F2937',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  red: '#EF4444',
};

const BIPP_CONTENT_CALENDAR_STORAGE_KEY = 'bipp.contentCalendar.v1';
const BIPP_CONTENT_CALENDAR_CHANNEL = 'bipp-content-calendar';

type CalendarPrompt = {
  label: string;
  prompt: string;
  description: string;
  Icon: typeof Megaphone;
};

interface MarketingCalendarItem {
  id: string;
  date: string;
  type: 'organic' | 'paid' | 'strategy';
  channel: string;
  title: string;
  task: string;
  angle: string;
  status: 'planned' | 'done';
  source: 'chat' | 'manual' | 'raw-to-post' | 'scheduled';
  scheduledAt?: string;
  contentPreview?: string;
  scheduleId?: string;
}

interface MarketingCalendarPlan {
  version: 1;
  sourceHash: string;
  updatedAt: string;
  sourceSummary: string;
  audience: string;
  challenge: string;
  why: string;
  items: MarketingCalendarItem[];
}

// Marketing prompts to steer Bipp toward customer acquisition and content planning.
const STORY_PROMPTS: CalendarPrompt[] = [
  {
    label: 'Help me build a marketing plan',
    prompt: 'Help me build a marketing plan',
    description: 'Start with customers, channels, and a useful calendar.',
    Icon: Target,
  },
  {
    label: 'Help me tell my story',
    prompt: 'Help me tell my story',
    description: 'Shape your founder story into content people understand.',
    Icon: Sparkles,
  },
  {
    label: 'What should my organic social strategy be?',
    prompt: 'What should my organic social strategy be?',
    description: 'Pick themes, cadence, and post ideas for organic growth.',
    Icon: Users,
  },
];

function WorkingIndicator({
  lastAction,
  agentLabel = 'Agent',
  thinkingText,
}: {
  lastAction?: string;
  agentLabel?: string;
  thinkingText?: string | null;
}) {
  const actionIcons: Record<string, any> = {
    read_file: BookOpen,
    write_file: Save,
    edit_file: Edit3,
    write_task_list: ListChecks,
    glob: Search,
    grep: Search,
    ls: FolderOpen,
  };

  const Icon = actionIcons[lastAction || ''] || Loader2;
  const friendlyText = getFriendlyTerm(lastAction || '', 'thinking');

  return (
    <div className="flex items-start mr-12 mb-2">
      <div
        className="flex items-center gap-3 px-5 py-3 bg-white rounded-2xl shadow-sm border border-gray-100"
        style={{ borderColor: COLORS.mediumGray }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: COLORS.blueLight }}
        >
          <Icon
            className="h-4 w-4 animate-spin"
            style={{ color: COLORS.blue }}
          />
        </div>
        <span
          className="text-sm font-medium"
          style={{ color: COLORS.textSecondary }}
        >
          {thinkingText || `${agentLabel} is ${friendlyText}...`}
        </span>
      </div>
    </div>
  );
}

// Voice Recording Component
function VoiceRecorder({
  onTranscriptReady,
  disabled,
}: {
  onTranscriptReady: (text: string) => void;
  disabled?: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      setRecordingTime(0);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(blob);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch('/api/generate/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      if (data.text) {
        onTranscriptReady(data.text);
      }
    } catch (err) {
      console.error('Transcription error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (isTranscribing) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl"
        style={{ backgroundColor: COLORS.blueLight }}
      >
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: COLORS.blue }} />
        <span className="text-xs font-medium" style={{ color: COLORS.blue }}>
          Transcribing...
        </span>
      </div>
    );
  }

  if (isRecording) {
    return (
      <button
        onClick={stopRecording}
        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all animate-pulse"
        style={{ backgroundColor: COLORS.red, color: COLORS.white }}
      >
        <Square className="w-4 h-4 fill-current" />
        <span className="text-xs font-medium">{formatTime(recordingTime)}</span>
      </button>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className="h-9 w-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
      style={{ backgroundColor: 'transparent' }}
      title="Record voice message"
    >
      <Mic className="w-5 h-5" style={{ color: COLORS.darkGray }} />
    </button>
  );
}

// react-markdown strips its internal `node` prop from the rest spread when
// destructured, which keeps it from leaking onto DOM elements.
const SAFE_MARKDOWN_PROTOCOLS = /^(subscribe|app|https?|mailto|tel|ircs?|xmpp):/i;

const markdownUrlTransform = (value: string): string => {
  if (typeof value === 'string' && SAFE_MARKDOWN_PROTOCOLS.test(value)) {
    return value;
  }

  const colon = value.indexOf(':');
  const slash = value.indexOf('/');
  const question = value.indexOf('?');
  const hash = value.indexOf('#');

  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (question !== -1 && colon > question) ||
    (hash !== -1 && colon > hash)
  ) {
    return value;
  }

  return '';
};

function createHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash));
}

function addDays(date: Date, days: number): string {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function getChatMessageText(message: AgentChatRuntime['messages'][number]): string {
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map((chunk) => chunk.type === 'text' ? chunk.text || '' : '')
    .filter(Boolean)
    .join('\n');
}

function firstMatchingSentence(text: string, patterns: RegExp[], fallback: string): string {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/[.!?]\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const match = sentences.find((sentence) => patterns.some((pattern) => pattern.test(sentence)));
  return (match || fallback).slice(0, 180);
}

function stripMarkdownSyntax(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_>#~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const trimmed = text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  return trimmed || text.slice(0, maxLength).trim();
}

function polishGrowthChallenge(value: string, fallback = 'turning attention into customer conversations'): string {
  let text = stripMarkdownSyntax(value)
    .replace(/^\s*(?:[-]|\d+[.)])\s*/, '')
    .replace(/^(?:growth challenge|customer growth challenge|core challenge|main challenge|biggest challenge|challenge)\s*[:\-]\s*/i, '')
    .replace(/^["']+|["'.]+$/g, '')
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
    [/^we\s+need\s+to\s+/i, 'Turning '],
    [/^you\s+need\s+to\s+/i, 'Turning '],
    [/^your\s+(?:growth\s+)?challenge\s+(?:is|seems to be|sounds like)\s+/i, ''],
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
    .replace(/\s+[,;:]$/g, '')
    .trim();

  if (!text || text.length < 8) text = fallback;
  text = truncateAtWord(text, 150);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractSuggestedGrowthChallenge(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;

  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates: string[] = [];

  lines.forEach((line) => {
    const cleanLine = stripMarkdownSyntax(line).trim();
    const tableCells = cleanLine
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);
    const tableIndex = tableCells.findIndex((cell) => /^(?:growth\s+)?challenge$/i.test(cell));
    if (tableIndex !== -1 && tableCells[tableIndex + 1]) {
      candidates.push(tableCells[tableIndex + 1]);
    }

    const labeled = cleanLine.match(/(?:growth challenge|customer growth challenge|core challenge|main challenge|biggest challenge|challenge)\s*[:\-]\s*([^.!?\n]{8,220})/i);
    if (labeled?.[1]) candidates.push(labeled[1]);

    const flexibleLabel = cleanLine.match(/(?:growth challenge|customer growth challenge|core challenge|main challenge|biggest challenge|challenge)[^:]{0,60}:\s*([^.!?\n]{8,220})/i);
    if (flexibleLabel?.[1]) candidates.push(flexibleLabel[1]);

    const framedAs = cleanLine.match(/(?:frame|name|summarize)\s+(?:the\s+)?(?:growth\s+)?challenge\s+(?:as|this way)\s*[:\-]?\s*([^.!?\n]{8,220})/i);
    if (framedAs?.[1]) candidates.push(framedAs[1]);

    const framed = cleanLine.match(/(?:your|the)\s+(?:core\s+|main\s+|biggest\s+|customer\s+)?(?:growth\s+)?challenge\s+(?:is|seems to be|sounds like|could be|might be)\s+([^.!?\n]{8,220})/i);
    if (framed?.[1]) candidates.push(framed[1]);
  });

  const sentences = raw
    .replace(/\s+/g, ' ')
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const sentenceCandidate = sentences.find((sentence) =>
    /(?:your|the)\s+(?:core\s+|main\s+|biggest\s+)?(?:growth\s+)?challenge\s+(?:is|seems|sounds|could|might)/i.test(sentence)
  );
  if (sentenceCandidate) candidates.push(sentenceCandidate);

  const best = candidates
    .map((candidate) => polishGrowthChallenge(candidate))
    .find((candidate) =>
      candidate.length >= 12 &&
      !/^(questions?|next steps?|content pillars?|calendar|plan)$/i.test(candidate)
    );

  return best || null;
}

function inferAudience(text: string): string {
  const explicit = text.match(/(?:ideal customer|target customer|target audience|serve|selling to|sell to|customers are|customer is)\s*(?:is|are|:)?\s*([^.!?\n]{8,110})/i);
  if (explicit?.[1]) return explicit[1].trim();

  const audienceFromFor = text.match(/\bfor\s+([^.!?\n]{8,120})/i);
  if (audienceFromFor?.[1] && /parent|founder|customer|client|user|buyer|people|team|creator|owner|operator|marketer|community/i.test(audienceFromFor[1])) {
    return truncateAtWord(audienceFromFor[1].replace(/\s+/g, ' ').trim(), 95);
  }

  const fallbackAudience = firstMatchingSentence(text, [/founder/i, /customer/i, /client/i, /user/i, /buyer/i], 'your best-fit customers');
  if (/growth challenge|challenge\s*:/i.test(fallbackAudience)) return 'your best-fit customers';
  return fallbackAudience;
}

function inferChallenge(text: string): string {
  return polishGrowthChallenge(
    firstMatchingSentence(
      text,
      [/struggl/i, /challenge/i, /hard to/i, /not getting/i, /need more/i, /growth/i, /customers/i, /leads/i, /sales/i],
      'turning attention into customer conversations'
    )
  );
}

function inferWhy(text: string): string {
  return firstMatchingSentence(
    text,
    [/started/i, /because/i, /why/i, /mission/i, /built/i, /building/i],
    'the reason you started building this business'
  );
}

function inferDailyUpdate(text: string): string {
  return firstMatchingSentence(
    text,
    [/today/i, /worked on/i, /built/i, /shipped/i, /launched/i, /fixed/i, /learned/i, /idea/i],
    'the most useful thing you worked on this week'
  );
}

function getCalendarItemType(channel: string, text: string): MarketingCalendarItem['type'] {
  const haystack = `${channel} ${text}`;
  if (/paid|ads?|meta|retarget|campaign|budget|ctr|creative test/i.test(haystack)) return 'paid';
  if (/strategy|research|interview|review|measure|customer conversation|outbound|positioning|profile|audit/i.test(haystack)) return 'strategy';
  return 'organic';
}

function cleanCalendarCell(value: string | undefined): string {
  return stripMarkdownSyntax(value || '')
    .replace(/^(?:[-*]\s+|\d+[.)]\s+)/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCalendarCopy(value: string): string {
  return cleanCalendarCell(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\b(the|a|an|to|and|or|for|with|about|it|this|that)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSameCalendarCopy(left: string, right: string): boolean {
  const normalizedLeft = normalizeCalendarCopy(left);
  const normalizedRight = normalizeCalendarCopy(right);
  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}

function isGenericRawToPostLauncher(value: string): boolean {
  const text = cleanCalendarCell(value).toLowerCase();
  if (!text) return false;
  if (/^open\s+raw-to-post$/.test(text)) return true;
  return /^open\s+raw-to-post\s+and\s+record(?:\s+a)?(?:\s+quick)?\s+video(?:\s+about\s+(?:it|this|that))?$/.test(text);
}

function isWeakCalendarSuggestion(value: string): boolean {
  const text = cleanCalendarCell(value);
  if (!text) return true;
  if (text.length < 8) return true;
  if (isGenericRawToPostLauncher(text)) return true;
  if (/^(?:content|post|task|idea|story|hook|angle|open raw-to-post)$/i.test(text)) return true;
  if (/\b(?:about|on)\s+(?:it|this|that)\b/i.test(text) && /raw-to-post|quick video|record/i.test(text)) return true;
  return false;
}

function extractCalendarSubject(input: {
  title: string;
  task: string;
  angle: string;
  channel: string;
}): string {
  const candidates = [input.title, input.angle, input.task]
    .map((candidate) => cleanCalendarCell(candidate)
      .replace(/^(?:open\s+)?raw-to-post\s*(?:and\s+record(?:\s+a)?(?:\s+quick)?\s+video)?\s*(?:about\s*)?/i, '')
      .replace(/^(?:write|create|record|draft|publish|post|make)\s+(?:a|an|one)?\s*/i, '')
      .replace(/\b(?:about|on)\s+(?:it|this|that)\b/i, '')
      .trim())
    .filter((candidate) => candidate.length >= 8 && !isGenericRawToPostLauncher(candidate));

  const unique = candidates.find((candidate, index, all) =>
    index === all.findIndex((other) => normalizeCalendarCopy(other) === normalizeCalendarCopy(candidate))
  );
  return truncateAtWord(unique || `${input.channel} content idea`, 90);
}

function makeActionableCalendarTask(input: {
  channel: string;
  title: string;
  task: string;
  angle: string;
}): string {
  const task = cleanCalendarCell(input.task);
  const title = cleanCalendarCell(input.title);
  const angle = cleanCalendarCell(input.angle);
  const shouldRewrite = (
    isWeakCalendarSuggestion(task) ||
    isSameCalendarCopy(task, title) ||
    (angle ? isSameCalendarCopy(task, angle) : false)
  );
  if (!shouldRewrite) return task;

  const subject = extractCalendarSubject({ ...input, task, title, angle });
  if (/raw-to-post|reel|video/i.test(input.channel)) {
    return `Record a 60-second video on ${subject}. Lead with one concrete moment, one lesson, and the next step.`;
  }
  if (/carousel/i.test(input.channel)) {
    return `Create a carousel on ${subject}. Use five slides: hook, pain, lesson, example, and CTA.`;
  }
  if (/linkedin|thread|twitter|x|threads|post/i.test(input.channel)) {
    return `Write a post on ${subject}. Include a specific scene, the insight it proves, and a question or CTA.`;
  }
  if (/outbound|customer|research/i.test(input.channel)) {
    return `Message five relevant people about ${subject}. Ask one specific question and save the best replies.`;
  }
  if (/ad|meta|google|paid/i.test(input.channel)) {
    return `Draft one test hook around ${subject}. State the pain clearly and define the response you want.`;
  }
  return `Turn ${subject} into a concrete deliverable with a hook, proof point, and next step.`;
}

function makeActionableCalendarAngle(input: {
  channel: string;
  title: string;
  task: string;
  angle: string;
}): string {
  const angle = cleanCalendarCell(input.angle);
  if (
    angle &&
    !isWeakCalendarSuggestion(angle) &&
    !isSameCalendarCopy(angle, input.title) &&
    !isSameCalendarCopy(angle, input.task)
  ) {
    return angle;
  }

  if (/raw-to-post|reel|video/i.test(input.channel)) {
    return 'Use video to make the idea feel specific, personal, and easy to repurpose.';
  }
  if (/outbound|customer|research/i.test(input.channel)) {
    return 'Create direct customer learning, not just more public content.';
  }
  if (/ad|meta|google|paid/i.test(input.channel)) {
    return 'Test whether the pain and promise are clear enough to earn a response.';
  }
  return 'Position the idea as a useful lesson, not a generic status update.';
}

function getDateForPlanToken(token: string | undefined, index: number): string {
  const today = new Date();
  const cleanToken = cleanCalendarCell(token || '');
  const dayMatch = cleanToken.match(/\bday\s*(\d{1,2})\b/i) || cleanToken.match(/^(\d{1,2})$/);
  if (dayMatch?.[1]) {
    const dayNumber = Math.max(1, Math.min(31, Number(dayMatch[1])));
    return addDays(today, dayNumber - 1);
  }

  const weekMatch = cleanToken.match(/\bweek\s*(\d{1,2})\b/i);
  if (weekMatch?.[1]) {
    const weekNumber = Math.max(1, Math.min(5, Number(weekMatch[1])));
    return addDays(today, ((weekNumber - 1) * 7) + (index % 7));
  }

  const parsedDate = Date.parse(cleanToken);
  if (!Number.isNaN(parsedDate) && /[a-z]{3,}|\d{4}|\d{1,2}[/-]\d{1,2}/i.test(cleanToken)) {
    return new Date(parsedDate).toISOString().slice(0, 10);
  }

  return addDays(today, index);
}

function getColumnIndex(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function createCalendarItemFromParts(input: {
  sourceHash: string;
  index: number;
  dateToken?: string;
  channel?: string;
  title?: string;
  task?: string;
  angle?: string;
}): MarketingCalendarItem | null {
  const task = cleanCalendarCell(input.task || input.title || '');
  if (!task || task.length < 8 || isGenericRawToPostLauncher(task)) return null;

  const rawChannel = cleanCalendarCell(input.channel || '');
  const platformMatch = task.match(/^(LinkedIn|Instagram|TikTok|Twitter|X|Threads|Email|Newsletter|Blog|Meta ads?|Google ads?|Outbound|Customer research|Raw-to-Post|Carousel|Reel|Story)\s*[:\-]\s*(.+)$/i);
  const channel = rawChannel || (platformMatch?.[1] ? platformMatch[1] : 'Content');
  const taskWithoutPlatform = platformMatch?.[2] ? platformMatch[2].trim() : task;
  if (isGenericRawToPostLauncher(taskWithoutPlatform)) return null;
  const title = truncateAtWord(cleanCalendarCell(input.title || taskWithoutPlatform), 72);
  const rawAngle = cleanCalendarCell(input.angle || taskWithoutPlatform);
  const actionableTask = makeActionableCalendarTask({
    channel,
    title,
    task: taskWithoutPlatform,
    angle: rawAngle,
  });
  if (isWeakCalendarSuggestion(actionableTask)) return null;
  const angle = makeActionableCalendarAngle({
    channel,
    title,
    task: actionableTask,
    angle: rawAngle,
  });

  return {
    id: `chat-${input.sourceHash}-assistant-${input.index}`,
    date: getDateForPlanToken(input.dateToken, input.index),
    type: getCalendarItemType(channel, `${title} ${taskWithoutPlatform} ${angle}`),
    channel,
    title: title || `Content task ${input.index + 1}`,
    task: actionableTask,
    angle: angle || 'Generated from the Bipp content strategy.',
    status: 'planned',
    source: 'chat',
  };
}

function isUsefulParsedCalendarItem(item: MarketingCalendarItem): boolean {
  if (isWeakCalendarSuggestion(item.title) && isWeakCalendarSuggestion(item.task)) return false;
  if (isGenericRawToPostLauncher(item.title) || isGenericRawToPostLauncher(item.task)) return false;
  return true;
}

function parseMarkdownTableCalendarItems(text: string, sourceHash: string): MarketingCalendarItem[] {
  const lines = text.split('\n');
  const items: MarketingCalendarItem[] = [];
  let headers: string[] | null = null;

  lines.forEach((line) => {
    if (!line.includes('|')) {
      headers = null;
      return;
    }

    const cells = line
      .split('|')
      .map((cell) => cleanCalendarCell(cell))
      .filter(Boolean);
    if (cells.length < 2) return;
    if (cells.every((cell) => /^-+$/.test(cell))) return;

    const normalized = cells.map((cell) => cell.toLowerCase());
    const looksLikeHeader = normalized.some((cell) => /date|day|week|channel|platform|format|post|content|task|idea|theme|goal|hook|angle/.test(cell));
    if (!headers && looksLikeHeader) {
      headers = normalized;
      return;
    }
    if (!headers) return;

    const dateIndex = getColumnIndex(headers, [/date/, /day/, /week/]);
    const channelIndex = getColumnIndex(headers, [/channel/, /platform/, /format/]);
    const titleIndex = getColumnIndex(headers, [/title/, /post/, /idea/, /topic/, /theme/, /asset/]);
    const taskIndex = getColumnIndex(headers, [/task/, /content/, /copy/, /description/, /action/, /what/]);
    const angleIndex = getColumnIndex(headers, [/angle/, /hook/, /goal/, /objective/, /why/, /purpose/, /cta/]);

    const item = createCalendarItemFromParts({
      sourceHash,
      index: items.length,
      dateToken: dateIndex >= 0 ? cells[dateIndex] : undefined,
      channel: channelIndex >= 0 ? cells[channelIndex] : undefined,
      title: titleIndex >= 0 ? cells[titleIndex] : undefined,
      task: taskIndex >= 0 ? cells[taskIndex] : cells[titleIndex],
      angle: angleIndex >= 0 ? cells[angleIndex] : undefined,
    });
    if (item) items.push(item);
  });

  return items;
}

function parseListCalendarItems(text: string, sourceHash: string): MarketingCalendarItem[] {
  const lines = text.split('\n');
  const items: MarketingCalendarItem[] = [];
  let currentWeek = 0;
  let inCalendarSection = false;

  lines.forEach((line) => {
    const cleanLine = stripMarkdownSyntax(line).replace(/\s+/g, ' ').trim();
    if (!cleanLine) return;

    if (/^(content calendar|first month|month 1|30[- ]day|four[- ]week|organic social strategy|posting plan|content plan|action items?|tasks?|next steps?|next actions?|to[- ]dos?|this week|execution plan)\b/i.test(cleanLine)) {
      inCalendarSection = true;
    } else if (/^(pricing|budget|metrics|questions|summary)\b/i.test(cleanLine)) {
      inCalendarSection = false;
    }

    const weekMatch = cleanLine.match(/^week\s*(\d{1,2})\s*[:\-]?\s*(.*)$/i);
    if (weekMatch?.[1]) {
      currentWeek = Number(weekMatch[1]);
      inCalendarSection = true;
      return;
    }

    const dayMatch = cleanLine.match(/^(?:day\s*)?(\d{1,2})[.)\:-]\s*(.+)$/i);
    const bulletMatch = cleanLine.match(/^(?:[-*]|\d+[.)])\s*(.+)$/);
    const labeledTaskMatch = cleanLine.match(/^(?:task|action item|next step|to[- ]do)\s*[:\-]\s*(.+)$/i);
    const directTaskMatch = inCalendarSection
      ? cleanLine.match(/^(write|create|record|post|publish|message|draft|test|schedule|research|review|open)\b.+/i)
      : null;
    const body = dayMatch?.[2] || bulletMatch?.[1] || labeledTaskMatch?.[1] || directTaskMatch?.[0] || '';
    if (!body) return;

    const hasContentSignal = /linkedin|instagram|thread|carousel|reel|post|email|newsletter|blog|outbound|ad|customer|story|hook|demo|case study|testimonial|behind the scenes|founder/i.test(body);
    if (!hasContentSignal || (!inCalendarSection && !dayMatch)) return;

    const item = createCalendarItemFromParts({
      sourceHash,
      index: items.length,
      dateToken: dayMatch?.[1] ? `Day ${dayMatch[1]}` : currentWeek ? `Week ${currentWeek}` : undefined,
      task: body,
    });
    if (item) items.push(item);
  });

  return items;
}

function getAssistantPlanCalendarItems(input: {
  assistantText: string;
  sourceHash: string;
  audience: string;
  challenge: string;
  why: string;
  dailyUpdate: string;
}): MarketingCalendarItem[] {
  const parsedItems = [
    ...parseMarkdownTableCalendarItems(input.assistantText, input.sourceHash),
    ...parseListCalendarItems(input.assistantText, input.sourceHash),
  ].filter(isUsefulParsedCalendarItem);
  const uniqueItems = parsedItems.filter((item, index, allItems) =>
    index === allItems.findIndex((candidate) => (
      candidate.date === item.date &&
      normalizeCalendarCopy(`${candidate.channel} ${candidate.title} ${candidate.task}`) === normalizeCalendarCopy(`${item.channel} ${item.title} ${item.task}`)
    ))
  );
  return uniqueItems.slice(0, 45).map((item, index) => ({
    ...item,
    id: `chat-${input.sourceHash}-plan-${index}`,
    date: item.date || addDays(new Date(), index),
  }));
}

function hasMarketingSignal(text: string): boolean {
  return /marketing|content|post|customer|lead|sales|sell|audience|growth|ads?|linkedin|instagram|founder|built|building|worked on|launched|shipped|idea/i.test(text);
}

function createMarketingCalendar(
  messages: AgentChatRuntime['messages'],
  options: { challengeOverride?: string } = {},
): MarketingCalendarPlan | null {
  const visibleText = messages
    .filter((message) => !(message.role === 'user' && getChatMessageText(message).startsWith('[SYSTEM:')))
    .map((message) => `${message.role}: ${getChatMessageText(message)}`)
    .join('\n')
    .trim();

  const userText = messages
    .filter((message) => message.role === 'user')
    .map(getChatMessageText)
    .filter((text) => !text.startsWith('[SYSTEM:'))
    .join('\n')
    .trim();

  const assistantText = messages
    .filter((message) => message.role === 'assistant')
    .map(getChatMessageText)
    .join('\n')
    .trim();

  if (!userText || !hasMarketingSignal(`${userText}\n${assistantText}`)) return null;
  if (!assistantText && !options.challengeOverride) return null;

  const suggestedChallenge = options.challengeOverride || extractSuggestedGrowthChallenge(assistantText);
  const contextText = `${assistantText}\n${userText}`;
  const conversationHash = createHash(`${userText}\n${assistantText}\n${suggestedChallenge || ''}`);
  const audience = inferAudience(contextText);
  const challenge = suggestedChallenge ? polishGrowthChallenge(suggestedChallenge) : inferChallenge(contextText);
  const why = inferWhy(contextText);
  const dailyUpdate = inferDailyUpdate(contextText);
  const sourceSummary = firstMatchingSentence(
    visibleText,
    [/marketing/i, /customer/i, /content/i, /worked on/i, /built/i, /struggl/i],
    'Bipp chat marketing plan'
  );
  const items = getAssistantPlanCalendarItems({
    assistantText,
    sourceHash: conversationHash,
    audience,
    challenge,
    why,
    dailyUpdate,
  });
  const sourceHash = createHash(`${conversationHash}:${items.map((item) => `${item.date}|${item.channel}|${item.title}|${item.task}`).join('||')}`);

  return {
    version: 1,
    sourceHash,
    updatedAt: new Date().toISOString(),
    sourceSummary,
    audience,
    challenge,
    why,
    items,
  };
}

function saveGrowthChallengeToCalendar(
  messages: AgentChatRuntime['messages'],
  growthChallenge: string,
): MarketingCalendarPlan | null {
  if (typeof window === 'undefined') return null;
  const challenge = polishGrowthChallenge(growthChallenge);
  const nextCalendar = createMarketingCalendar(messages, { challengeOverride: challenge });
  if (!nextCalendar) return null;

  const savedCalendar: MarketingCalendarPlan = preserveNonChatCalendarItems({
    ...nextCalendar,
    challenge,
    sourceHash: createHash(`${nextCalendar.sourceHash}:${challenge}`),
    sourceSummary: `Bipp growth challenge: ${challenge}`,
    updatedAt: new Date().toISOString(),
  });

  publishContentCalendarUpdate(savedCalendar);
  return savedCalendar;
}

function getSavedGrowthChallengeHash(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BIPP_CONTENT_CALENDAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MarketingCalendarPlan>;
    if (!parsed.challenge) return null;
    return createHash(polishGrowthChallenge(parsed.challenge));
  } catch {
    return null;
  }
}

function preserveNonChatCalendarItems(nextCalendar: MarketingCalendarPlan): MarketingCalendarPlan {
  if (typeof window === 'undefined') return nextCalendar;
  try {
    const raw = window.localStorage.getItem(BIPP_CONTENT_CALENDAR_STORAGE_KEY);
    if (!raw) return nextCalendar;
    const existing = JSON.parse(raw) as Partial<MarketingCalendarPlan>;
    const preservedItems = Array.isArray(existing.items)
      ? existing.items.filter((item) => item?.source && item.source !== 'chat')
      : [];
    if (preservedItems.length === 0) return nextCalendar;

    const nextIds = new Set(nextCalendar.items.map((item) => item.id));
    return {
      ...nextCalendar,
      items: [
        ...nextCalendar.items,
        ...preservedItems.filter((item) => !nextIds.has(item.id)),
      ],
    };
  } catch {
    return nextCalendar;
  }
}

function publishContentCalendarUpdate(calendar: MarketingCalendarPlan): void {
  window.localStorage.setItem(BIPP_CONTENT_CALENDAR_STORAGE_KEY, JSON.stringify(calendar));
  window.dispatchEvent(new CustomEvent('bipp:content-calendar-updated', { detail: calendar }));
  try {
    window.dispatchEvent(new StorageEvent('storage', {
      key: BIPP_CONTENT_CALENDAR_STORAGE_KEY,
      newValue: JSON.stringify(calendar),
    }));
  } catch {
    // Some embedded browsers do not allow constructing StorageEvent.
  }
  try {
    const channel = new BroadcastChannel(BIPP_CONTENT_CALENDAR_CHANNEL);
    channel.postMessage(calendar);
    channel.close();
  } catch {
    // BroadcastChannel is optional; localStorage remains the source of truth.
  }
  try {
    window.parent?.postMessage({ type: 'bipp:content-calendar-updated', calendar }, '*');
  } catch {
    // Cross-frame notifications are best-effort.
  }
}

function persistMarketingCalendar(messages: AgentChatRuntime['messages']): void {
  if (typeof window === 'undefined') return;
  const createdCalendar = createMarketingCalendar(messages);
  if (!createdCalendar) return;
  const nextCalendar = preserveNonChatCalendarItems(createdCalendar);

  try {
    const existing = window.localStorage.getItem(BIPP_CONTENT_CALENDAR_STORAGE_KEY);
    const parsedExisting = existing ? JSON.parse(existing) as Partial<MarketingCalendarPlan> : null;
    if (parsedExisting?.sourceHash === nextCalendar.sourceHash) return;

    publishContentCalendarUpdate(nextCalendar);
  } catch (error) {
    console.warn('[Bipp] Failed to save content calendar from chat:', error);
  }
}

const markdownComponents: Components = {
  p({ node: _node, children, ...props }) {
    return (
      <p className="my-2 text-base leading-relaxed" {...props}>
        {children}
      </p>
    );
  },
  ul({ node: _node, children, ...props }) {
    return (
      <ul
        className="my-3 pl-5 space-y-1"
        style={{ listStyleType: 'disc', listStylePosition: 'outside' }}
        {...props}
      >
        {children}
      </ul>
    );
  },
  ol({ node: _node, children, ...props }) {
    return (
      <ol
        className="my-3 pl-5 space-y-1"
        style={{ listStyleType: 'decimal', listStylePosition: 'outside' }}
        {...props}
      >
        {children}
      </ol>
    );
  },
  li({ node: _node, children, ...props }) {
    return (
      <li className="ml-0 text-base leading-relaxed" style={{ display: 'list-item' }} {...props}>
        {children}
      </li>
    );
  },
  table({ node: _node, children, ...props }) {
    return (
      <div className="overflow-x-auto my-3">
        <table
          className="min-w-full border-collapse text-sm rounded-lg overflow-hidden"
          style={{ borderColor: COLORS.mediumGray }}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  thead({ node: _node, children, ...props }) {
    return (
      <thead style={{ backgroundColor: COLORS.lightGray }} {...props}>
        {children}
      </thead>
    );
  },
  tbody({ node: _node, children, ...props }) {
    return <tbody {...props}>{children}</tbody>;
  },
  tr({ node: _node, children, ...props }) {
    return (
      <tr style={{ borderBottomWidth: 1, borderColor: COLORS.mediumGray }} {...props}>
        {children}
      </tr>
    );
  },
  th({ node: _node, children, ...props }) {
    return (
      <th
        className="px-4 py-3 text-left font-semibold text-sm"
        style={{ color: COLORS.textPrimary, borderColor: COLORS.mediumGray }}
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ node: _node, children, ...props }) {
    return (
      <td
        className="px-4 py-3 text-sm"
        style={{ borderColor: COLORS.mediumGray }}
        {...props}
      >
        {children}
      </td>
    );
  },
  code({ node: _node, children, className, ...props }) {
    const isBlock = typeof className === 'string' && className.includes('language-');
    if (isBlock) {
      return (
        <code className={`${className ?? ''} break-all`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="px-1.5 py-0.5 rounded text-sm break-all font-mono"
        style={{ backgroundColor: COLORS.lightGray, color: COLORS.charcoal }}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre({ node: _node, children, ...props }) {
    return (
      <pre
        className="rounded-xl p-4 my-3 overflow-x-auto max-w-full text-sm"
        style={{
          backgroundColor: COLORS.charcoal,
          color: COLORS.lightGray,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}
        {...props}
      >
        {children}
      </pre>
    );
  },
  a({ node: _node, href, children }) {
    if (typeof href === 'string' && href.startsWith('app://')) {
      const appId = href.replace('app://', '');
      return (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[AgentChat] Button click - opening app:', appId);
            window.dispatchEvent(new CustomEvent('openApp', { detail: { appId } }));
          }}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all text-sm font-medium mx-1 shadow-sm hover:shadow-md"
          style={{
            backgroundColor: COLORS.blue,
            color: COLORS.white
          }}
          data-testid={`link-app-${appId}`}
        >
          {children}
        </button>
      );
    }
    if (typeof href === 'string' && href.startsWith('subscribe://')) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('endIntroSession'));
          }}
          className="hover:underline break-all bg-transparent border-none p-0 font-inherit text-left font-medium"
          style={{ color: COLORS.blue }}
          data-testid="link-subscribe-plans"
        >
          {children}
        </button>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={href}
        className="hover:underline break-all font-medium"
        style={{ color: COLORS.blue }}
      >
        {children}
      </a>
    );
  },
};

export default function AgentChatView({ runtime }: AgentChatViewProps) {
  const {
    messages,
    streamingContent,
    isStreaming,
    loading,
    lastAction,
    isLoadingHistory,
    hasLoadedHistory,
    input,
    setInput,
    pendingAttachments,
    isUploadingAttachment,
    isDraggingOver,
    messagesEndRef,
    textareaRef,
    fileInputRef,
    dropZoneRef,
    sendMessage,
    sendMessageWithContent,
    removeAttachment,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    handleKeyDown,
    greetingPrompt,
    isConfigLoaded,
    greetingSent,
    welcomeInjectedSource,
    isBeaconSpace,
    agentLabel,
    thinkingText,
    beaconIntake,
    beaconStarterPrompts,
    shortcutPrefix,
	  } = runtime;

  const [savedGrowthChallengeHash, setSavedGrowthChallengeHash] = useState<string | null>(null);
  const hasUserMessages = messages.some((message) => message.role === 'user');
  const shouldShowBeaconIntake = isBeaconSpace && !!beaconIntake && !hasUserMessages;
  const composerPlaceholder = pendingAttachments.length > 0
    ? isBeaconSpace
      ? 'Add any context about these files...'
      : 'Add a message about the files...'
    : isBeaconSpace
      ? shouldShowBeaconIntake
        ? 'We can keep building from your starter plan, or you can tell me what changed...'
        : "Tell me what happened, or what you're worried about..."
      : 'Share a marketing challenge, customer-growth question, or what you worked on today...';

  const visibleMessages = messages.filter(
    (m) => !(m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('[SYSTEM:')),
  );

  const isPending =
    isLoadingHistory ||
    !isConfigLoaded ||
    (!!greetingPrompt && !greetingSent) ||
    (greetingSent && !welcomeInjectedSource);

  const showPendingPlaceholder =
    visibleMessages.length === 0 &&
    !loading &&
    !streamingContent &&
    !shouldShowBeaconIntake &&
    isPending;

  const showEmptyStateWelcome =
    !isLoadingHistory &&
    hasLoadedHistory &&
    isConfigLoaded &&
    visibleMessages.length === 0 &&
    !greetingSent &&
    !greetingPrompt &&
    !shouldShowBeaconIntake;

  // Handle voice transcription
  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(prev => prev ? `${prev} ${text}` : text);
    // Auto-focus the textarea after transcription
    textareaRef.current?.focus();
  }, [setInput, textareaRef]);

  const handleAddGrowthChallenge = useCallback((challenge: string) => {
    const saved = saveGrowthChallengeToCalendar(messages, challenge);
    if (saved) {
      setSavedGrowthChallengeHash(createHash(saved.challenge));
    }
  }, [messages]);

  useEffect(() => {
    persistMarketingCalendar(messages);
  }, [messages]);

  return (
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: COLORS.offWhite }}
    >
      {/* Messages area */}
      <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
        {/* Pending-init placeholder so the user never sees a blank chat */}
        {showPendingPlaceholder && (
          <div className="flex justify-start mr-12">
            <div
              className="rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm"
              style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.mediumGray}` }}
            >
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: COLORS.blue }} />
              <span className="text-sm" style={{ color: COLORS.textSecondary }}>Getting ready…</span>
            </div>
          </div>
        )}

        {!isLoadingHistory && hasLoadedHistory && shouldShowBeaconIntake && beaconIntake && (
          <div className="px-2">
            <div
              className="mx-auto max-w-2xl overflow-hidden rounded-2xl shadow-md"
              style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.mediumGray}` }}
            >
              <div
                className="px-6 py-5"
                style={{
                  backgroundColor: COLORS.blueLight,
                  borderBottom: `1px solid ${COLORS.mediumGray}`
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: COLORS.blue }}
                >
                  Your Beacon starting point
                </p>
                <h2
                  className="mt-2 text-xl font-semibold"
                  style={{ color: COLORS.charcoal }}
                >
                  {beaconIntake.headline}
                </h2>
                <p
                  className="mt-2 text-sm leading-6"
                  style={{ color: COLORS.textSecondary }}
                >
                  {beaconIntake.reflection}
                </p>
              </div>

              <div className="space-y-5 px-6 py-5">
                <div
                  className="rounded-xl px-4 py-4"
                  style={{ backgroundColor: COLORS.blueLight }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: COLORS.blue }}
                  >
                    {`Today's anchor`}
                  </p>
                  <p
                    className="mt-2 text-sm leading-6"
                    style={{ color: COLORS.charcoal }}
                  >
                    {beaconIntake.anchor}
                  </p>
                </div>

                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: COLORS.charcoal }}
                  >
                    Good next steps
                  </p>
                  <div className="mt-3 space-y-2">
                    {beaconIntake.nextSteps.map((step) => (
                      <div
                        key={step}
                        className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                        style={{ backgroundColor: COLORS.lightGray, color: COLORS.charcoal }}
                      >
                        <div
                          className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS.blue }}
                        />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: COLORS.charcoal }}
                  >
                    Continue from here
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {beaconIntake.starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          void sendMessageWithContent(prompt, []);
                        }}
                        className="rounded-full px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow-md"
                        style={{
                          backgroundColor: COLORS.white,
                          color: COLORS.blue,
                          border: `1px solid ${COLORS.blue}`
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Welcome message - enhanced with story prompts and voice hint */}
        {showEmptyStateWelcome ? (
          <div className="mt-8 px-4">
            {isBeaconSpace ? (
              <div
                className="mx-auto max-w-xl rounded-2xl px-8 py-10 text-center shadow-md"
                style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.mediumGray}` }}
              >
                <div
                  className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm"
                  style={{ backgroundColor: COLORS.blue }}
                >
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h2
                  className="text-2xl font-semibold"
                  style={{ color: COLORS.charcoal }}
                >
                  Start with the hard part
                </h2>
                <p
                  className="mx-auto mt-3 max-w-md text-base leading-relaxed"
                  style={{ color: COLORS.textSecondary }}
                >
                  Tell Beacon what happened, what conversation you are dreading, or what you need help saying next.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {beaconStarterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        void sendMessageWithContent(prompt, []);
                      }}
                      className="rounded-full px-4 py-2 text-sm font-medium shadow-sm transition-all hover:shadow-md"
                      style={{
                        backgroundColor: COLORS.white,
                        color: COLORS.blue,
                        border: `1px solid ${COLORS.blue}`
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl py-8 text-center">
                <div
                  className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl shadow-md"
                  style={{ backgroundColor: COLORS.blueLight }}
                >
                  <Megaphone className="w-7 h-7" style={{ color: COLORS.blue }} />
                </div>

                <p
                  className="mb-3 text-xs font-semibold uppercase"
                  style={{ color: COLORS.blue, letterSpacing: '0.22em' }}
                >
                  Bipp marketing desk
                </p>
                <h1
                  className="mx-auto max-w-2xl font-bold leading-tight"
                  style={{ color: COLORS.charcoal, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', letterSpacing: 0 }}
                >
                  How are you getting in front of customers today?
                </h1>
                <p
                  className="mx-auto mt-5 max-w-xl text-base leading-relaxed"
                  style={{ color: COLORS.textSecondary }}
                >
                  Share a marketing challenge, a content idea, or what you worked on today. Bipp will route quick updates to Raw-to-Post and interview you when you need a fuller marketing plan.
                </p>

                <div className="mx-auto mt-8 grid max-w-3xl gap-3 md:grid-cols-3">
                  {STORY_PROMPTS.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setInput(item.prompt);
                        textareaRef.current?.focus();
                      }}
                      className="flex min-h-[150px] flex-col items-start gap-3 rounded-2xl px-5 py-4 text-left transition-all hover:shadow-md group"
                      style={{
                        backgroundColor: COLORS.white,
                        border: `1px solid ${COLORS.mediumGray}`
                      }}
                    >
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: COLORS.blueLight }}
                      >
                        <item.Icon className="w-5 h-5" style={{ color: COLORS.blue }} />
                      </div>
                      <div className="min-w-0">
                        <span
                          className="block text-sm font-semibold transition-colors group-hover:text-blue-600"
                          style={{ color: COLORS.charcoal }}
                        >
                          {item.label}
                        </span>
                        <span
                          className="mt-2 block text-xs leading-5"
                          style={{ color: COLORS.textSecondary }}
                        >
                          {item.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <div
                  className="mt-6 flex items-center justify-center gap-2 text-xs"
                  style={{ color: COLORS.darkGray }}
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>Marketing-plan answers will populate the Content Calendar app.</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          visibleMessages.length > 0 &&
          visibleMessages.map((msg, idx) => (
            <div key={idx}>
              <div
                className={`px-5 py-4 rounded-2xl overflow-hidden min-w-0 shadow-sm ${
                  msg.role === 'user' ? 'ml-12' : 'mr-12'
                }`}
                style={
                  msg.role === 'user'
                    ? { backgroundColor: COLORS.blue, color: COLORS.white }
                    : { backgroundColor: COLORS.white, border: `1px solid ${COLORS.mediumGray}` }
                }
              >
                <p
                  className="text-xs font-semibold mb-2 uppercase tracking-wide"
                  style={{
                    color: msg.role === 'user' ? 'rgba(255,255,255,0.8)' : COLORS.textSecondary
                  }}
                >
                  {isBeaconSpace
                    ? msg.role === 'assistant'
                      ? 'Beacon'
                      : 'You'
                    : msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}
                </p>

                {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                      >
                        {att.contentType.startsWith('image/') ? (
                          <FileImage className="w-3.5 h-3.5" />
                        ) : (
                          <File className="w-3.5 h-3.5" />
                        )}
                        <span className="max-w-[100px] truncate">{att.originalName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {typeof msg.content === 'string' || msg.content == null ? (
                  <div
                    className="prose prose-base max-w-none"
                    style={{ color: msg.role === 'user' ? COLORS.white : COLORS.charcoal }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                      urlTransform={markdownUrlTransform}
                    >
                      {typeof msg.content === 'string' ? msg.content : ''}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(Array.isArray(msg.content) ? msg.content : []).map((chunk, chunkIdx) => (
                      <div key={chunkIdx}>
                        {chunk.type === 'text' && chunk.text && (
                          <div
                            className="prose prose-base max-w-none"
                            style={{ color: COLORS.charcoal }}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                              urlTransform={markdownUrlTransform}
                            >
                              {chunk.text}
                            </ReactMarkdown>
                          </div>
                        )}
                        {chunk.type === 'tool_use' && (
                          <div
                            className="rounded-xl overflow-hidden mt-2"
                            style={{ border: `1px solid ${COLORS.mediumGray}` }}
                          >
                            <div
                              className="px-4 py-3 flex items-center gap-2 flex-wrap"
                              style={{ backgroundColor: COLORS.lightGray }}
                            >
                              {chunk.name === 'edit_file' ? (
                                <Edit3 className="w-4 h-4" style={{ color: COLORS.blue }} />
                              ) : chunk.name === 'read_file' ? (
                                <BookOpen className="w-4 h-4" style={{ color: COLORS.blue }} />
                              ) : chunk.name === 'write_file' ? (
                                <Save className="w-4 h-4" style={{ color: COLORS.green }} />
                              ) : (
                                <Sparkles className="w-4 h-4" style={{ color: COLORS.purple }} />
                              )}
                              <span
                                className="text-sm font-semibold"
                                style={{ color: COLORS.charcoal }}
                              >
                                {chunk.name === 'read_file'
                                  ? 'Viewing'
                                  : chunk.name === 'write_file'
                                    ? 'Creating'
                                    : chunk.name === 'edit_file'
                                      ? 'Updating'
                                      : getFriendlyTerm(chunk.name || '', 'Tool Use')}
                              </span>
                              {chunk.input?.file_path && (
                                <span
                                  className="font-mono text-xs break-all"
                                  style={{ color: COLORS.textSecondary }}
                                >
                                  {chunk.input.file_path}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
	                  </div>
	                )}
	                {msg.role === 'assistant' && (() => {
	                  const growthChallenge = extractSuggestedGrowthChallenge(getChatMessageText(msg));
	                  if (!growthChallenge) return null;
	                  const challengeHash = createHash(growthChallenge);
	                  const isSaved = savedGrowthChallengeHash === challengeHash || getSavedGrowthChallengeHash() === challengeHash;

	                  return (
	                    <div
	                      className="mt-4 rounded-xl border px-4 py-3"
	                      style={{ backgroundColor: '#fff1f2', borderColor: '#fecdd3' }}
	                    >
	                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#be123c' }}>
	                        Growth challenge
	                      </p>
	                      <p className="mt-1 text-sm leading-6" style={{ color: COLORS.charcoal }}>
	                        {growthChallenge}
	                      </p>
	                      <button
	                        type="button"
	                        onClick={() => handleAddGrowthChallenge(growthChallenge)}
	                        disabled={isSaved}
	                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default disabled:opacity-80"
	                        style={{
	                          backgroundColor: isSaved ? '#dcfce7' : COLORS.blue,
	                          color: isSaved ? '#166534' : COLORS.white,
	                        }}
	                      >
	                        <CalendarDays className="h-3.5 w-3.5" />
	                        {isSaved ? 'Added to content calendar' : 'Add to content calendar'}
	                      </button>
	                    </div>
	                  );
	                })()}
	              </div>
	            </div>
	          ))
        )}

        {loading && !streamingContent && (
          <WorkingIndicator lastAction={lastAction} agentLabel={agentLabel} thinkingText={thinkingText} />
        )}

        {streamingContent && (
          <div
            className="mr-12 px-5 py-4 rounded-2xl overflow-hidden min-w-0 shadow-sm"
            style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.mediumGray}` }}
          >
            <p
              className="text-xs font-semibold mb-2 uppercase tracking-wide"
              style={{ color: COLORS.textSecondary }}
            >
              {agentLabel}
            </p>
            <div
              className="prose prose-base max-w-none"
              style={{ color: COLORS.charcoal }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
                urlTransform={markdownUrlTransform}
              >
                {streamingContent}
              </ReactMarkdown>
              {isStreaming && (
                <span
                  className="inline-block w-0.5 h-5 ml-1 animate-pulse rounded-full"
                  style={{ backgroundColor: COLORS.blue }}
                />
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area with voice recording */}
      <div
        className="px-4 py-4 border-t"
        style={{ backgroundColor: COLORS.white, borderColor: COLORS.mediumGray }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          data-testid="input-file-attachment"
        />

        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="rounded-2xl overflow-hidden transition-all"
          style={{
            backgroundColor: isDraggingOver ? COLORS.blueLight : COLORS.offWhite,
            border: isDraggingOver ? `2px solid ${COLORS.blue}` : `1px solid ${COLORS.mediumGray}`,
            boxShadow: isDraggingOver ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          {isDraggingOver && (
            <div
              className="flex items-center justify-center py-3 px-4 border-b"
              style={{ backgroundColor: COLORS.blueLight, borderColor: COLORS.blue }}
            >
              <FileImage className="w-4 h-4 mr-2" style={{ color: COLORS.blue }} />
              <span className="text-sm font-medium" style={{ color: COLORS.blue }}>
                Drop files here
              </span>
            </div>
          )}

          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {pendingAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs shadow-sm"
                  style={{ backgroundColor: COLORS.white, border: `1px solid ${COLORS.mediumGray}` }}
                  data-testid={`attachment-preview-${attachment.id}`}
                >
                  {attachment.contentType.startsWith('image/') ? (
                    <FileImage className="w-3.5 h-3.5" style={{ color: COLORS.blue }} />
                  ) : (
                    <File className="w-3.5 h-3.5" style={{ color: COLORS.textSecondary }} />
                  )}
                  <span
                    className="max-w-[100px] truncate"
                    style={{ color: COLORS.charcoal }}
                  >
                    {attachment.originalName}
                  </span>
                  <button
                    onClick={() => removeAttachment(attachment.id)}
                    className="ml-1 transition-colors"
                    style={{ color: COLORS.darkGray }}
                    data-testid={`button-remove-attachment-${attachment.id}`}
                  >
                    <X className="w-3.5 h-3.5 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={composerPlaceholder}
            className="w-full border-0 bg-transparent px-4 py-3 text-base focus:outline-none focus:ring-0 resize-none leading-relaxed"
            style={{ color: COLORS.charcoal }}
            rows={1}
            disabled={loading}
            data-testid="textarea-instruction"
          />

          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || isUploadingAttachment || pendingAttachments.length >= 5}
                className="h-9 w-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                style={{ backgroundColor: 'transparent' }}
                data-testid="button-attach-file"
                title="Attach files (images, PDFs)"
              >
                {isUploadingAttachment ? (
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: COLORS.darkGray }} />
                ) : (
                  <Paperclip className="w-5 h-5" style={{ color: COLORS.darkGray }} />
                )}
              </button>

              {/* Voice recorder */}
              <VoiceRecorder
                onTranscriptReady={handleVoiceTranscript}
                disabled={loading}
              />
            </div>

            <button
              onClick={loading ? undefined : sendMessage}
              disabled={(!input.trim() && pendingAttachments.length === 0) && !loading}
              className="h-9 w-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              style={{
                backgroundColor: loading ? COLORS.coral : COLORS.blue,
                color: COLORS.white,
              }}
              data-testid="button-send-message"
            >
              {loading ? <XCircle className="w-5 h-5" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <p
          className="text-xs mt-2 text-center"
          style={{ color: COLORS.darkGray }}
        >
          {shortcutPrefix}+Enter to send • Tap <Mic className="w-3 h-3 inline-block mx-0.5" /> to record
        </p>
      </div>
    </div>
  );
}
