import { useState, Suspense, LazyExoticComponent, ComponentType, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Bot, Folder, X, Minus, Activity, Moon, Heart, Calendar, Users, FileText, BarChart, Settings as SettingsIcon, ArrowUp, MessageCircle, ChevronUp, Plane, TrendingUp, LineChart, Dumbbell, Brain, Target, Zap, Star, Clock, CheckCircle, List, BookOpen, Coffee, Music, Camera, MapPin, Wallet, ShoppingCart, Gift, Lightbulb, Sparkles, Rocket, Home, Building, Globe, Mail, Phone, Video, Mic, Image, Play, Pause, Volume2, Wifi, Cloud, Sun, Umbrella, Thermometer, Wind, Droplets, Leaf, Flower2, Mountain, Waves, Compass, Map, Navigation, Car, Bike, Ship, Award, Trophy, Medal, Crown, Diamond, Gem, Key, Lock, Unlock, Shield, Eye, Search, Filter, SortAsc, Download, Upload, Share2, Link, ExternalLink, Copy, Clipboard, Trash2, Edit, Pencil, PenLine, PenTool, Scissors, Bookmark, Flag, Bell, AlertCircle, Info, HelpCircle, XCircle, CheckCircle2, Circle, Square, Triangle, Hexagon, Octagon, Hash, AtSign, DollarSign, Percent, Calculator, Code, Terminal, Database, Server, Cpu, Monitor, Smartphone, Tablet, Laptop, Watch, Headphones, Speaker, Radio, Tv, Printer, Scan, QrCode, Barcode, CreditCard, Receipt, Banknote, PiggyBank, TrendingDown, AreaChart, PieChart } from 'lucide-react';
import type { SpaceConfig, DesktopBranding, DesktopThemeTokens } from './types';
import { useSpaceRuntime } from './SpaceRuntimeContext';
import AgentChat from './components/AgentChat';
import FileBrowser from './components/FileBrowser';
import EmailGate from './components/EmailGate';
import Settings from './components/Settings';
// Note: tw import removed - using direct Tailwind classes for premium Buffer-inspired design

// Version marker for auto-upgrade detection
// Increment this when making changes that stale/overwritten published copies need to be replaced by
export const DESKTOP_VERSION = 2; // v2: Re-assert custom Bipp desktop shell over any overwritten/stale published copy

// Hook to detect mobile vs desktop using JS (prevents double-mounting of components)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768; // md breakpoint
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Listen for changes
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

interface AppErrorBoundaryProps {
  appName?: string;
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[AppErrorBoundary] App "${this.props.appName || 'unknown'}" crashed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: '#1a202c' }}>
            {this.props.appName ? `"${this.props.appName}" failed to load` : 'App failed to load'}
          </h2>
          <p style={{ fontSize: '14px', color: '#718096', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>
            {this.state.error?.message || 'An unexpected error occurred while loading this app.'}
          </p>
          <button
            onClick={() => {
              this.setState((prev) => ({ hasError: false, error: null, retryKey: prev.retryKey + 1 }));
            }}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            ↻ Retry
          </button>
        </div>
      );
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

function buildFontFamily(fontName?: string): string {
  if (!fontName) {
    return '"Space Grotesk", system-ui, -apple-system, sans-serif';
  }

  return `"${fontName}", system-ui, -apple-system, sans-serif`;
}

function resolveGenesisRuntimeTheme(config: SpaceConfig) {
  const branding = (config.desktop?.branding || {}) as DesktopBranding;
  const themeTokens = (config.desktop?.themeTokens || {}) as DesktopThemeTokens;
  const headingFont =
    themeTokens.typography?.headingFont ||
    branding.headingFont ||
    'Sora';
  const bodyFont =
    themeTokens.typography?.bodyFont ||
    branding.bodyFont ||
    headingFont;

  return {
    branding: {
      name: branding.name || config.name || 'Welcome',
      tagline: branding.tagline,
      logoUrl:
        branding.logoUrl ||
        (config as any).iconUrl ||
        (config as any).logoUrl,
    },
    themeTokens: {
      palette: themeTokens.palette || branding.palette || branding.colors,
      typography: {
        headingFont,
        bodyFont,
        fontFamily:
          themeTokens.typography?.fontFamily || buildFontFamily(headingFont),
      },
      shell: themeTokens.shell,
      cssVariables: themeTokens.cssVariables || {},
    },
  };
}

// Icon mapping for app icons - supports both PascalCase and lowercase
const baseIconMap: Record<string, ComponentType<any>> = {
  Activity, Moon, Heart, Calendar, Users, FileText, BarChart, Bot, Folder,
  Plane, TrendingUp, LineChart, Dumbbell, Brain, Target, Zap, Star, Clock,
  CheckCircle, List, BookOpen, Coffee, Music, Camera, MapPin, Wallet,
  ShoppingCart, Gift, Lightbulb, Sparkles, Rocket, Home, Building, Globe,
  Mail, Phone, Video, Mic, Image, Play, Pause, Volume2, Wifi, Cloud, Sun,
  Umbrella, Thermometer, Wind, Droplets, Leaf, Mountain, Waves, Compass,
  Map, Navigation, Car, Bike, Ship, Award, Trophy, Medal, Crown, Diamond,
  Gem, Key, Lock, Unlock, Shield, Eye, Search, Filter, SortAsc, Download,
  Upload, Share2, Link, ExternalLink, Copy, Clipboard, Trash2, Edit, Pencil,
  PenLine, PenTool, Scissors, Bookmark, Flag, Bell, AlertCircle, Info, HelpCircle,
  XCircle, CheckCircle2, Circle, Square, Triangle, Hexagon, Octagon, Hash,
  AtSign, DollarSign, Percent, Calculator, Code, Terminal, Database, Server,
  Cpu, Monitor, Smartphone, Tablet, Laptop, Watch, Headphones, Speaker,
  Radio, Tv, Printer, Scan, QrCode, Barcode, CreditCard, Receipt, Banknote,
  PiggyBank, TrendingDown, AreaChart, PieChart, Flower2,
};

// Create case-insensitive lookup with common aliases
const iconMap: Record<string, ComponentType<any>> = {};
Object.entries(baseIconMap).forEach(([key, value]) => {
  iconMap[key] = value;
  iconMap[key.toLowerCase()] = value;
  // Handle kebab-case (e.g., "line-chart" -> LineChart)
  const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  iconMap[kebabKey] = value;
});
// Common aliases
iconMap['chart'] = BarChart;
iconMap['graph'] = LineChart;
iconMap['workout'] = Dumbbell;
iconMap['fitness'] = Dumbbell;
iconMap['gym'] = Dumbbell;
iconMap['stock'] = TrendingUp;
iconMap['stocks'] = TrendingUp;
iconMap['trip'] = Plane;
iconMap['travel'] = Plane;
iconMap['flight'] = Plane;
iconMap['money'] = Wallet;
iconMap['finance'] = DollarSign;
iconMap['health'] = Heart;
iconMap['wellness'] = Heart;
iconMap['notes'] = FileText;
iconMap['note'] = FileText;
iconMap['log'] = List;
iconMap['tracker'] = Activity;
iconMap['tracking'] = Activity;
iconMap['ai'] = Sparkles;
iconMap['smart'] = Brain;
iconMap['idea'] = Lightbulb;
iconMap['ideas'] = Lightbulb;
iconMap['time'] = Clock;
iconMap['schedule'] = Calendar;
iconMap['event'] = Calendar;
iconMap['events'] = Calendar;
iconMap['people'] = Users;
iconMap['team'] = Users;
iconMap['community'] = Users;
iconMap['book'] = BookOpen;
iconMap['read'] = BookOpen;
iconMap['reading'] = BookOpen;
iconMap['shop'] = ShoppingCart;
iconMap['shopping'] = ShoppingCart;
iconMap['cart'] = ShoppingCart;
iconMap['location'] = MapPin;
iconMap['place'] = MapPin;
iconMap['weather'] = Cloud;
iconMap['photo'] = Camera;
iconMap['photos'] = Camera;
iconMap['video'] = Video;
iconMap['movie'] = Play;
iconMap['audio'] = Music;
iconMap['sound'] = Volume2;
iconMap['call'] = Phone;
iconMap['email'] = Mail;
iconMap['message'] = MessageCircle;
iconMap['messages'] = MessageCircle;
iconMap['chat'] = MessageCircle;
iconMap['settings'] = SettingsIcon;
iconMap['config'] = SettingsIcon;
iconMap['gear'] = SettingsIcon;
iconMap['write'] = PenLine;
iconMap['writing'] = PenLine;
iconMap['pen'] = PenLine;
iconMap['post'] = PenLine;
iconMap['content'] = PenLine;

interface SpaceDesktopProps {
  mode: 'entrepreneur' | 'customer';
  spaceId: string;
  sessionId?: string;
  config: SpaceConfig;
  apps: Record<string, LazyExoticComponent<any>>;
  LoadingSpinner: ComponentType;
  initialAppId?: string | null;
}

type WindowId = 'files' | 'agent' | 'settings' | string; // string for app IDs

interface FileAccessLog {
  timestamp: number;
  path: string;
  action: 'read' | 'write';
  tool: string;
}

export default function SpaceDesktop({
  mode,
  spaceId,
  sessionId: _unusedProp, // Ignore prop, read from context instead
  config,
  apps,
  LoadingSpinner,
  initialAppId
}: SpaceDesktopProps) {
  const { sessionId, isBootstrappingSession, trackEvent, subscriptionReady } = useSpaceRuntime();
  const isMobile = useIsMobile(); // JS-based media query to prevent double-mounting AgentChat

  // Timeout guard: if subscriptionReady stays false for too long, unblock the UI
  // so the user isn't stuck on an infinite spinner (fixes EmailGate hang bug).
  const [subscriptionTimedOut, setSubscriptionTimedOut] = useState(false);
  useEffect(() => {
    if (subscriptionReady) return;
    if (!sessionId) return;
    const timer = setTimeout(() => setSubscriptionTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [subscriptionReady, sessionId]);

  // Lock body/html scroll on mobile to prevent iOS Safari from scrolling
  // the page when the keyboard opens or the address bar animates.
  useEffect(() => {
    if (!isMobile) return;
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
    body.style.height = '100%';
    body.style.top = '0';
    body.style.left = '0';
    return () => {
      html.style.overflow = '';
      html.style.height = '';
      body.style.overflow = '';
      body.style.position = '';
      body.style.width = '';
      body.style.height = '';
      body.style.top = '';
      body.style.left = '';
    };
  }, [isMobile]);
  const [activeWindowId, setActiveWindowId] = useState<WindowId | null>(null);
  const [isAgentMinimized, setIsAgentMinimized] = useState(true); // Start minimized for launcher view
  const [fileAccessLogs, setFileAccessLogs] = useState<FileAccessLog[]>([]);
  const [launcherMessage, setLauncherMessage] = useState(''); // Message typed in launcher input
  const [pendingAgentMessage, setPendingAgentMessage] = useState<string | null>(null); // Message to send when agent opens
  const [hasChatHistory, setHasChatHistory] = useState<boolean | null>(null); // Track if user has chat history

  // Track whether hash change was triggered internally (to avoid minimizing agent on UI navigation)
  const isInternalHashChange = useRef(false);
  // Track if initial window setup has been done (to prevent deep link handler from re-running)
  const hasInitialized = useRef(false);
  // Track if space_entered has been tracked to avoid duplicates
  const hasTrackedSpaceEntry = useRef(false);

  const openApp = (appId: string) => {
    const app = config.apps.find(a => a.id === appId);
    if (app) {
      trackEvent('app_opened', { appId, appName: app.name });
    }
    setActiveWindowId(appId);
  };

  // Show email gate for customer mode if no session (from context)
  // Suppress gate while post-checkout auto-session bootstrap is in flight to avoid flashing EmailGate
  // Also bypass when the URL targets a public app (e.g. tokenised PhotoUpload deep-link from email):
  // the public app validates the token itself, so the EmailGate is not needed.
  const publicAppBypass = (() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const requestedAppId = params.get('app') || (window as any).__DEEP_LINK_APP_ID__ || initialAppId;
    if (!requestedAppId) return false;
    const matchingApp = config.apps.find(a => a.id.toLowerCase() === String(requestedAppId).toLowerCase());
    return !!matchingApp && (matchingApp as any).public === true;
  })();
  const showEmailGate = mode === 'customer' && !sessionId && !isBootstrappingSession && !publicAppBypass;

  // Determine if we're in "launcher" mode (empty desktop state on desktop)
  const isLauncherMode = activeWindowId === null && isAgentMinimized;

  // Track space_entered when session becomes available (first entry after email gate)
  useEffect(() => {
    if (sessionId && !hasTrackedSpaceEntry.current) {
      hasTrackedSpaceEntry.current = true;
      trackEvent('space_entered', {
        referrer: document.referrer || null,
        url: window.location.href,
      });
    }
  }, [sessionId, trackEvent]);

  // Check for chat history when session becomes available
  useEffect(() => {
    const checkChatHistory = async () => {
      // Build request params - prioritize sessionId from context (authoritative)
      // Fall back to localStorage only for email (needed for legacy compatibility)
      const params = new URLSearchParams();

      // sessionId from context is always authoritative (set by EmailGate)
      if (sessionId && sessionId.startsWith('wses_')) {
        params.set('sessionId', sessionId);
        console.log('[Desktop] Checking chat history with sessionId:', sessionId);
      }

      // Also include email from localStorage as fallback
      const sessionKey = `space_session_${spaceId}`;
      const stored = localStorage.getItem(sessionKey);
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session.email) {
            params.set('email', session.email);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Need at least sessionId or email
      if (!params.has('sessionId') && !params.has('email')) {
        setHasChatHistory(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/space/${spaceId}/chat/history?${params.toString()}`
        );

        if (response.ok) {
          const data = await response.json();
          setHasChatHistory(data.hasHistory === true && data.messageCount > 0);
        } else {
          setHasChatHistory(false);
        }
      } catch (e) {
        console.error('[Desktop] Failed to check chat history:', e);
        setHasChatHistory(false);
      }
    };

    if (sessionId) {
      checkChatHistory();
    }
  }, [sessionId, spaceId]);

  // Handle URL hash-based deep linking and set default window (ONLY on initial mount)
  useEffect(() => {
    if (hasInitialized.current) return;
    if (!sessionId && !publicAppBypass) return;

    hasInitialized.current = true;

    const hash = window.location.hash.slice(1).toLowerCase();
    const urlAppParam = new URLSearchParams(window.location.search).get('app') || (window as any).__DEEP_LINK_APP_ID__ || initialAppId;

    const deepLinkId = hash || urlAppParam?.toLowerCase() || '';

    if (deepLinkId) {
      const matchingApp = config.apps.find(
        app => app.id.toLowerCase() === deepLinkId || app.name.toLowerCase() === deepLinkId
      );

      if (matchingApp) {
        setActiveWindowId(matchingApp.id);
        setIsAgentMinimized(true);
        return;
      }

      if (deepLinkId === 'files' || deepLinkId === 'memory') {
        setActiveWindowId('files');
        setIsAgentMinimized(true);
        return;
      }

      if (deepLinkId === 'settings') {
        setActiveWindowId('settings');
        setIsAgentMinimized(true);
        return;
      }
    }

    // Default to launcher mode (null) if no hash - don't open agent
    // This shows the app grid on desktop
  }, [sessionId, config.apps]);

  // Update URL hash when active window changes (mark as internal to prevent agent minimizing)
  useEffect(() => {
    if (activeWindowId && activeWindowId !== 'agent') {
      const currentHash = window.location.hash.slice(1);
      if (currentHash !== activeWindowId) {
        isInternalHashChange.current = true;
        window.location.hash = activeWindowId;
        // Reset flag after hash update completes
        setTimeout(() => {
          isInternalHashChange.current = false;
        }, 0);
      }
    } else if (activeWindowId === 'agent' || activeWindowId === null) {
      // Clear hash for both agent and null (empty desktop)
      if (window.location.hash) {
        isInternalHashChange.current = true;
        window.location.hash = '';
        setTimeout(() => {
          isInternalHashChange.current = false;
        }, 0);
      }
    }
  }, [activeWindowId]);

  // Listen for browser back/forward navigation via hash changes
  useEffect(() => {
    const handleHashChange = () => {
      // Skip if this was an internal hash change (UI navigation)
      if (isInternalHashChange.current) {
        return;
      }

      const hash = window.location.hash.slice(1).toLowerCase();

      if (!hash) {
        // No hash - return to launcher mode (external navigation like back button)
        setActiveWindowId(null);
        setIsAgentMinimized(true);
        return;
      }

      // Try to find matching app
      const matchingApp = config.apps.find(
        app => app.id.toLowerCase() === hash || app.name.toLowerCase() === hash
      );

      if (matchingApp) {
        setActiveWindowId(matchingApp.id);
        // Only minimize agent for external hash changes (deep links, browser history)
        setIsAgentMinimized(true);
        return;
      }

      // Check for special windows
      if (hash === 'files' || hash === 'memory') {
        setActiveWindowId('files');
        setIsAgentMinimized(true);
        return;
      }

      if (hash === 'settings') {
        setActiveWindowId('settings');
        setIsAgentMinimized(true);
        return;
      }

      // Invalid hash - return to launcher mode
      setActiveWindowId(null);
      setIsAgentMinimized(true);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [config.apps]);

  // Listen for app deep-link events from agent chat
  useEffect(() => {
    const handleOpenApp = (event: CustomEvent) => {
      const { appId } = event.detail;
      if (appId) {
        setActiveWindowId(appId);
        setIsAgentMinimized(false); // Show agent in split view if minimized
      }
    };

    window.addEventListener('openApp', handleOpenApp as EventListener);
    return () => window.removeEventListener('openApp', handleOpenApp as EventListener);
  }, []);

  // Listen for closeApp events dispatched by mini-apps (e.g. VoiceBuddy)
  useEffect(() => {
    const handleCloseApp = () => {
      setActiveWindowId(null);
      setIsAgentMinimized(true);
    };

    window.addEventListener('closeApp', handleCloseApp as EventListener);
    return () => window.removeEventListener('closeApp', handleCloseApp as EventListener);
  }, []);

  // Keyboard shortcut: Cmd+M (Mac) / Ctrl+M (Windows) to toggle Memory window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (activeWindowId === 'files') {
          setActiveWindowId(null);
        } else {
          setActiveWindowId('files');
          setIsAgentMinimized(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWindowId]);

  const handleFileAccess = (log: FileAccessLog) => {
    setFileAccessLogs(prev => [...prev, log]);
  };

  // Get current app config and component if viewing an app
  const isAppWindow = activeWindowId && !['files', 'agent'].includes(activeWindowId);
  const currentAppConfig = isAppWindow ? config.apps.find(app => app.id === activeWindowId) : null;
  const CurrentApp = isAppWindow && activeWindowId ? apps[activeWindowId] : null;

  const runtimeTheme = resolveGenesisRuntimeTheme(config);
  const themeVariables = (runtimeTheme.themeTokens.cssVariables || {}) as Record<string, string>;
  const rootStyle = {
    ...themeVariables,
    ['--space-font-family' as any]:
      runtimeTheme.themeTokens.typography?.fontFamily ||
      `"${runtimeTheme.themeTokens.typography?.headingFont || 'Space Grotesk'}", system-ui, -apple-system, sans-serif`,
    fontFamily:
      runtimeTheme.themeTokens.typography?.fontFamily ||
      `"${runtimeTheme.themeTokens.typography?.headingFont || 'Space Grotesk'}", system-ui, -apple-system, sans-serif`,
    // Clean off-white background for premium look
    background: '#FAFAFA',
  } as React.CSSProperties;

  // Show brief loading indicator while post-checkout auto-session is being established
  if (isBootstrappingSession) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-gray-50"
      >
        <div className="flex flex-col items-center gap-3">
          {LoadingSpinner ? <LoadingSpinner /> : <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
          <span className="text-sm text-gray-600">Setting up your account…</span>
        </div>
      </div>
    );
  }

  // Show email gate if no session in customer mode
  if (showEmailGate) {
    return (
      <EmailGate
        spaceId={spaceId}
        branding={runtimeTheme.branding}
        themeTokens={runtimeTheme.themeTokens}
      />
    );
  }

  // Block rendering until subscription status resolves to prevent
  // flashing protected dashboard content before the access check redirects.
  // Falls through after 8s timeout to prevent infinite spinner.
  if (mode === 'customer' && sessionId && !subscriptionReady && !subscriptionTimedOut) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-gray-50"
      >
        <div className="flex flex-col items-center gap-3">
          {LoadingSpinner ? <LoadingSpinner /> : <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Google Fonts - Load brand font or fallback to Sora */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {runtimeTheme.themeTokens.typography?.headingFont && (
        <link
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(runtimeTheme.themeTokens.typography.headingFont)}:wght@300;400;500;600;700;800&display=swap`}
          rel="stylesheet"
        />
      )}
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <div 
        className="min-h-screen"
        style={rootStyle}
      >
        {/* Left Dock - Desktop Only - Premium clean design */}
      <div className={`hidden md:flex fixed top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-xl p-3 z-50 transition-all duration-500 ease-in-out rounded-2xl border border-gray-200/60 shadow-lg ${
        isLauncherMode
          ? '-left-20 opacity-0'
          : 'left-4 opacity-100'
      }`}>
        <div className="flex flex-col gap-2">
          {/* Memory Icon - Hidden in customer mode (use Cmd+M to access for debugging) */}
          {mode === 'entrepreneur' && (
            <button
              onClick={() => setActiveWindowId('files')}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                activeWindowId === 'files'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              title="Memory"
            >
              <Folder className="w-5 h-5" />
            </button>
          )}

          {/* App Icons */}
          {config.apps.map(app => {
            const isActive = activeWindowId === app.id;
            const IconComponent = app.icon && iconMap[app.icon] ? iconMap[app.icon] : Activity;
            return (
              <button
                key={app.id}
                onClick={() => openApp(app.id)}
                className={`p-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={app.name}
              >
                <IconComponent className="w-5 h-5" />
              </button>
            );
          })}

          {/* Divider */}
          <div className="h-px bg-gray-200 my-1"></div>

          {/* Settings Icon */}
          <button
            onClick={() => setActiveWindowId('settings')}
            className={`p-2.5 rounded-xl transition-all duration-200 ${
              activeWindowId === 'settings'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Desktop: Main Content Area */}
      <div className="hidden md:block py-16 min-h-screen">
        {/* Agent-Centric Launcher - Premium Buffer-inspired design */}
        {isLauncherMode && (
          <div className="flex flex-col items-center min-h-[calc(100vh-8rem)] px-6 animate-in fade-in duration-500">
            {/* Compact Branding - moved up and smaller */}
            {runtimeTheme.branding.name && (
              <div className="text-center pt-8 mb-6">
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                  {runtimeTheme.branding.name}
                </h1>
                {runtimeTheme.branding.tagline && (
                  <p className="text-sm text-gray-500">
                    {runtimeTheme.branding.tagline}
                  </p>
                )}
              </div>
            )}

            {/* Agent Chat - The Star - Prominent and centered */}
            <div className="w-full max-w-2xl mb-8">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                {/* Agent Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-md">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Bipp</h2>
                    <p className="text-xs text-gray-500">{hasChatHistory ? 'Continue where you left off' : 'How can I help you today?'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWindowId('agent');
                      setIsAgentMinimized(false);
                    }}
                    className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    {hasChatHistory ? 'View History' : 'Full Chat'} →
                  </button>
                </div>

                {/* Large Prominent Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (launcherMessage.trim()) {
                      setPendingAgentMessage(launcherMessage.trim());
                      setLauncherMessage('');
                      setActiveWindowId('agent');
                      setIsAgentMinimized(false);
                    }
                  }}
                  className="p-5"
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      value={launcherMessage}
                      onChange={(e) => setLauncherMessage(e.target.value)}
                      placeholder={hasChatHistory ? "Continue your conversation..." : "Ask me anything..."}
                      className="flex-1 text-base text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!launcherMessage.trim()}
                      className={`p-3 rounded-xl transition-all duration-200 ${
                        launcherMessage.trim()
                          ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                    <Sparkles className="w-3 h-3" />
                    <span>Powered by AI • Press Enter to send</span>
                  </div>
                </form>
              </div>
            </div>

            {/* App Grid - Secondary, below the agent */}
            <div className="w-full max-w-3xl">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4 px-1">Your Tools</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* App Cards - Clean white design */}
                {config.apps.map(app => {
                  const IconComponent = app.icon && iconMap[app.icon] ? iconMap[app.icon] : Activity;
                  return (
                    <button
                      key={app.id}
                      onClick={() => {
                        openApp(app.id);
                        setIsAgentMinimized(true);
                      }}
                      className="group flex flex-col items-center p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-200 hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                    >
                      <div className="w-12 h-12 flex items-center justify-center bg-blue-50 rounded-xl mb-3 group-hover:bg-blue-100 transition-colors">
                        <IconComponent className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 mb-0.5">{app.name}</h3>
                      <p className="text-xs text-gray-500 text-center line-clamp-1">
                        {app.description || `Open ${app.name}`}
                      </p>
                    </button>
                  );
                })}

                {/* Memory Card - Hidden in customer mode (use Cmd+M to access for debugging) */}
                {mode === 'entrepreneur' && (
                  <button
                    onClick={() => {
                      setActiveWindowId('files');
                      setIsAgentMinimized(true);
                    }}
                    className="group flex flex-col items-center p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-200 hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                  >
                    <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl mb-3 group-hover:bg-gray-200 transition-colors">
                      <Folder className="w-6 h-6 text-gray-600" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-0.5">Memory</h3>
                    <p className="text-xs text-gray-500 text-center line-clamp-1">
                      Browse files and data
                    </p>
                  </button>
                )}

                {/* Settings Card */}
                <button
                  onClick={() => {
                    setActiveWindowId('settings');
                    setIsAgentMinimized(true);
                  }}
                  className="group flex flex-col items-center p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                >
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl mb-3 group-hover:bg-gray-200 transition-colors">
                    <SettingsIcon className="w-6 h-6 text-gray-600" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-0.5">Settings</h3>
                  <p className="text-xs text-gray-500 text-center line-clamp-1">
                    Configure workspace
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Normal window layout - Premium clean design */}
        {!isLauncherMode && (
        <>
        <div className="flex items-center justify-center gap-6 px-6 overflow-hidden">
          {/* App Window - LEFT side, slides in when selected */}
          {activeWindowId && activeWindowId !== 'agent' && (
            <div
              className={`min-w-0 h-[calc(100vh-8rem)] transition-all duration-500 ease-in-out ${
                isAgentMinimized
                  ? 'w-full max-w-3xl'
                  : 'w-full max-w-xl'
              }`}
            >
              <div className="w-full h-full flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                {/* App Header - Clean minimal */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    {activeWindowId === 'files' && (
                      <>
                        <Folder className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-900">Memory</span>
                      </>
                    )}
                    {activeWindowId === 'settings' && (
                      <>
                        <SettingsIcon className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-900">Settings</span>
                      </>
                    )}
                    {isAppWindow && currentAppConfig && (
                      <>
                        {(() => {
                          const IconComponent = currentAppConfig.icon && iconMap[currentAppConfig.icon] ? iconMap[currentAppConfig.icon] : Activity;
                          return <IconComponent className="w-4 h-4 text-blue-600" />;
                        })()}
                        <span className="text-sm font-semibold text-gray-900">{currentAppConfig.name}</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      // When closing window, show empty desktop
                      setActiveWindowId(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
                {/* App Content */}
                <div className="flex-1 overflow-y-auto min-h-0 bg-white">
                  {activeWindowId === 'files' && (
                    <FileBrowser fileAccessLogs={fileAccessLogs} />
                  )}
                  {activeWindowId === 'settings' && (
                    <Settings spaceId={spaceId} />
                  )}
                  {isAppWindow && CurrentApp && currentAppConfig && (
                    <AppErrorBoundary key={currentAppConfig.id} appName={currentAppConfig.name}>
                      <Suspense fallback={<LoadingSpinner />}>
                        <CurrentApp appConfig={currentAppConfig} dataFile={currentAppConfig.dataFile || ''} />
                      </Suspense>
                    </AppErrorBoundary>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Agent Window - RIGHT side, always visible unless minimized */}
          {/* Only render on desktop (not mobile) to prevent double-mounting */}
          {!isAgentMinimized && !isMobile && (
            <div
              className={`min-w-0 h-[calc(100vh-8rem)] transition-all duration-500 ease-in-out ${
                activeWindowId && activeWindowId !== 'agent'
                  ? 'w-full max-w-xl'
                  : 'w-full max-w-3xl'
              }`}
            >
              <div className="w-full h-full flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                {/* Agent Header - Premium with gradient */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Bipp</span>
                  </div>
                  <button
                    onClick={() => setIsAgentMinimized(true)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Minimize"
                  >
                    <Minus className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {/* Agent Content */}
                <div className="flex-1 overflow-hidden bg-white">
                  <AgentChat
                  spaceId={spaceId}
                  onFileAccess={handleFileAccess}
                  pendingMessage={pendingAgentMessage}
                  onPendingMessageConsumed={() => setPendingAgentMessage(null)}
                />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Restore Agent Button - Bottom right when minimized (but not in launcher mode) */}
        {isAgentMinimized && (
          <button
            onClick={() => setIsAgentMinimized(false)}
            className="fixed bottom-8 right-8 flex items-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 z-50"
          >
            <Bot className="w-5 h-5" />
            <span className="text-sm font-medium">Bipp</span>
          </button>
        )}
        </>
        )}
      </div>

      {/* Mobile: Vertical Stack Layout - Premium clean design */}
      <div className="md:hidden fixed inset-0 flex flex-col pb-16 overflow-hidden bg-gray-50">
        {/* Main Content - Agent or App */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Agent View */}
          {/* Only render on mobile to prevent double-mounting */}
          {(!activeWindowId || activeWindowId === 'agent') && isMobile && (
            <div className="h-full flex flex-col bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">Bipp</span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden bg-white">
                <AgentChat
                  spaceId={spaceId}
                  onFileAccess={handleFileAccess}
                  pendingMessage={pendingAgentMessage}
                  onPendingMessageConsumed={() => setPendingAgentMessage(null)}
                />
              </div>
            </div>
          )}

          {/* App View */}
          {activeWindowId && activeWindowId !== 'agent' && (
            <div className="h-full flex flex-col bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  {activeWindowId === 'files' && (
                    <>
                      <Folder className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-900">Memory</span>
                    </>
                  )}
                  {activeWindowId === 'settings' && (
                    <>
                      <SettingsIcon className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-900">Settings</span>
                    </>
                  )}
                  {isAppWindow && currentAppConfig && (
                    <>
                      {(() => {
                        const IconComponent = currentAppConfig.icon && iconMap[currentAppConfig.icon] ? iconMap[currentAppConfig.icon] : Activity;
                        return <IconComponent className="w-4 h-4 text-blue-600" />;
                      })()}
                      <span className="text-sm font-semibold text-gray-900">{currentAppConfig.name}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    // When closing window, show agent on mobile
                    setActiveWindowId('agent');
                    setIsAgentMinimized(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 bg-white">
                {activeWindowId === 'files' && (
                  <FileBrowser fileAccessLogs={fileAccessLogs} />
                )}
                {activeWindowId === 'settings' && (
                  <Settings spaceId={spaceId} />
                )}
                {isAppWindow && CurrentApp && currentAppConfig && (
                  <AppErrorBoundary key={currentAppConfig.id} appName={currentAppConfig.name}>
                    <Suspense fallback={<LoadingSpinner />}>
                      <CurrentApp appConfig={currentAppConfig} dataFile={currentAppConfig.dataFile || ''} />
                    </Suspense>
                  </AppErrorBoundary>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Dock - Premium clean design */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200 px-3 py-2 safe-bottom">
          <div className="flex items-center justify-center gap-1.5">
            {/* Files Icon - Hidden in customer mode (use Cmd+M to access for debugging) */}
            {mode === 'entrepreneur' && (
              <button
                onClick={() => setActiveWindowId('files')}
                className={`p-2.5 rounded-xl transition-all duration-200 ${
                  activeWindowId === 'files'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Folder className="w-5 h-5" />
              </button>
            )}

            {/* App Icons */}
            {config.apps.map(app => {
              const isActive = activeWindowId === app.id;
              const IconComponent = app.icon && iconMap[app.icon] ? iconMap[app.icon] : Activity;
              return (
                <button
                  key={app.id}
                  onClick={() => setActiveWindowId(app.id)}
                  className={`p-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                </button>
              );
            })}

            {/* Settings Icon */}
            <button
              onClick={() => setActiveWindowId('settings')}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                activeWindowId === 'settings'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
            </button>

            {/* Spacer to push chat to the right */}
            <div className="flex-1"></div>

            {/* Agent Icon - Always farthest right, premium styling */}
            <button
              onClick={() => {
                setActiveWindowId('agent');
                setIsAgentMinimized(false);
              }}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                (!activeWindowId || activeWindowId === 'agent')
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Bot className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
