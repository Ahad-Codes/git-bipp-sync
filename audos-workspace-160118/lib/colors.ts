/**
 * Genesis Space Design System
 * 
 * A cohesive color, typography, and component style system for the genesis space template.
 * All components should reference these constants for visual consistency.
 * 
 * IMPORTANT FOR APP BUILDERS:
 * When building apps, you MUST update the brand colors below to match the workspace branding.
 * Replace WORKSPACE_PRIMARY_COLOR and WORKSPACE_HIGHLIGHT_COLOR with actual brand hex values.
 * 
 * Color Philosophy:
 * - Brand: The main brand color used for primary actions (from workspace branding)
 * - Accent: Secondary brand color for highlights and agent elements (from workspace branding)
 * - Semantic: Green (success), Red (danger), Yellow (warning)
 * - Neutrals: Grays for backgrounds, text, and borders
 */

// =============================================================================
// CORE THEME CONFIGURATION - UPDATE THESE WITH WORKSPACE BRAND COLORS!
// =============================================================================

/**
 * Brand colors - These define the visual identity
 * IMPORTANT: Replace these hex values with the workspace brand colors:
 * - primary.600 should be WORKSPACE_PRIMARY_COLOR
 * - accent.600 should be WORKSPACE_HIGHLIGHT_COLOR (or primary if no distinct highlight)
 */
export const brand = {
  // Primary brand color - used for main actions, buttons, links
  primary: {
    50: 'var(--space-brand-primary-50)',
    100: 'var(--space-brand-primary-100)',
    200: 'var(--space-brand-primary-200)',
    500: 'var(--space-brand-primary-500)',
    600: 'var(--space-brand-primary-600)',
    700: 'var(--space-brand-primary-700)',
    900: 'var(--space-brand-primary-900)',
  },
  accent: {
    50: 'var(--space-brand-highlight-50)',
    100: 'var(--space-brand-highlight-100)',
    200: 'var(--space-brand-highlight-200)',
    500: 'var(--space-brand-highlight-500)',
    600: 'var(--space-brand-highlight-600)',
    700: 'var(--space-brand-highlight-700)',
    900: 'var(--space-brand-highlight-900)',
  },
} as const;

/**
 * Semantic colors - Use for status and feedback
 */
export const semantic = {
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#a16207',
  },
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
} as const;

/**
 * Neutral colors - Backgrounds, text, borders
 */
export const neutral = {
  0: '#ffffff',
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
  950: '#030712',
} as const;

// =============================================================================
// TYPOGRAPHY SYSTEM
// =============================================================================

/**
 * Typography configuration
 * Font family is injected via Google Fonts in Desktop.tsx
 * IMPORTANT: Update the fontFamily to match workspace brand fonts from config.json!
 */
export const typography = {
  // Font family - loaded via Google Fonts link in Desktop.tsx
  fontFamily: 'var(--space-font-family, "Space Grotesk", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  
  // Font sizes with line heights
  size: {
    xs: 'text-xs',      // 12px
    sm: 'text-sm',      // 14px
    base: 'text-base',  // 16px
    lg: 'text-lg',      // 18px
    xl: 'text-xl',      // 20px
    '2xl': 'text-2xl',  // 24px
    '3xl': 'text-3xl',  // 30px
    '4xl': 'text-4xl',  // 36px
  },
  
  // Font weights
  weight: {
    light: 'font-light',      // 300
    normal: 'font-normal',    // 400
    medium: 'font-medium',    // 500
    semibold: 'font-semibold', // 600
    bold: 'font-bold',        // 700
  },
  
  // Text colors
  // NOTE: Update accent color class to match workspace brand (replace text-[#47191b] with brand color)
  color: {
    primary: 'text-[var(--space-text-primary)]',      // Headings, important text
    secondary: 'text-[var(--space-text-secondary)]',    // Body text, descriptions
    tertiary: 'text-[var(--space-text-muted)]',     // Subtle text, captions
    muted: 'text-[var(--space-text-muted)]',        // Placeholder, disabled
    inverse: 'text-white',         // On dark backgrounds
    brand: 'text-[var(--space-text-brand)]',
    accent: 'text-[var(--space-text-accent)]',
    danger: 'text-red-600',        // Error text
    success: 'text-green-700',     // Success text
  },
} as const;

// =============================================================================
// LEGACY COLORS OBJECT (for backwards compatibility)
// =============================================================================

export const colors = {
  primary: brand.primary,
  accent: brand.accent,
  success: semantic.success,
  warning: semantic.warning,
  danger: semantic.danger,
  neutral,
  
  // Gradient backgrounds (for Desktop background)
  gradients: {
    default: 'from-[#fff7f7] via-[#c4f8e6] to-[#edfaff]',
    warm: 'from-orange-50 via-rose-50 to-pink-50',
    cool: 'from-cyan-50 via-sky-50 to-blue-50',
    nature: 'from-emerald-50 via-teal-50 to-cyan-50',
    purple: 'from-purple-50 via-fuchsia-50 to-pink-50',
  },
  
  // Glass/frosted effect
  glass: {
    background: 'bg-[var(--space-surface-panel)] backdrop-blur-lg',
    border: 'border-[var(--space-border-default)]',
  }
} as const;

// =============================================================================
// TAILWIND CLASS HELPERS
// =============================================================================

/**
 * Tailwind class helpers for common UI patterns
 * Use these in your components for consistency
 */
export const tw = {
  // ---------------------------------------------------------------------------
  // BUTTONS
  // ---------------------------------------------------------------------------
  button: {
    // Primary action button (main CTA)
    primary: 'bg-[var(--space-brand-primary)] hover:brightness-95 text-[var(--space-text-on-primary)] font-medium transition-all',
    brand: 'bg-[var(--space-brand-primary)] hover:brightness-95 text-[var(--space-text-on-primary)] font-medium transition-all',
    accent: 'bg-[var(--space-brand-highlight)] hover:brightness-95 text-[var(--space-text-on-highlight)] font-medium transition-all',
    // Secondary button
    secondary: 'bg-[var(--space-surface-muted)] hover:brightness-95 text-[var(--space-text-primary)] font-medium transition-all',
    // Danger button
    danger: 'bg-red-600 hover:bg-red-700 text-white font-medium transition-all',
    // Ghost button (transparent)
    ghost: 'hover:bg-[var(--space-surface-muted)] text-[var(--space-text-primary)] transition-all',
    // Disabled state modifier
    disabled: 'opacity-50 cursor-not-allowed',
  },
  
  // ---------------------------------------------------------------------------
  // FORM INPUTS
  // ---------------------------------------------------------------------------
  input: {
    // Base input styles
    base: 'w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all',
    // Default state
    default: 'border-[var(--space-border-default)] bg-[var(--space-surface-card)] text-[var(--space-text-primary)] focus:ring-[var(--space-brand-primary)]',
    // Error state
    error: 'border-red-300 focus:ring-red-500',
    // Disabled state
    disabled: 'bg-[var(--space-surface-muted)] text-[var(--space-text-muted)] cursor-not-allowed',
  },
  
  // ---------------------------------------------------------------------------
  // DOCK (left navigation)
  // ---------------------------------------------------------------------------
  dock: {
    active: 'bg-[var(--space-brand-primary)] text-[var(--space-shell-dock-text)] shadow-lg',
    inactive: 'bg-[var(--space-surface-card)] hover:brightness-95 text-[var(--space-text-primary)]',
    glass: 'bg-[var(--space-surface-panel)] backdrop-blur-lg rounded-2xl shadow-xl',
  },
  
  // ---------------------------------------------------------------------------
  // MESSAGE BUBBLES (chat)
  // ---------------------------------------------------------------------------
  message: {
    user: 'bg-[var(--space-surface-accent-soft)] text-[var(--space-text-primary)]',
    assistant: 'bg-[var(--space-surface-panel)] text-[var(--space-text-primary)]',
  },
  
  // ---------------------------------------------------------------------------
  // ICONS - UPDATE accent with brand color (NOT purple)
  // ---------------------------------------------------------------------------
  icon: {
    primary: 'text-[var(--space-text-brand)]',
    accent: 'text-[var(--space-text-accent)]',
    neutral: 'text-[var(--space-text-secondary)]',
    muted: 'text-[var(--space-text-muted)]',
    danger: 'text-red-600',
    success: 'text-green-600',
  },
  
  // ---------------------------------------------------------------------------
  // CARDS
  // ---------------------------------------------------------------------------
  card: {
    default: 'bg-[var(--space-surface-card)] border border-[var(--space-border-default)] rounded-lg shadow-sm hover:shadow-md transition-shadow',
    elevated: 'bg-[var(--space-surface-card)] rounded-2xl shadow-xl',
    glass: 'bg-[var(--space-surface-panel)] backdrop-blur-md border border-[var(--space-border-default)] rounded-2xl shadow-lg',
    flat: 'bg-[var(--space-surface-muted)] rounded-lg border border-[var(--space-border-default)]',
  },
  
  // ---------------------------------------------------------------------------
  // BADGES / PILLS - UPDATE accent with brand color (NOT purple)
  // ---------------------------------------------------------------------------
  badge: {
    default: 'px-2 py-0.5 text-xs font-medium rounded-full',
    primary: 'bg-[var(--space-surface-accent-soft)] text-[var(--space-text-brand)]',
    accent: 'bg-[var(--space-brand-highlight-100)] text-[var(--space-text-accent)]',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    neutral: 'bg-[var(--space-surface-muted)] text-[var(--space-text-secondary)]',
  },
  
  // ---------------------------------------------------------------------------
  // LAYOUTS
  // ---------------------------------------------------------------------------
  layout: {
    // Full-screen centered layout (for gates, modals)
    centerScreen: 'min-h-screen flex items-center justify-center',
    // Container with padding
    container: 'max-w-md w-full mx-auto p-8',
  },
  
  // ---------------------------------------------------------------------------
  // BACKGROUNDS & GRADIENTS - UPDATE accent with brand color (NOT purple)
  // ---------------------------------------------------------------------------
  bg: {
    page: 'bg-[linear-gradient(135deg,var(--space-surface-gradient-from),var(--space-surface-gradient-via),var(--space-surface-gradient-to))]',
    gate: 'bg-[linear-gradient(135deg,var(--space-surface-gradient-from),var(--space-surface-gradient-via),var(--space-surface-gradient-to))]',
    card: 'bg-[var(--space-surface-card)]',
    muted: 'bg-[var(--space-surface-muted)]',
    accent: 'bg-[var(--space-surface-accent-soft)]',
  },
  
  // ---------------------------------------------------------------------------
  // AGENT (AI Assistant styling) - UPDATE ALL with brand color (NOT purple!)
  // ---------------------------------------------------------------------------
  agent: {
    icon: 'text-[var(--space-shell-icon)]',
    fab: 'bg-[var(--space-brand-highlight)] hover:brightness-95 text-[var(--space-text-on-highlight)]',
    headerIcon: 'text-[var(--space-shell-icon)]',
    dockActive: 'bg-[var(--space-brand-highlight)] text-[var(--space-text-on-highlight)]',
    dockInactive: 'bg-[var(--space-surface-muted)] text-[var(--space-text-primary)]',
  },
  
  // ---------------------------------------------------------------------------
  // APP ICONS (mini app icon colors) - UPDATE active with brand color (NOT purple)
  // ---------------------------------------------------------------------------
  appIcon: {
    // Default app icon color
    default: 'text-[var(--space-text-brand)]',
    // Files/Memory icon
    files: 'text-[var(--space-text-brand)]',
    // Settings icon  
    settings: 'text-[var(--space-text-secondary)]',
    active: 'text-[var(--space-text-accent)]',
  },
  
  // ---------------------------------------------------------------------------
  // LEGACY (for backwards compatibility)
  // ---------------------------------------------------------------------------
  priority: {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  },
  
  category: {
    work: 'bg-[var(--space-surface-accent-soft)] text-[var(--space-text-brand)]',
    ideas: 'bg-[var(--space-brand-highlight-100)] text-[var(--space-text-accent)]',
    personal: 'bg-green-100 text-green-700',
    other: 'bg-[var(--space-surface-muted)] text-[var(--space-text-secondary)]',
  }
} as const;

// =============================================================================
// COMPONENT-SPECIFIC STYLES
// =============================================================================

/**
 * EmailGate and authentication screen styles
 * Mobile-first responsive design with safe area support
 */
export const authStyles = {
  // Container - full screen centered with gradient, mobile-friendly padding
  container: `${tw.layout.centerScreen} ${tw.bg.gate} p-4 sm:p-8 safe-top safe-bottom`,
  // Card - elevated white card with responsive padding
  card: `${tw.card.elevated} p-6 sm:p-8 max-w-md w-full mx-4 sm:mx-auto`,
  // Title - responsive font size
  title: `text-xl sm:text-2xl ${typography.weight.semibold} ${typography.color.primary} text-center mb-2`,
  // Subtitle
  subtitle: `${typography.size.sm} ${typography.color.secondary} text-center`,
  // Input wrapper
  inputWrapper: 'space-y-4',
  // Input field - larger touch targets on mobile
  input: (hasError: boolean) => 
    `${tw.input.base} ${hasError ? tw.input.error : tw.input.default} text-base`,
  // Error message
  errorText: `mt-1.5 ${typography.size.xs} ${typography.color.danger}`,
  // Submit button - larger touch target on mobile
  submitButton: (disabled: boolean) =>
    `w-full px-4 py-3.5 sm:py-3 rounded-lg ${tw.button.primary} ${disabled ? tw.button.disabled : ''} text-base`,
  // Footer text
  footerText: `${typography.size.xs} ${typography.color.tertiary} text-center mt-4`,
} as const;

/**
 * Settings screen styles
 */
export const settingsStyles = {
  container: 'h-full overflow-y-auto',
  innerContainer: 'max-w-md mx-auto p-8',
  section: 'space-y-6',
  label: `block ${typography.size.sm} ${typography.weight.medium} ${typography.color.primary} mb-2`,
  input: (hasError: boolean) => 
    `${tw.input.base} ${hasError ? tw.input.error : tw.input.default}`,
  errorText: `mt-1.5 ${typography.size.xs} ${typography.color.danger}`,
  saveButton: (disabled: boolean) =>
    `w-full px-4 py-2.5 rounded-lg ${tw.button.primary} flex items-center justify-center gap-2 ${disabled ? tw.button.disabled : ''}`,
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get gradient class from config or return default
 */
export function getGradientClass(gradient?: string): string {
  return gradient || tw.bg.page;
}

/**
 * Get font family style object for inline styles
 */
export function getFontFamily(): React.CSSProperties {
  return { fontFamily: 'var(--space-font-family, "Space Grotesk", system-ui, sans-serif)' };
}

/**
 * Combine class names (simple utility)
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

function patchBippLauncherCopy(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  type LauncherHistoryState = 'unknown' | 'checking' | 'available' | 'empty';

  const starterPrompts = [
    'Help me build a marketing plan',
    'Help me tell my story',
    'What should my organic social strategy be?',
  ];
  let historyState: LauncherHistoryState = 'unknown';
  let historyLookupKey = '';
  let requestLauncherPatch = () => {};

  const setLauncherInputValue = (input: HTMLInputElement, value: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  };

  const isVisibleElement = (element: Element | null): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };

  const setComposerValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.focus();
  };

  const findBottomBippButton = () => {
    return Array.from(document.querySelectorAll('button')).find((button) => {
      if ((button.textContent || '').trim() !== 'Bipp') return false;
      return isVisibleElement(button) && window.getComputedStyle(button).position === 'fixed';
    }) as HTMLButtonElement | undefined;
  };

  const openChatAndPopulate = (value?: string) => {
    const bottomBippButton = findBottomBippButton();
    bottomBippButton?.click();
    if (!value) return;

    const populate = () => {
      const composer = Array.from(document.querySelectorAll('textarea[placeholder], input[placeholder]')).find((field) => {
        if (!isVisibleElement(field)) return false;
        const placeholder = field.getAttribute('placeholder') || '';
        return placeholder.includes('marketing challenge') || placeholder.includes('customer-growth');
      }) as HTMLInputElement | HTMLTextAreaElement | undefined;
      if (composer) {
        setComposerValue(composer, value);
      }
    };

    window.setTimeout(populate, 450);
    window.setTimeout(populate, 1000);
  };

  const openToolByTitle = (title: string) => {
    const toolButton = Array.from(document.querySelectorAll('button')).find((button) => {
      return button.getAttribute('title') === title && isVisibleElement(button);
    }) as HTMLButtonElement | undefined;
    toolButton?.click();
  };

  const findDesktopCenter = () => {
    return Array.from(document.querySelectorAll('div')).find((element) => {
      const className = String(element.className || '');
      return className.includes('items-center') &&
        className.includes('justify-center') &&
        className.includes('gap-6') &&
        className.includes('overflow-hidden');
    }) as HTMLElement | undefined;
  };

  const removeMinimizedLauncherFallback = () => {
    document.querySelector('[data-bipp-minimized-launcher]')?.remove();
  };

  const createFallbackButton = (label: string, className: string, onClick: () => void) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.className = className;
    button.addEventListener('click', onClick);
    return button;
  };

  const renderMinimizedLauncherFallback = (launcherInput?: HTMLInputElement) => {
    if (launcherInput) {
      removeMinimizedLauncherFallback();
      return;
    }

    const center = findDesktopCenter();
    const bottomBippButton = findBottomBippButton();
    if (!center || !bottomBippButton) {
      removeMinimizedLauncherFallback();
      return;
    }

    const existing = center.querySelector('[data-bipp-minimized-launcher]') as HTMLElement | null;
    const hasRealContent = Array.from(center.children).some((child) => {
      if (child === existing) return false;
      if (!isVisibleElement(child)) return false;
      const text = (child.textContent || '').trim();
      return Boolean(text || child.querySelector('form,input,textarea,button'));
    });

    if (hasRealContent) {
      existing?.remove();
      return;
    }

    const historyAvailable = historyState === 'available';
    if (existing && existing.getAttribute('data-history-available') === String(historyAvailable)) {
      return;
    }
    existing?.remove();

    const fallback = document.createElement('div');
    fallback.setAttribute('data-bipp-minimized-launcher', 'true');
    fallback.setAttribute('data-history-available', String(historyAvailable));
    fallback.className = 'mx-auto w-full max-w-3xl px-6 py-6';

    const grid = document.createElement('div');
    grid.className = 'grid gap-4';

    const chatCard = document.createElement('div');
    chatCard.className = 'flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm';

    const label = document.createElement('p');
    label.textContent = 'Bipp';
    label.className = 'mb-3 text-xs font-semibold uppercase';
    label.style.color = '#3B82F6';
    label.style.letterSpacing = '0.22em';

    const heading = document.createElement('h1');
    heading.textContent = 'How are you marketing today?';
    heading.className = 'font-bold leading-tight';
    heading.style.color = '#1F2937';
    heading.style.fontSize = 'clamp(1.55rem, 1.8vw, 2rem)';
    heading.style.letterSpacing = '0';

    const actions = document.createElement('div');
    actions.className = 'mt-5 grid gap-2';

    if (historyAvailable) {
      actions.append(createFallbackButton(
        'View chat history',
        'w-full rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-left text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100',
        () => openChatAndPopulate(),
      ));
    }

    starterPrompts.forEach((promptText) => {
      actions.append(createFallbackButton(
        promptText,
        'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
        () => openChatAndPopulate(promptText),
      ));
    });

    const form = document.createElement('form');
    form.className = 'mt-auto flex min-h-[48px] items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Share a marketing challenge, content idea, or customer-growth question...';
    input.className = 'min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Open Bipp';
    submit.className = 'shrink-0 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-600';

    form.append(input, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      openChatAndPopulate(input.value.trim());
    });

    chatCard.append(label, heading, actions, form);
    grid.append(chatCard);

    fallback.append(grid);
    center.append(fallback);
  };

  const getLauncherSpaceId = () => {
    const runtimeWindow = window as any;
    if (typeof runtimeWindow.__SPACE_ID__ === 'string') return runtimeWindow.__SPACE_ID__;
    if (runtimeWindow.__SPACE_CONFIG__?.id && typeof runtimeWindow.__SPACE_CONFIG__.id === 'string') {
      return runtimeWindow.__SPACE_CONFIG__.id;
    }
    const match = window.location.pathname.match(/\/api\/space\/([^/]+)/);
    return match?.[1] || '';
  };

  const readStoredSession = (spaceId: string) => {
    try {
      const sessionKey = `space_session_${spaceId}`;
      const stored = localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey);
      if (!stored || !stored.startsWith('{')) return null;
      return JSON.parse(stored) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const getMessageText = (content: unknown): string => {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
      .map((chunk: any) => {
        if (typeof chunk?.text === 'string') return chunk.text;
        if (typeof chunk?.data?.text === 'string') return chunk.data.text;
        if (typeof chunk?.data?.delta?.text === 'string') return chunk.data.delta.text;
        if (typeof chunk?.data?.result === 'string') return chunk.data.result;
        if (typeof chunk?.data?.response === 'string') return chunk.data.response;
        return '';
      })
      .join('');
  };

  const hasVisibleChatHistory = (messages: unknown): boolean => {
    if (!Array.isArray(messages)) return false;
    const visibleMessages = messages.filter((message: any) => {
      const role = message?.role;
      const text = getMessageText(message?.content).trim();
      if (!text) return false;
      if (role === 'user') return !text.startsWith('[SYSTEM:');
      return role === 'assistant';
    });
    return visibleMessages.some((message: any) => message?.role === 'user') || visibleMessages.length > 1;
  };

  const ensureLauncherHistoryChecked = () => {
    const spaceId = getLauncherSpaceId();
    const storedSession = spaceId ? readStoredSession(spaceId) : null;
    const sessionId =
      storedSession?.workspaceSessionId ||
      storedSession?.sessionId ||
      storedSession?.id ||
      '';
    const email = typeof storedSession?.email === 'string' ? storedSession.email : '';
    const nextLookupKey = `${spaceId}:${String(sessionId)}:${email}`;

    if (historyLookupKey !== nextLookupKey) {
      historyLookupKey = nextLookupKey;
      historyState = 'unknown';
    }

    if (historyState !== 'unknown') return;
    if (!spaceId || (!sessionId && !email)) {
      historyState = 'empty';
      return;
    }

    historyState = 'checking';
    const params = new URLSearchParams({ contextType: 'space' });
    if (sessionId) params.set('sessionId', String(sessionId));
    if (email) params.set('email', email);

    fetch(`/api/space/${spaceId}/chat/history?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        historyState = hasVisibleChatHistory(data?.messages) ? 'available' : 'empty';
      })
      .catch(() => {
        historyState = 'empty';
      })
      .finally(() => {
        requestLauncherPatch();
      });
  };

  const apply = () => {
    const inputs = Array.from(document.querySelectorAll('input[placeholder]')) as HTMLInputElement[];
    const launcherInput = inputs.find((input) => {
      if (input.closest('[data-bipp-minimized-launcher]')) return false;
      const placeholder = input.getAttribute('placeholder') || '';
      return [
        'Continue your conversation...',
        'Ask me anything...',
        'Share a marketing challenge, content idea, or customer-growth question...',
      ].includes(placeholder);
    });

    if (launcherInput) {
      const launcherPlaceholder = 'Share a marketing challenge, content idea, or customer-growth question...';
      if (launcherInput.getAttribute('placeholder') !== launcherPlaceholder) {
        launcherInput.setAttribute('placeholder', launcherPlaceholder);
      }

      const form = launcherInput.closest('form');
      const card = form?.parentElement;
      if (form && card) {
        ensureLauncherHistoryChecked();
        const inputRow = launcherInput.closest('div');
        const insertBeforeNode = inputRow?.parentElement === form ? inputRow : form.firstChild;
        const platformHeader = Array.from(card.children).find((child) => {
          if (child === form) return false;
          return Array.from(child.querySelectorAll('button')).some((button) => {
            const label = button.textContent || '';
            return label.includes('Full Chat') || label.includes('View chat history');
          });
        }) as HTMLElement | undefined;
        const platformHistoryButton = platformHeader
          ? Array.from(platformHeader.querySelectorAll('button')).find((button) => {
            const label = button.textContent || '';
            return label.includes('Full Chat') || label.includes('View chat history');
          }) as HTMLButtonElement | undefined
          : undefined;

        Array.from(card.children).forEach((child) => {
          if (child === form) return;
          if (historyState === 'available' && child === platformHeader) {
            (child as HTMLElement).style.display = 'flex';
            return;
          }
          (child as HTMLElement).style.display = 'none';
        });

        if (platformHeader && platformHistoryButton && historyState === 'available') {
          platformHeader.style.display = 'flex';
          platformHeader.style.alignItems = 'center';
          platformHeader.style.justifyContent = 'flex-end';
          platformHeader.style.gap = '0';
          platformHeader.style.padding = '1rem 1.25rem 0';
          platformHeader.style.borderBottom = '0';
          platformHeader.style.background = 'transparent';
          Array.from(platformHeader.children).forEach((child) => {
            if (child === platformHistoryButton || child.contains(platformHistoryButton)) {
              (child as HTMLElement).style.display = '';
              return;
            }
            (child as HTMLElement).style.display = 'none';
          });
          platformHistoryButton.textContent = 'View chat history';
          platformHistoryButton.className = 'rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100';
          platformHistoryButton.removeAttribute('style');
        }

        card.querySelectorAll('[data-bipp-launcher-prompt]').forEach((node) => node.remove());

        let starterPromptRow = form.querySelector('[data-bipp-starter-prompts]') as HTMLElement | null;
        if (!starterPromptRow) {
          starterPromptRow = document.createElement('div');
          starterPromptRow.setAttribute('data-bipp-starter-prompts', 'true');
          form.insertBefore(starterPromptRow, insertBeforeNode);
        }

        form.querySelector('[data-bipp-chat-history]')?.remove();

        card.className = 'mx-auto flex w-full max-w-3xl flex-col bg-transparent p-0 shadow-none';
        card.removeAttribute('style');
        form.className = 'flex w-full flex-col rounded-3xl border border-gray-200 bg-white p-4 shadow-sm';
        if (inputRow instanceof HTMLElement) {
          inputRow.className = 'mt-auto flex min-h-[48px] items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2';
          inputRow.removeAttribute('style');
        }
        launcherInput.className = 'min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400';
        if (platformHeader) {
          platformHeader.style.display = 'none';
        }

        let chatIntro = form.querySelector('[data-bipp-chat-intro]') as HTMLElement | null;
        if (!chatIntro) {
          chatIntro = document.createElement('div');
          chatIntro.setAttribute('data-bipp-chat-intro', 'true');
          form.insertBefore(chatIntro, starterPromptRow);
        }
        chatIntro.className = 'hidden';
        chatIntro.innerHTML = '';
        const introLabel = document.createElement('p');
        introLabel.textContent = 'Bipp';
        introLabel.className = 'mb-3 text-xs font-semibold uppercase';
        introLabel.style.color = '#3B82F6';
        introLabel.style.letterSpacing = '0.22em';
        const introHeading = document.createElement('h1');
        introHeading.textContent = 'How are you marketing today?';
        introHeading.className = 'font-bold leading-tight text-gray-900';
        introHeading.style.fontSize = 'clamp(1.55rem, 1.8vw, 2rem)';
        introHeading.style.letterSpacing = '0';
        chatIntro.append(introLabel, introHeading);

        starterPromptRow.className = 'mb-3 flex flex-wrap gap-2';
        starterPromptRow.style.display = 'flex';
        const currentPrompts = Array.from(starterPromptRow.querySelectorAll('button')).map((button) => button.textContent || '');
        const shouldRebuildPrompts =
          currentPrompts.length !== starterPrompts.length ||
          starterPrompts.some((promptText, index) => currentPrompts[index] !== promptText);
        if (shouldRebuildPrompts) {
          starterPromptRow.replaceChildren(
            ...starterPrompts.map((promptText) => {
              const button = document.createElement('button');
              button.type = 'button';
              button.textContent = promptText;
              button.className = 'rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700';
              button.addEventListener('click', () => setLauncherInputValue(launcherInput, promptText));
              return button;
            }),
          );
        }

        Array.from(form.children).forEach((child) => {
          if (child === chatIntro || child === starterPromptRow || child.contains(launcherInput)) {
            (child as HTMLElement).style.display = '';
            return;
          }
          (child as HTMLElement).style.display = 'none';
        });

        card.querySelectorAll('[data-bipp-tool-card]').forEach((node) => node.remove());
      }
    }

    renderMinimizedLauncherFallback(launcherInput);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent || '';
      if (text === 'Build publicly. Grow together.') {
        node.textContent = 'How are you reaching customers today?';
        const element = node.parentElement;
        if (element) {
          element.style.margin = '0.25rem auto 1.25rem';
          element.style.maxWidth = '48rem';
          element.style.color = '#111827';
          element.style.fontSize = 'clamp(1.75rem, 2.4vw, 2.5rem)';
          element.style.fontWeight = '700';
          element.style.lineHeight = '1.08';
          element.style.letterSpacing = '0';
        }
      } else if (text === 'Continue where you left off' || text === 'How can I help you today?') {
        node.textContent = 'Marketing strategy, customer growth, and content ideas';
      } else if (text === 'Powered by AI • Press Enter to send') {
        node.textContent = 'Share any marketing challenge. Press Enter to send';
      }
      node = walker.nextNode();
    }
  };

  const scheduleApply = () => window.requestAnimationFrame(apply);
  requestLauncherPatch = scheduleApply;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleApply, { once: true });
  } else {
    scheduleApply();
  }

  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

patchBippLauncherCopy();
