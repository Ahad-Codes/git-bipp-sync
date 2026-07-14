import React, { useState, useEffect, useRef } from 'react';

import { AlertCircle, Instagram, Text, Twitter, Video } from 'lucide-react';
import { createRoot } from 'react-dom/client';
const Fallback = (props: any) => <section data-stub-component="Fallback">{props.children}</section>;


// Fallback wrapper to prevent crashes from missing icons
const IconFallback = ({ icon: Icon, fallback: Fallback = AlertCircle, ...props }) => {
  if (!Icon) {
    console.warn('Icon component is undefined, using fallback');
    return <Fallback {...props} />;
  }
  try {
    return <Icon {...props} />;
  } catch (e) {
    console.error('Icon render failed:', e);
    return <Fallback {...props} />;
  }
};

// Create safe icon components for potentially non-existent icons
const createSafeIcon = (IconComponent, iconName) => {
  if (typeof IconComponent === 'undefined') {
    console.warn(`Icon "${iconName}" not found, using AlertCircle as fallback`);
    return AlertCircle;
  }
  return IconComponent;
};

// === SECTION 1: IMPORTS AND TYPES ===
interface NavLink {
  label: string;
  href: string;
  dataSectionId: string;
}

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
  tag: string;
}

interface FAQ {
  question: string;
  answer: string;
}

interface FooterLink {
  label: string;
  href: string;
  dataSectionId: string;
}

interface Testimonial {
  name: string;
  role: string;
  company: string;
  avatar: string;
  quote: string;
}

// === SECTION 2: BUFFER-INSPIRED CONSTANTS AND CONFIGURATION ===
// Buffer-style color palette: clean whites, soft blues, warm neutrals
const WORKSPACE_BRAND_NAME = 'Bipp';
const WORKSPACE_TAGLINE = 'Build publicly. Grow together.';
const PREVIEW_BUNDLE_VERSION = '2026-06-01-landing-refresh';

// Buffer-inspired palette
const BUFFER_WHITE = '#ffffff';
const BUFFER_CREAM = '#fafaf9';
const BUFFER_LIGHT_GRAY = '#f5f5f4';
const BUFFER_BORDER = '#e7e5e4';
const BUFFER_TEXT_PRIMARY = '#1c1917';
const BUFFER_TEXT_SECONDARY = '#57534e';
const BUFFER_TEXT_MUTED = '#a8a29e';
const BUFFER_BLUE = '#2563eb';
const BUFFER_BLUE_LIGHT = '#3b82f6';
const BUFFER_BLUE_SOFT = '#eff6ff';
const BUFFER_WARM_ACCENT = '#f59e0b';
const BUFFER_GREEN = '#10b981';
const BUFFER_PURPLE = '#8b5cf6';
const BUFFER_PINK = '#ec4899';

// Typography - Figtree for that Buffer feel
const BUFFER_FONT_FAMILY = '"Figtree", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const WORKSPACE_LOGO_URL = 'https://storage.googleapis.com/audos-images/logo-studio/7583d1d5-4a4e-4026-a8bd-e42c0edec891/4b7cea9b-7022-4477-803c-9af5e96d0943.png';
const WORKSPACE_SPACE_URL = '/space/workspace-899385';
const WORKSPACE_OPTIONS_URL = '#workspace-options';
const WORKSPACE_HERO_VIDEO_URL = 'https://storage.googleapis.com/audos-images/generated-videos/models_veo-3.1-generate-preview_operations_a54ny6m2lh8i.mp4';

const getWorkspaceLaunchUrl = (appId?: string, mode?: 'chat') => {
  const fallbackUrl = appId
    ? `${WORKSPACE_SPACE_URL}?screen=app&app=${encodeURIComponent(appId)}`
    : mode === 'chat'
      ? `${WORKSPACE_SPACE_URL}?bippView=chat`
      : WORKSPACE_SPACE_URL;
  if (typeof window === 'undefined') {
    return fallbackUrl;
  }

  const currentUrl = new URL(window.location.href);
  const env = currentUrl.searchParams.get('env');
  const rev = currentUrl.searchParams.get('rev');
  const previewScope = currentUrl.searchParams.get('audosPreviewScope');

  if (currentUrl.pathname.startsWith('/api/apps/') && env && rev) {
    const previewUrl = new URL('/api/space/workspace-899385/preview', currentUrl.origin);
    previewUrl.searchParams.set('env', env);
    previewUrl.searchParams.set('rev', rev);
    if (previewScope) {
      previewUrl.searchParams.set('audosPreviewScope', previewScope);
    }
    if (appId) {
      previewUrl.searchParams.set('screen', 'app');
      previewUrl.searchParams.set('app', appId);
    } else if (mode === 'chat') {
      previewUrl.searchParams.set('bippView', 'chat');
    }
    return `${previewUrl.pathname}${previewUrl.search}`;
  }

  return fallbackUrl;
};

// === SECTION 3: STRUCTURED CONTENT DATA ===
const NAV_LINKS: NavLink[] = [
  { label: 'Features', href: '#features', dataSectionId: 'nav-1-label' },
  { label: 'How it works', href: '#how-it-works', dataSectionId: 'nav-2-label' },
  { label: 'Testimonials', href: '#testimonials', dataSectionId: 'nav-3-label' },
  { label: 'FAQ', href: '#faq', dataSectionId: 'nav-4-label' },
];

const BENEFITS: Benefit[] = [
  {
    icon: '✍️',
    title: 'Authentic storytelling',
    description: 'Share your real journey with your audience. The wins, the stumbles, the lessons learned along the way.',
  },
  {
    icon: '📈',
    title: 'Consistent growth',
    description: 'Stay visible and top of mind. Build your audience steadily with regular, meaningful content.',
  },
  {
    icon: '💬',
    title: 'Community momentum',
    description: 'Turn passive followers into active supporters who engage with and champion your work.',
  },
  {
    icon: '⚡',
    title: 'Save hours weekly',
    description: 'Go from messy notes to polished posts in minutes. Spend more time building, less time writing.',
  },
];

const FEATURES: Feature[] = [
  {
    icon: '🧩',
    title: 'Raw-to-Post',
    description: 'Transform scattered updates and half-finished thoughts into clear, public-ready posts that sound like you.',
    tag: 'Create',
  },
  {
    icon: '📊',
    title: 'Consistency Pulse',
    description: 'Track your posting consistency, audience engagement, and discover which story themes resonate most.',
    tag: 'Measure',
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Sarah Chen',
    role: 'Founder',
    company: 'Pixelcraft',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    quote: 'Bipp turned my random updates into a content strategy. My engagement went up 3x in the first month.',
  },
  {
    name: 'Marcus Johnson',
    role: 'Solo Developer',
    company: 'IndieStack',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    quote: 'I used to spend hours figuring out what to post. Now I just dump my notes and Bipp handles the rest.',
  },
  {
    name: 'Emma Rodriguez',
    role: 'Creator',
    company: 'DesignLab',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    quote: 'Building in public felt overwhelming until I found Bipp. Now my audience actually follows my journey.',
  },
];

const FAQS: FAQ[] = [
  {
    question: 'What exactly is "building in public"?',
    answer: 'Building in public means sharing your entrepreneurial journey openly with your audience in real time. Your progress, challenges, learnings, and milestones. It builds trust, attracts supporters, and creates accountability.',
  },
  {
    question: 'How is Bipp different from a social media scheduler?',
    answer: 'Schedulers help you post on time. Bipp helps you figure out what to post. It transforms your raw updates and thoughts into compelling narratives, then tracks which stories resonate most with your audience.',
  },
  {
    question: 'Is there a free plan?',
    answer: 'Yes. Start free with core features including Raw-to-Post for up to 10 posts per month and basic Consistency Pulse analytics. Upgrade when you need unlimited posts and advanced features.',
  },
  {
    question: 'Do I need to be a good writer?',
    answer: 'Not at all. You provide the raw material — a quick note, a bullet list, a voice memo — and Bipp turns it into a polished post that still sounds like you.',
  },
  {
    question: 'Which platforms does Bipp support?',
    answer: 'Bipp currently supports Twitter/X, LinkedIn, and Threads — the platforms where build-in-public communities thrive. More platforms coming based on user feedback.',
  },
];

const FOOTER_LINKS: FooterLink[] = [
  { label: 'Features', href: '#features', dataSectionId: 'footer-link-1-label' },
  { label: 'FAQ', href: '#faq', dataSectionId: 'footer-link-2-label' },
  { label: 'Get Started', href: WORKSPACE_OPTIONS_URL, dataSectionId: 'footer-link-3-label' },
];

// Scroll-triggered visibility hook
const useScrollReveal = (threshold = 0.15) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
};

// Floating animation hook
const useFloatingAnimation = (delay: number = 0) => {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let frame: number;
    const animate = () => {
      setOffset(Math.sin((Date.now() + delay) / 2000) * 8);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [delay]);
  return offset;
};

// === SECTION 4: UI MOCKUP COMPONENTS ===
// Browser Frame Component for product mockups
const BrowserFrame: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style = {} }) => {
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        backgroundColor: BUFFER_WHITE,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        ...style,
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
      >
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
        </div>
        <div
          className="flex-1 mx-4 px-4 py-1.5 text-xs text-center rounded-md"
          style={{ backgroundColor: '#f1f5f9', color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}
        >
          app.bipp.io
        </div>
      </div>
      {/* Content */}
      <div style={{ backgroundColor: BUFFER_WHITE }}>
        {children}
      </div>
    </div>
  );
};

// Floating UI Card Component
const FloatingCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, className = '', delay = 0, style = {} }) => {
  const floatOffset = useFloatingAnimation(delay);

  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        backgroundColor: BUFFER_WHITE,
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0,0,0,0.03)',
        transform: `translateY(${floatOffset}px)`,
        transition: 'box-shadow 0.3s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Glassmorphism Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className = '', style = {} }) => {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Raw-to-Post UI Mockup
const RawToPostMockup: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div className={compact ? 'p-4' : 'p-6'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧩</span>
          <span
            className="font-semibold"
            style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY, fontSize: compact ? '14px' : '16px' }}
          >
            Raw-to-Post
          </span>
        </div>
        <div
          className="px-2 py-1 text-xs font-medium rounded-full"
          style={{ backgroundColor: '#dcfce7', color: '#15803d' }}
        >
          Ready
        </div>
      </div>

      {/* Input area */}
      <div
        className="rounded-lg p-3 mb-4"
        style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
      >
        <div
          className="text-sm mb-2"
          style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}
        >
          Your raw update:
        </div>
        <div
          className="text-sm leading-relaxed"
          style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
        >
          {compact
            ? 'Just shipped the new dashboard...'
            : 'Just shipped the new dashboard feature. Took 3 weeks longer than expected but learned a ton about React performance. Users are loving it so far!'
          }
        </div>
      </div>

      {/* Output preview */}
      <div
        className="rounded-lg p-3"
        style={{ backgroundColor: BUFFER_BLUE_SOFT, border: `1px solid ${BUFFER_BLUE}20` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">✨</span>
          <span
            className="text-sm font-medium"
            style={{ color: BUFFER_BLUE, fontFamily: BUFFER_FONT_FAMILY }}
          >
            Polished post:
          </span>
        </div>
        <div
          className="text-sm leading-relaxed"
          style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
        >
          {compact
            ? '🚀 After 3 weeks of deep work...'
            : `🚀 After 3 weeks of deep work, our new dashboard is live!

The timeline stretched longer than planned, but here’s what I learned about React performance along the way...

Thread 🧵`
          }
        </div>
      </div>

      {/* Action buttons */}
      {!compact && (
        <div className="flex gap-2 mt-4">
          <div
            className="flex-1 py-2 text-center text-sm font-medium rounded-lg"
            style={{ backgroundColor: BUFFER_BLUE, color: '#ffffff', fontFamily: BUFFER_FONT_FAMILY }}
          >
            Copy to clipboard
          </div>
          <div
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ backgroundColor: '#f1f5f9', color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
          >
            Edit
          </div>
        </div>
      )}
    </div>
  );
};

// Consistency Pulse Mockup
const ConsistencyPulseMockup: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const activityData = [true, true, false, true, true, false, true];

  return (
    <div className={compact ? 'p-4' : 'p-6'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <span
            className="font-semibold"
            style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY, fontSize: compact ? '14px' : '16px' }}
          >
            Consistency Pulse
          </span>
        </div>
        <div
          className="text-sm font-medium"
          style={{ color: BUFFER_GREEN }}
        >
          5/7 days
        </div>
      </div>

      {/* Activity grid */}
      <div className="flex justify-between mb-4">
        {weekDays.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-xs" style={{ color: BUFFER_TEXT_MUTED }}>{day}</span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{
                backgroundColor: activityData[i] ? '#dcfce7' : '#f1f5f9',
                color: activityData[i] ? '#15803d' : BUFFER_TEXT_MUTED,
              }}
            >
              {activityData[i] ? '✓' : '–'}
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      {!compact && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'This week', value: '5 posts' },
            { label: 'Best topic', value: 'Product' },
            { label: 'Avg. engagement', value: '+23%' },
          ].map((stat, i) => (
            <div
              key={i}
              className="p-3 rounded-lg text-center"
              style={{ backgroundColor: '#f8fafc' }}
            >
              <div
                className="text-sm font-semibold"
                style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
              >
                {stat.value}
              </div>
              <div
                className="text-xs"
                style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Notification Toast Component
const NotificationToast: React.FC<{ message: string; icon: string; delay?: number }> = ({ message, icon, delay = 0 }) => {
  const floatOffset = useFloatingAnimation(delay);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        backgroundColor: BUFFER_WHITE,
        boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        transform: `translateY(${floatOffset}px)`,
      }}
    >
      <span className="text-lg">{icon}</span>
      <span
        className="text-sm font-medium"
        style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
      >
        {message}
      </span>
    </div>
  );
};

// === SECTION 5: BUFFER-STYLE NAVIGATION ===
const NavigationBar: React.FC = () => {
  const [scrolled, setScrolled] = useState<boolean>(() => (typeof window !== 'undefined' && window.scrollY > 12));
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(() => false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    let attempts = 0;
    const maxAttempts = 30;
    let intervalId: number | null = null;

    const tryRemoveHeroExtras = () => {
      attempts += 1;
      const hero = document.getElementById('hero');
      if (!hero) {
        if (attempts >= maxAttempts && intervalId !== null) clearInterval(intervalId);
        return;
      }

      let changed = false;

      // Remove the "One video becomes..." transformation card
      const heroParagraphs = Array.from(hero.querySelectorAll('p'));
      const targetP = heroParagraphs.find((el) => el.textContent?.trim().startsWith('One video becomes'));
      if (targetP) {
        let ancestor: HTMLElement | null = targetP as HTMLElement;
        while (
          ancestor &&
          !(
            typeof ancestor.className === 'string' &&
            ancestor.className.includes('rounded-2xl') &&
            ancestor.className.includes('overflow-hidden')
          )
        ) {
          ancestor = ancestor.parentElement as HTMLElement | null;
        }
        if (ancestor) {
          ancestor.remove();
          changed = true;
        }
      }

      // Remove "Scroll to explore" indicator in hero
      const span = Array.from(hero.querySelectorAll('span')).find(
        (el) => el.textContent?.trim().toLowerCase() === 'scroll to explore'
      );
      if (span && span.parentElement && span.parentElement.parentElement) {
        span.parentElement.parentElement.remove();
        changed = true;
      }

      // Update hero badge to brand line
      const badgeText = Array.from(hero.querySelectorAll('span')).find(
        (el) => el.textContent?.trim().includes('Daily video journals')
      );
      if (badgeText) {
        badgeText.textContent = WORKSPACE_TAGLINE;
        changed = true;
      }

      // Update hero headline to "marketing copilot" positioning
      const titleEl = hero.querySelector('[data-section="hero-title"]') as HTMLElement | null;
      if (titleEl && !/marketing copilot/i.test(titleEl.textContent || '')) {
        const grad = `linear-gradient(135deg, ${BUFFER_BLUE} 0%, ${BUFFER_PURPLE} 50%, ${BUFFER_PINK} 100%)`;
        titleEl.innerHTML = `Meet your <span style="background-image:${grad};-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;">marketing copilot</span>.`;
        changed = true;
      }

      // Update hero subheadline for 3-pillar story
      const subEl = hero.querySelector('[data-section="hero-subtitle"]') as HTMLElement | null;
      if (subEl && !/strategy/i.test(subEl.textContent || '')) {
        subEl.textContent =
          'Bipp turns raw brainstorming videos into content ideas, plans your marketing strategy, and tracks your tasks.';
        changed = true;
      }

      // Insert 3-pillar list near the fold (under CTAs)
      if (!hero.querySelector('#bipp-hero-pillars')) {
        const ctaAnchor = hero.querySelector('[data-section="hero-cta"]') as HTMLElement | null;
        const ctaRow = ctaAnchor?.parentElement as HTMLElement | null;
        if (ctaRow && ctaRow.parentElement) {
          const pillars = document.createElement('div');
          pillars.id = 'bipp-hero-pillars';
          pillars.style.marginTop = '8px';
          pillars.style.display = 'grid';
          pillars.style.gap = '8px';
          // Simple responsive columns
          const cols = typeof window !== 'undefined' && window.innerWidth >= 1024 ? 3 : 1;
          pillars.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
          pillars.style.alignItems = 'start';

          const items = [
            {
              icon: '✍️',
              title: 'Turns raw footage into ideas',
              desc: 'Record or upload a clip, get content angles, drafts, and formats.'
            },
            {
              icon: '🧭',
              title: 'Helps you plan your marketing strategy',
              desc: 'Content pillars, messaging, what to post and why — powered by the manager agent.'
            },
            {
              icon: '✅',
              title: 'Track your tasks',
              desc: 'A content calendar to organize, schedule, and follow through.'
            }
          ];

          items.forEach((it) => {
            const card = document.createElement('div');
            card.style.backgroundColor = 'rgba(255,255,255,0.9)';
            (card.style as any).backdropFilter = 'blur(8px)';
            card.style.border = `1px solid ${BUFFER_BORDER}`;
            card.style.borderRadius = '12px';
            card.style.padding = '12px';

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.gap = '8px';
            header.style.marginBottom = '6px';

            const icon = document.createElement('span');
            icon.textContent = it.icon;
            icon.style.fontSize = '18px';
            header.appendChild(icon);

            const title = document.createElement('span');
            title.textContent = it.title;
            title.style.fontWeight = '600';
            title.style.fontSize = '14px';
            title.style.color = BUFFER_TEXT_PRIMARY;
            title.style.fontFamily = BUFFER_FONT_FAMILY;
            header.appendChild(title);

            const desc = document.createElement('div');
            desc.textContent = it.desc;
            desc.style.fontSize = '13px';
            desc.style.lineHeight = '1.5';
            desc.style.color = BUFFER_TEXT_SECONDARY;
            desc.style.fontFamily = BUFFER_FONT_FAMILY;

            card.appendChild(header);
            card.appendChild(desc);
            pillars.appendChild(card);
          });

          ctaRow.parentElement.insertBefore(pillars, ctaRow.nextSibling);
          changed = true;
        }
      }

      if (changed || attempts >= maxAttempts) {
        if (intervalId !== null) clearInterval(intervalId);
      }
    };

    intervalId = window.setInterval(tryRemoveHeroExtras, 100);
    tryRemoveHeroExtras();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const original = document.body.style.overflow;
      document.body.style.overflow = mobileMenuOpen ? 'hidden' : original || '';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [mobileMenuOpen]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: scrolled ? `1px solid ${BUFFER_BORDER}` : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {WORKSPACE_LOGO_URL && (
              <img src={WORKSPACE_LOGO_URL} alt={WORKSPACE_BRAND_NAME} className="h-8 w-8 object-contain" />
            )}
            <span
              className="font-semibold text-lg"
              style={{
                color: BUFFER_TEXT_PRIMARY,
                fontFamily: BUFFER_FONT_FAMILY,
              }}
            >
              {WORKSPACE_BRAND_NAME}
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link, i) => (
              <a
                key={i}
                href={link.href}
                data-section={link.dataSectionId}
                className="text-sm font-medium transition-colors duration-200"
                style={{
                  fontFamily: BUFFER_FONT_FAMILY,
                  color: BUFFER_TEXT_SECONDARY,
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = BUFFER_TEXT_PRIMARY;
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.color = BUFFER_TEXT_SECONDARY;
                }}
              >
                {link.label}
              </a>
            ))}
            <a
              href={WORKSPACE_OPTIONS_URL}
              data-section="nav-cta"
              className="text-sm font-semibold px-5 py-2.5 transition-all duration-200"
              style={{
                backgroundColor: BUFFER_BLUE,
                color: '#ffffff',
                fontFamily: BUFFER_FONT_FAMILY,
                borderRadius: '9999px',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                (e.target as HTMLElement).style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.25)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.transform = 'translateY(0)';
                (e.target as HTMLElement).style.boxShadow = 'none';
              }}
            >
              Get started free
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              width="24"
              height="24"
              fill="none"
              stroke={BUFFER_TEXT_PRIMARY}
              strokeWidth="2"
              strokeLinecap="round"
            >
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="7" x2="21" y2="7" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="17" x2="21" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className="md:hidden overflow-hidden transition-all duration-300"
          style={{
            maxHeight: mobileMenuOpen ? '300px' : '0px',
            opacity: mobileMenuOpen ? 1 : 0,
          }}
        >
          <div className="py-4 space-y-3">
            {NAV_LINKS.map((link, i) => (
              <a
                key={i}
                href={link.href}
                data-section={link.dataSectionId}
                className="block py-2 text-base font-medium"
                style={{
                  color: BUFFER_TEXT_SECONDARY,
                  fontFamily: BUFFER_FONT_FAMILY,
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href={WORKSPACE_OPTIONS_URL}
              className="inline-block mt-2 text-center px-6 py-3 text-base font-semibold"
              style={{
                backgroundColor: BUFFER_BLUE,
                color: '#ffffff',
                fontFamily: BUFFER_FONT_FAMILY,
                borderRadius: '9999px',
              }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Get started free
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};

// Video Journal URLs for the mockup
const VIDEO_JOURNAL_URL_1 = 'https://storage.googleapis.com/audos-images/generated-videos/models_veo-3.1-generate-preview_operations_x6z87leruz4z.mp4';
const VIDEO_JOURNAL_URL_2 = 'https://storage.googleapis.com/audos-images/generated-videos/models_veo-3.1-generate-preview_operations_rb7ehb23vkdn.mp4';

// Phone Frame Mockup for Video Journal
const PhoneFrameMockup: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style = {} }) => {
  return (
    <div
      className={`relative ${className}`}
      style={{
        width: '280px',
        ...style,
      }}
    >
      {/* Phone bezel */}
      <div
        className="rounded-[40px] p-3 relative"
        style={{
          backgroundColor: '#1a1a1a',
          boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.5), 0 30px 60px -30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {/* Notch / Dynamic Island */}
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-7 rounded-full z-20"
          style={{ backgroundColor: '#000' }}
        />
        {/* Screen */}
        <div
          className="rounded-[28px] overflow-hidden relative"
          style={{ backgroundColor: '#000', aspectRatio: '9/19.5' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// Content Output Card Component
const ContentOutputCard: React.FC<{
  icon: string;
  platform: string;
  preview: string;
  delay?: number;
}> = ({ icon, platform, preview, delay = 0 }) => {
  const floatOffset = useFloatingAnimation(delay);

  return (
    <div
      className="px-4 py-3 rounded-xl"
      style={{
        backgroundColor: BUFFER_WHITE,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        transform: `translateY(${floatOffset}px)`,
        maxWidth: '200px',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <span
          className="text-xs font-semibold"
          style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
        >
          {platform}
        </span>
      </div>
      <p
        className="text-xs leading-relaxed"
        style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
      >
        {preview}
      </p>
    </div>
  );
};

// === SECTION 6: CLEAN HERO WITH FLOATING PHONE MOCKUP ===
const HeroSection: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const phoneFloatOffset = useFloatingAnimation(0);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      id="hero"
      className="relative overflow-hidden min-h-screen min-h-[100svh]"
      style={{
        background: `linear-gradient(180deg, ${BUFFER_WHITE} 0%, ${BUFFER_CREAM} 100%)`,
        paddingTop: '120px',
        paddingBottom: '100px',
        minHeight: '100vh',
      }}
    >
      {/* Subtle decorative background elements */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl opacity-20"
        style={{ background: `linear-gradient(135deg, ${BUFFER_BLUE_SOFT} 0%, #faf5ff 100%)` }}
      />
      <div
        className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-3xl opacity-15"
        style={{ background: `linear-gradient(135deg, #dcfce7 0%, ${BUFFER_BLUE_SOFT} 100%)` }}
      />

      {/* Hero content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
        {/* Two-column layout: Text + Floating Phone */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-16">
          {/* Left: Headline, subheadline, CTAs */}
          <div
            className="text-center lg:text-left"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium"
              style={{
                backgroundColor: BUFFER_BLUE_SOFT,
                color: BUFFER_BLUE,
                fontFamily: BUFFER_FONT_FAMILY,
                borderRadius: '9999px',
              }}
            >
              <span className="text-base">🎬</span>
              <span>Daily video journals → Endless content</span>
            </div>

            {/* Large, clean headline */}
            <h1
              data-section="hero-title"
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
              style={{
                color: BUFFER_TEXT_PRIMARY,
                fontFamily: BUFFER_FONT_FAMILY,
                letterSpacing: '-0.02em',
              }}
            >
              Record your day.{' '}
              <span
                style={{
                  background: `linear-gradient(135deg, ${BUFFER_BLUE} 0%, ${BUFFER_PURPLE} 50%, ${BUFFER_PINK} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Let Bipp do the rest.
              </span>
            </h1>

            {/* Subheadline */}
            <p
              data-section="hero-subtitle"
              className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed"
              style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
            >
              Spend 60 seconds talking about what you built today. Bipp transforms your raw video into polished LinkedIn posts and Instagram scripts.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4 mb-8">
              <a
                href={WORKSPACE_OPTIONS_URL}
                data-section="hero-cta"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold transition-all duration-200"
                style={{
                  backgroundColor: BUFFER_BLUE_LIGHT,
                  color: '#ffffff',
                  fontFamily: BUFFER_FONT_FAMILY,
                  borderRadius: '9999px',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.target as HTMLElement).style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.45)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.transform = 'translateY(0)';
                  (e.target as HTMLElement).style.boxShadow = '0 4px 14px rgba(59, 130, 246, 0.35)';
                }}
              >
                Start recording free
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </a>
              <a
                href="#video-to-content"
                className="inline-flex items-center gap-2 px-6 py-4 text-base font-medium transition-all duration-200"
                style={{
                  color: BUFFER_TEXT_SECONDARY,
                  fontFamily: BUFFER_FONT_FAMILY,
                  borderRadius: '9999px',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = BUFFER_TEXT_PRIMARY;
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.color = BUFFER_TEXT_SECONDARY;
                }}
              >
                See how it works
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 3l6 6-6 6" />
                </svg>
              </a>
            </div>

            {/* Social proof */}
            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4">
              <div className="flex -space-x-2">
                {['https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=face',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
                  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
                  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
                ].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                    style={{ border: `2px solid ${BUFFER_WHITE}`, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  />
                ))}
              </div>
              <div className="text-sm" style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}>
                <span className="font-semibold" style={{ color: BUFFER_TEXT_PRIMARY }}>2,000+</span> builders journaling daily
              </div>
            </div>
          </div>

          {/* Right: Floating Phone Mockup with talking-to-camera video */}
          <div
            className="relative flex justify-center lg:justify-end"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(40px)',
              transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
            }}
          >
            <div
              className="relative"
              style={{
                transform: `translateY(${phoneFloatOffset}px)`,
              }}
            >
              <PhoneFrameMockup style={{ width: '280px' }}>
                <video
                  src={VIDEO_JOURNAL_URL_1}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Recording indicator overlay */}
                <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-10">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-white font-medium" style={{ fontFamily: BUFFER_FONT_FAMILY }}>REC</span>
                  </div>
                  <div
                    className="px-3 py-1.5 rounded-full text-xs text-white font-medium"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', fontFamily: BUFFER_FONT_FAMILY }}
                  >
                    0:47
                  </div>
                </div>
                {/* Bottom prompt */}
                <div className="absolute bottom-8 left-4 right-4 z-10">
                  <div
                    className="px-4 py-3 rounded-xl text-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
                  >
                    <p className="text-white text-sm font-medium" style={{ fontFamily: BUFFER_FONT_FAMILY }}>
                      What did you ship today?
                    </p>
                  </div>
                </div>
              </PhoneFrameMockup>

              {/* Floating accent cards around the phone */}
              <FloatingCard
                className="absolute -left-20 top-16 hidden lg:block p-3"
                delay={300}
                style={{ maxWidth: '150px' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}>5-day streak!</div>
                    <div className="text-xs" style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}>Keep it going</div>
                  </div>
                </div>
              </FloatingCard>

              <FloatingCard
                className="absolute -right-16 bottom-24 hidden lg:block p-3"
                delay={600}
                style={{ maxWidth: '160px' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#dcfce7' }}
                  >
                    <span className="text-sm">📈</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}>+156%</div>
                    <div className="text-xs" style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}>Engagement</div>
                  </div>
                </div>
              </FloatingCard>
            </div>
          </div>
        </div>

        {/* Product showcase: Transformation flow below */}
        <div
          className="relative max-w-4xl mx-auto"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(40px)',
            transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
          }}
        >
          {/* Transformation flow card */}
          <div
            className="rounded-2xl overflow-hidden p-6 md:p-8"
            style={{
              backgroundColor: BUFFER_WHITE,
              boxShadow: '0 20px 60px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.03)',
            }}
          >
            <div className="text-center mb-6">
              <p className="text-sm font-medium" style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}>
                One video becomes...
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: '💼', platform: 'LinkedIn Post', preview: 'Just shipped our new onboarding flow...', color: '#0077b5' },
                { icon: '🐦', platform: 'Twitter Thread', preview: 'Thread: 5 lessons from launching today 🧵', color: '#1da1f2' },
                { icon: '📸', platform: 'Instagram Caption', preview: 'Behind the scenes of building in public ✨', color: '#e4405f' },
                { icon: '💬', platform: 'Quote Card', preview: `"The best time to ship is now."`, color: BUFFER_PURPLE },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl transition-all duration-200"
                  style={{
                    backgroundColor: BUFFER_CREAM,
                    border: `1px solid ${BUFFER_BORDER}`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{item.icon}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: item.color, fontFamily: BUFFER_FONT_FAMILY }}
                    >
                      {item.platform}
                    </span>
                  </div>
                  <p
                    className="text-xs leading-relaxed line-clamp-2"
                    style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
                  >
                    {item.preview}
                  </p>
                </div>
              ))}
            </div>
            <div
              className="mt-6 text-center"
              style={{ fontFamily: BUFFER_FONT_FAMILY }}
            >
              <span className="text-sm font-semibold" style={{ color: BUFFER_TEXT_PRIMARY }}>7+ content pieces</span>
              <span className="text-sm" style={{ color: BUFFER_TEXT_MUTED }}> — ready to publish</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 1s ease 1s',
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs" style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}>Scroll to explore</span>
          <div
            className="w-6 h-10 rounded-full flex items-start justify-center p-1"
            style={{ border: `2px solid ${BUFFER_BORDER}` }}
          >
            <div
              className="w-1.5 h-3 rounded-full animate-bounce"
              style={{ backgroundColor: BUFFER_TEXT_MUTED }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const WorkspaceOptionsSection: React.FC = () => {
  const { ref: sectionRef, visible } = useScrollReveal(0.08);
  const options = [
    {
      title: 'Chatbot',
      href: getWorkspaceLaunchUrl(undefined, 'chat'),
      eyebrow: 'Bipp',
      headline: 'Talk through your marketing.',
      description: 'Bring a challenge, idea, or messy thought. Bipp helps shape the next move.',
      action: 'Chat with Bipp',
    },
    {
      title: 'Content Calendar',
      href: getWorkspaceLaunchUrl('content-calendar'),
      eyebrow: 'Plan',
      headline: 'Plan what goes out next.',
      description: 'Keep posts, follow-ups, and scheduled content in one place.',
      action: 'Open calendar',
    },
    {
      title: 'Raw-to-Post',
      href: getWorkspaceLaunchUrl('raw-to-post'),
      eyebrow: 'Create',
      headline: 'Create from what’s on your mind.',
      description: 'Record a quick thought. Bipp can turn it into a video script, carousel, or post.',
      action: 'Create content',
    },
  ];

  return (
    <section
      id="workspace-options"
      ref={sectionRef}
      className="px-6 lg:px-8"
      style={{
        backgroundColor: BUFFER_CREAM,
        paddingTop: '80px',
        paddingBottom: '96px',
        borderTop: `1px solid ${BUFFER_BORDER}`,
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <p
            className="text-sm font-semibold uppercase tracking-[0.18em] mb-3"
            style={{ color: BUFFER_BLUE, fontFamily: BUFFER_FONT_FAMILY }}
          >
            Start here
          </p>
          <h2
            className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl"
            style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY, letterSpacing: '-0.02em' }}
          >
            What do you want to do today?
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {options.map((option, index) => (
            <a
              key={option.title}
              href={option.href}
              className="group flex min-h-[300px] flex-col justify-between rounded-2xl border p-6 transition-all duration-300"
              style={{
                backgroundColor: BUFFER_WHITE,
                borderColor: BUFFER_BORDER,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transitionDelay: `${index * 80}ms`,
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}
              onMouseEnter={(event) => {
                (event.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                (event.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px rgba(15,23,42,0.08)';
                (event.currentTarget as HTMLElement).style.borderColor = BUFFER_BLUE_LIGHT;
              }}
              onMouseLeave={(event) => {
                (event.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (event.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)';
                (event.currentTarget as HTMLElement).style.borderColor = BUFFER_BORDER;
              }}
            >
              <span>
                <span
                  className="block text-xs font-semibold uppercase tracking-[0.18em] mb-3"
                  style={{ color: BUFFER_BLUE, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {option.eyebrow}
                </span>
                <span
                  className="block text-2xl md:text-3xl font-bold leading-tight"
                  style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY, letterSpacing: '-0.01em' }}
                >
                  {option.headline}
                </span>
                <span
                  className="mt-4 block text-sm leading-6 max-w-md"
                  style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {option.description}
                </span>
              </span>
              <span
                className="mt-6 inline-flex w-fit items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors group-hover:bg-blue-700"
                style={{ backgroundColor: BUFFER_BLUE_LIGHT, color: BUFFER_WHITE, fontFamily: BUFFER_FONT_FAMILY }}
              >
                {option.action}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

// === SECTION 6B: VIDEO TO CONTENT - HOW IT WORKS FLOW ===
const VideoToContentSection: React.FC = () => {
  const { ref: sectionRef, visible } = useScrollReveal(0.08);

  const steps = [
    {
      number: '01',
      icon: '📹',
      title: 'Record',
      subtitle: 'Spend 60 seconds talking about your day',
      description: 'Open the app, hit record, and talk naturally about what you built, learned, or struggled with today. No script needed.',
      color: '#ff6b6b',
    },
    {
      number: '02',
      icon: '✨',
      title: 'Transform',
      subtitle: 'AI analyzes and creates',
      description: 'Bipp analyzes your video, extracts key insights, and crafts multiple pieces of content in your authentic voice.',
      color: BUFFER_BLUE_LIGHT,
    },
    {
      number: '03',
      icon: '🚀',
      title: 'Post',
      subtitle: 'Get a week of authentic content',
      description: 'Review your LinkedIn post, Twitter thread, Instagram caption, and quote cards. Edit if you want, then share.',
      color: BUFFER_GREEN,
    },
  ];

  return (
    <section
      id="video-to-content"
      ref={sectionRef}
      className="px-6 lg:px-8 overflow-hidden"
      style={{
        background: BUFFER_WHITE,
        paddingTop: '120px',
        paddingBottom: '120px',
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div
          className="text-center mb-20"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            className="inline-block px-4 py-1.5 mb-6 text-sm font-medium"
            style={{
              backgroundColor: '#fff0f0',
              color: '#ff6b6b',
              fontFamily: BUFFER_FONT_FAMILY,
              borderRadius: '9999px',
            }}
          >
            How it works
          </div>
          <h2
            data-section="video-to-content-heading"
            className="text-3xl md:text-5xl font-bold mb-5"
            style={{
              color: BUFFER_TEXT_PRIMARY,
              fontFamily: BUFFER_FONT_FAMILY,
              letterSpacing: '-0.02em',
            }}
          >
            From selfie video to{' '}
            <span style={{ color: BUFFER_BLUE_LIGHT }}>a week of content</span>
          </h2>
          <p
            data-section="video-to-content-subheading"
            className="text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
          >
            Your daily check-in becomes LinkedIn posts, Twitter threads, Instagram stories, and quote cards. All in your voice.
          </p>
        </div>

        {/* Visual transformation flow */}
        <div
          className="relative mb-20"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
          }}
        >
          {/* Flow visualization */}
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
            {/* Input: Video in premium phone mockup */}
            <div className="flex flex-col items-center">
              <PhoneFrameMockup style={{ width: '240px' }}>
                <video
                  src={VIDEO_JOURNAL_URL_2}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Recording indicator overlay */}
                <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-10">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-white font-medium" style={{ fontFamily: BUFFER_FONT_FAMILY }}>REC</span>
                  </div>
                  <div
                    className="px-2.5 py-1 rounded-full text-[10px] text-white font-medium"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', fontFamily: BUFFER_FONT_FAMILY }}
                  >
                    1:02
                  </div>
                </div>
                {/* Bottom prompt */}
                <div className="absolute bottom-8 left-4 right-4 z-10">
                  <div
                    className="px-3 py-2 rounded-xl text-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
                  >
                    <p className="text-white text-xs font-medium" style={{ fontFamily: BUFFER_FONT_FAMILY }}>
                      Talk about your progress...
                    </p>
                  </div>
                </div>
              </PhoneFrameMockup>
              <span
                className="mt-5 text-sm font-semibold"
                style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
              >
                60-second video
              </span>
              <span
                className="text-xs"
                style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}
              >
                Authentic & unscripted
              </span>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-2 py-4 lg:py-0">
              <div
                className="hidden lg:block w-20 h-0.5"
                style={{ background: `linear-gradient(90deg, #ff6b6b 0%, ${BUFFER_BLUE_LIGHT} 100%)` }}
              />
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, #ff6b6b 0%, ${BUFFER_BLUE_LIGHT} 100%)`,
                  boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
                }}
              >
                <span className="text-white text-xl">✨</span>
              </div>
              <div
                className="hidden lg:block w-20 h-0.5"
                style={{ background: `linear-gradient(90deg, ${BUFFER_BLUE_LIGHT} 0%, ${BUFFER_GREEN} 100%)` }}
              />
            </div>

            {/* Output: Multiple content pieces */}
            <div className="flex flex-col items-center">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: '💼', label: 'LinkedIn Post', color: '#0077b5' },
                  { icon: '🐦', label: 'Twitter Thread', color: '#1da1f2' },
                  { icon: '📸', label: 'Instagram Story', color: '#e4405f' },
                  { icon: '💬', label: 'Quote Card', color: BUFFER_PURPLE },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200"
                    style={{
                      backgroundColor: BUFFER_WHITE,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                      border: `1px solid ${BUFFER_BORDER}`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                    }}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
              <span
                className="mt-5 text-sm font-semibold"
                style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
              >
                7+ content pieces
              </span>
              <span
                className="text-xs"
                style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}
              >
                Ready to publish
              </span>
            </div>
          </div>
        </div>

        {/* 3-step breakdown */}
        <div className="relative">
          {/* Connecting line (desktop) */}
          <div
            className="hidden lg:block absolute top-24 left-[16.6%] right-[16.6%] h-0.5"
            style={{
              background: `linear-gradient(90deg, #ff6b6b 0%, ${BUFFER_BLUE_LIGHT} 50%, ${BUFFER_GREEN} 100%)`,
              opacity: visible ? 0.3 : 0,
              transition: 'opacity 1s ease 0.5s',
            }}
          />

          <div className="grid md:grid-cols-3 gap-12 lg:gap-8">
            {steps.map((step, i) => (
              <div
                key={i}
                className="relative text-center"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(30px)',
                  transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${300 + i * 150}ms`,
                }}
              >
                {/* Step icon circle */}
                <div
                  className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center text-2xl"
                  style={{
                    backgroundColor: step.color,
                    boxShadow: `0 8px 24px ${step.color}40`,
                  }}
                >
                  {step.icon}
                </div>

                <h3
                  className="text-xl font-bold mb-2"
                  style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-sm font-medium mb-3"
                  style={{ color: step.color, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {step.subtitle}
                </p>
                <p
                  className="text-base leading-relaxed max-w-xs mx-auto"
                  style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div
          className="text-center mt-16"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.8s',
          }}
        >
          <a
            href={WORKSPACE_OPTIONS_URL}
            className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold transition-all duration-200"
            style={{
              backgroundColor: BUFFER_BLUE_LIGHT,
              color: '#ffffff',
              fontFamily: BUFFER_FONT_FAMILY,
              borderRadius: '9999px',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(-2px)';
              (e.target as HTMLElement).style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.transform = 'translateY(0)';
              (e.target as HTMLElement).style.boxShadow = '0 4px 14px rgba(59, 130, 246, 0.3)';
            }}
          >
            Try your first video journal
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
};

// === SECTION 7: SOCIAL PROOF LOGOS STRIP ===
const LogoStrip: React.FC = () => {
  const { ref, visible } = useScrollReveal(0.2);
  const pillars = [
    {
      icon: '✍️',
      title: 'Turns raw footage into ideas',
      description: 'Record or upload a clip, get content angles, drafts, and formats.',
    },
    {
      icon: '🧭',
      title: 'Plan your marketing strategy',
      description: 'Content pillars, messaging, what to post and why — powered by the social media manager agent.',
    },
    {
      icon: '✅',
      title: 'Track your tasks',
      description: 'A content calendar to organize, schedule, and follow through.',
    },
  ];

  return (
    <section
      ref={ref}
      className="px-6 py-16"
      style={{ backgroundColor: BUFFER_WHITE }}
    >
      <div
        className="max-w-4xl mx-auto text-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s ease',
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.18em] mb-3"
          style={{ color: BUFFER_BLUE, fontFamily: BUFFER_FONT_FAMILY }}
        >
          Marketing copilot
        </p>
        <h2
          className="text-2xl md:text-3xl font-bold mb-8"
          style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY, letterSpacing: '-0.01em' }}
        >
          {WORKSPACE_TAGLINE}
        </h2>

        <div className="grid gap-4 md:grid-cols-3 text-left mb-10">
          {pillars.map((item, i) => (
            <div
              key={i}
              className="p-4 md:p-5 rounded-2xl transition-all duration-200 h-full"
              style={{ backgroundColor: BUFFER_CREAM, border: `1px solid ${BUFFER_BORDER}` }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 24px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{item.icon}</span>
                <span
                  className="font-semibold text-base"
                  style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {item.title}
                </span>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <p
          className="text-sm mb-6"
          style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}
        >
          Trusted by builders at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60">
          {['Product Hunt', 'Indie Hackers', 'Y Combinator', 'Hacker News', 'Twitter/X'].map((name, i) => (
            <span
              key={i}
              className="text-lg font-semibold"
              style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

// === SECTION 8: HOW IT WORKS - VISUAL STEPS ===
const HowItWorksSection: React.FC = () => {
  const { ref: sectionRef, visible } = useScrollReveal(0.08);

  const steps = [
    {
      number: '01',
      title: 'Dump your thoughts',
      description: 'Write a messy note, paste notes from a voice memo, or just jot down what happened today.',
      color: BUFFER_BLUE,
    },
    {
      number: '02',
      title: 'Let Bipp work its magic',
      description: 'Our AI transforms your raw input into polished, engaging posts that still sound like you.',
      color: BUFFER_PURPLE,
    },
    {
      number: '03',
      title: 'Share and grow',
      description: 'Post across platforms and watch your audience engage with your authentic journey.',
      color: BUFFER_GREEN,
    },
  ];

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="px-6 lg:px-8 overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${BUFFER_WHITE} 0%, ${BUFFER_CREAM} 100%)`,
        paddingTop: '120px',
        paddingBottom: '120px',
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div
          className="text-center mb-20"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            className="inline-block px-4 py-1.5 mb-6 text-sm font-medium"
            style={{
              backgroundColor: BUFFER_BLUE_SOFT,
              color: BUFFER_BLUE,
              fontFamily: BUFFER_FONT_FAMILY,
              borderRadius: '9999px',
            }}
          >
            How it works
          </div>
          <h2
            data-section="how-it-works-heading"
            className="text-3xl md:text-5xl font-bold mb-5"
            style={{
              color: BUFFER_TEXT_PRIMARY,
              fontFamily: BUFFER_FONT_FAMILY,
              letterSpacing: '-0.02em',
            }}
          >
            From idea to impact in 3 steps
          </h2>
          <p
            data-section="how-it-works-subheading"
            className="text-lg max-w-lg mx-auto leading-relaxed"
            style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
          >
            No more staring at blank screens. Just share your progress and watch the posts write themselves.
          </p>
        </div>

        {/* Steps with visual flow */}
        <div className="relative">
          {/* Connecting line (desktop) */}
          <div
            className="hidden lg:block absolute top-24 left-[16.6%] right-[16.6%] h-0.5"
            style={{
              background: `linear-gradient(90deg, ${BUFFER_BLUE} 0%, ${BUFFER_PURPLE} 50%, ${BUFFER_GREEN} 100%)`,
              opacity: visible ? 0.3 : 0,
              transition: 'opacity 1s ease 0.5s',
            }}
          />

          <div className="grid md:grid-cols-3 gap-12 lg:gap-8">
            {steps.map((step, i) => (
              <div
                key={i}
                className="relative text-center"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(30px)',
                  transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${i * 150}ms`,
                }}
              >
                {/* Step number circle */}
                <div
                  className="w-12 h-12 mx-auto mb-6 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{
                    backgroundColor: step.color,
                    fontFamily: BUFFER_FONT_FAMILY,
                    boxShadow: `0 8px 24px ${step.color}40`,
                  }}
                >
                  {step.number}
                </div>

                <h3
                  className="text-xl font-semibold mb-3"
                  style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-base leading-relaxed max-w-xs mx-auto"
                  style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// === SECTION 9: FEATURES WITH PRODUCT SCREENSHOTS ===
const FeaturesSection: React.FC = () => {
  const { ref: sectionRef, visible } = useScrollReveal(0.08);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="px-6 lg:px-8"
      style={{
        backgroundColor: BUFFER_CREAM,
        paddingTop: '120px',
        paddingBottom: '120px',
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div
          className="text-center mb-20"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            className="inline-block px-4 py-1.5 mb-6 text-sm font-medium"
            style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #faf5ff 100%)',
              color: BUFFER_PURPLE,
              fontFamily: BUFFER_FONT_FAMILY,
              borderRadius: '9999px',
            }}
          >
            Powerful tools
          </div>
          <h2
            data-section="features-heading"
            className="text-3xl md:text-5xl font-bold mb-5"
            style={{
              color: BUFFER_TEXT_PRIMARY,
              fontFamily: BUFFER_FONT_FAMILY,
              letterSpacing: '-0.02em',
            }}
          >
            Everything you need to build in public
          </h2>
          <p
            data-section="features-subheading"
            className="text-lg max-w-lg mx-auto leading-relaxed"
            style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
          >
            Two powerful tools working together to make content creation effortless.
          </p>
        </div>

        {/* Feature 1: Raw-to-Post */}
        <div
          className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
          }}
        >
          <div className="order-2 lg:order-1">
            <div
              className="inline-block px-3 py-1 mb-4 text-xs font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: BUFFER_BLUE_SOFT,
                color: BUFFER_BLUE,
                fontFamily: BUFFER_FONT_FAMILY,
                borderRadius: '9999px',
              }}
            >
              Create
            </div>
            <h3
              data-section="feature-1-title"
              className="text-2xl md:text-3xl font-bold mb-4"
              style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY, letterSpacing: '-0.01em' }}
            >
              Raw-to-Post
            </h3>
            <p
              data-section="feature-1-description"
              className="text-lg leading-relaxed mb-6"
              style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
            >
              Transform scattered updates and half-finished thoughts into clear, public-ready posts. Choose your tone, pick your platform, and let Bipp handle the rest.
            </p>
            <ul className="space-y-3">
              {['Multi-format output: threads, posts, captions', 'Tone controls that preserve your voice', 'One-click publish to any platform'].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: '#dcfce7', color: '#15803d' }}
                  >
                    ✓
                  </div>
                  <span style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2 relative">
            <BrowserFrame
              style={{
                transform: 'perspective(1000px) rotateY(-3deg)',
              }}
            >
              <RawToPostMockup />
            </BrowserFrame>
            {/* Decorative elements */}
            <div
              className="absolute -z-10 w-64 h-64 rounded-full blur-3xl opacity-20"
              style={{
                background: BUFFER_BLUE,
                top: '50%',
                right: '-10%',
                transform: 'translateY(-50%)',
              }}
            />
          </div>
        </div>

        {/* Feature 2: Consistency Pulse */}
        <div
          className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
          }}
        >
          <div className="relative">
            <BrowserFrame
              style={{
                transform: 'perspective(1000px) rotateY(3deg)',
              }}
            >
              <ConsistencyPulseMockup />
            </BrowserFrame>
            {/* Floating stats card */}
            <FloatingCard
              className="absolute -right-4 -bottom-4 p-4"
              delay={500}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#dcfce7' }}
                >
                  <span className="text-lg">📈</span>
                </div>
                <div>
                  <div className="text-lg font-bold" style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}>+156%</div>
                  <div className="text-xs" style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}>Engagement this month</div>
                </div>
              </div>
            </FloatingCard>
            {/* Decorative elements */}
            <div
              className="absolute -z-10 w-64 h-64 rounded-full blur-3xl opacity-20"
              style={{
                background: BUFFER_GREEN,
                top: '50%',
                left: '-10%',
                transform: 'translateY(-50%)',
              }}
            />
          </div>
          <div>
            <div
              className="inline-block px-3 py-1 mb-4 text-xs font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                fontFamily: BUFFER_FONT_FAMILY,
                borderRadius: '9999px',
              }}
            >
              Measure
            </div>
            <h3
              data-section="feature-2-title"
              className="text-2xl md:text-3xl font-bold mb-4"
              style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY, letterSpacing: '-0.01em' }}
            >
              Consistency Pulse
            </h3>
            <p
              data-section="feature-2-description"
              className="text-lg leading-relaxed mb-6"
              style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
            >
              Track your posting consistency, audience engagement, and discover which story themes resonate most. Make data-driven decisions about your content strategy.
            </p>
            <ul className="space-y-3">
              {['Visual activity tracking calendar', 'Topic and theme analysis', 'Engagement pattern insights'].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: '#dcfce7', color: '#15803d' }}
                  >
                    ✓
                  </div>
                  <span style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

// === SECTION 10: PREMIUM TESTIMONIALS ===
const TestimonialsSection: React.FC = () => {
  const { ref: sectionRef, visible } = useScrollReveal(0.08);
  const TAGS = [
    { icon: '✍️', label: 'Ideas' },
    { icon: '🧭', label: 'Strategy' },
    { icon: '✅', label: 'Tasks' },
  ];
  const PILLARS = [
    { icon: '✍️', title: 'Turns raw footage into ideas', desc: 'Angles, drafts, and formats from one clip.' },
    { icon: '🧭', title: 'Plan your marketing strategy', desc: 'Pillars, messaging, what to post and why.' },
    { icon: '✅', title: 'Track your tasks', desc: 'A content calendar to organize and ship.' },
  ];

  return (
    <section
      id="testimonials"
      ref={sectionRef}
      className="px-6 lg:px-8 overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${BUFFER_WHITE} 0%, ${BUFFER_CREAM} 100%)`,
        paddingTop: '120px',
        paddingBottom: '120px',
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div
          className="text-center mb-10"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            className="inline-block px-4 py-1.5 mb-6 text-sm font-medium"
            style={{
              backgroundColor: BUFFER_BLUE_SOFT,
              color: BUFFER_BLUE,
              fontFamily: BUFFER_FONT_FAMILY,
              borderRadius: '9999px',
            }}
          >
            Builder to builder
          </div>
          <h2
            data-section="testimonials-heading"
            className="text-3xl md:text-5xl font-bold mb-5"
            style={{
              color: BUFFER_TEXT_PRIMARY,
              fontFamily: BUFFER_FONT_FAMILY,
              letterSpacing: '-0.02em',
            }}
          >
            Builder‑approved marketing copilot
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
          >
            {WORKSPACE_TAGLINE} Real outcomes: more ideas, clearer strategy, fewer dropped tasks.
          </p>
        </div>

        {/* Three pillars mini-row */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {PILLARS.map((item, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl"
              style={{
                backgroundColor: BUFFER_CREAM,
                border: `1px solid ${BUFFER_BORDER}`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                transitionDelay: `${i * 80}ms`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{item.icon}</span>
                <span
                  className="font-semibold text-sm md:text-base"
                  style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {item.title}
                </span>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((testimonial, i) => {
            const tag = TAGS[i % TAGS.length];
            return (
              <div
                key={i}
                className="p-8 rounded-2xl"
                style={{
                  backgroundColor: BUFFER_WHITE,
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
                  border: `1px solid ${BUFFER_BORDER}`,
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(30px)',
                  transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${i * 100}ms`,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className="text-amber-400">★</span>
                    ))}
                  </div>
                  <div
                    className="px-2 py-1 text-xs font-semibold rounded-full"
                    style={{
                      backgroundColor: BUFFER_BLUE_SOFT,
                      color: BUFFER_BLUE,
                      fontFamily: BUFFER_FONT_FAMILY,
                    }}
                  >
                    <span className="mr-1">{tag.icon}</span>
                    {tag.label}
                  </div>
                </div>

                <p
                  className="text-base leading-relaxed mb-6"
                  style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {`"${testimonial.quote}"`}
                </p>

                <div className="flex items-center gap-3">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <div
                      className="font-semibold"
                      style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
                    >
                      {testimonial.name}
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}
                    >
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats row */}
        <div
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
          }}
        >
          {[
            { value: '2,000+', label: 'Active builders' },
            { value: '120K+', label: 'Content ideas' },
            { value: '8,500+', label: 'Plans created' },
            { value: '42K+', label: 'Tasks shipped' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div
                className="text-3xl md:text-4xl font-bold mb-1"
                style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
              >
                {stat.value}
              </div>
              <div
                className="text-sm"
                style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// === SECTION 11: BUFFER-STYLE FAQ ===
const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { ref: sectionRef, visible } = useScrollReveal(0.08);

  return (
    <section
      id="faq"
      ref={sectionRef}
      className="px-6 lg:px-8"
      style={{
        backgroundColor: BUFFER_WHITE,
        paddingTop: '120px',
        paddingBottom: '120px',
      }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div
          className="text-center mb-16"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <h2
            data-section="faq-title"
            className="text-3xl md:text-4xl font-bold mb-5"
            style={{
              color: BUFFER_TEXT_PRIMARY,
              fontFamily: BUFFER_FONT_FAMILY,
              letterSpacing: '-0.02em',
            }}
          >
            Questions? Answers.
          </h2>
          <p
            data-section="faq-subtitle"
            className="text-lg leading-relaxed"
            style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
          >
            Everything you need to know about building in public with {WORKSPACE_BRAND_NAME}.
          </p>
        </div>

        {/* FAQ items - clean, minimal */}
        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="overflow-hidden transition-all duration-300"
              style={{
                backgroundColor: openIndex === i ? BUFFER_CREAM : 'transparent',
                borderRadius: '16px',
                border: `1px solid ${openIndex === i ? BUFFER_BORDER : 'transparent'}`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(12px)',
                transitionDelay: `${i * 60}ms`,
              }}
            >
              <button
                className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span
                  data-section={`faq-${i + 1}-q`}
                  className="text-base md:text-lg font-medium"
                  style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {faq.question}
                </span>
                <span
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-lg transition-transform duration-300"
                  style={{
                    color: BUFFER_TEXT_MUTED,
                    transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0)',
                  }}
                >
                  +
                </span>
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{
                  maxHeight: openIndex === i ? '300px' : '0px',
                  opacity: openIndex === i ? 1 : 0,
                }}
              >
                <p
                  data-section={`faq-${i + 1}-a`}
                  className="px-6 pb-5 leading-relaxed text-base"
                  style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
                >
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// === SECTION 12: PREMIUM PRICING CTA ===
const PricingCTA: React.FC = () => {
  const { ref: sectionRef, visible } = useScrollReveal(0.1);

  return (
    <section
      ref={sectionRef}
      className="px-6 lg:px-8 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${BUFFER_BLUE} 0%, #4f46e5 50%, ${BUFFER_PURPLE} 100%)`,
        paddingTop: '100px',
        paddingBottom: '100px',
      }}
    >
      {/* Background decoration */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px),
                           radial-gradient(circle at 80% 50%, white 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="max-w-5xl mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: CTA content */}
          <div
            className="text-center lg:text-left"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(24px)',
              transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <h2
              data-section="pricing-heading"
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6"
              style={{
                fontFamily: BUFFER_FONT_FAMILY,
                letterSpacing: '-0.02em',
              }}
            >
              Start building your audience today
            </h2>
            <p
              className="text-lg mb-8 text-white/80 leading-relaxed"
              style={{ fontFamily: BUFFER_FONT_FAMILY }}
            >
              Join 2,000+ builders who share their journey with Bipp. Start free, upgrade when you need more.
            </p>

            {/* Pricing pills */}
            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4 mb-8">
              <div
                className="px-6 py-4 rounded-2xl"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="text-white/60 text-sm mb-1" style={{ fontFamily: BUFFER_FONT_FAMILY }}>
                  Free forever
                </div>
                <div className="text-white text-2xl font-bold" style={{ fontFamily: BUFFER_FONT_FAMILY }}>
                  $0<span className="text-base font-normal text-white/60">/mo</span>
                </div>
                <div className="text-white/60 text-sm mt-1" style={{ fontFamily: BUFFER_FONT_FAMILY }}>
                  10 posts/month
                </div>
              </div>
              <div
                className="px-6 py-4 rounded-2xl"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                }}
              >
                <div className="text-sm mb-1" style={{ color: BUFFER_PURPLE, fontFamily: BUFFER_FONT_FAMILY, fontWeight: 600 }}>
                  Pro - Most popular
                </div>
                <div className="text-2xl font-bold" style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}>
                  $19<span className="text-base font-normal" style={{ color: BUFFER_TEXT_MUTED }}>/mo</span>
                </div>
                <div className="text-sm mt-1" style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}>
                  Unlimited everything
                </div>
              </div>
            </div>

            <a
              href={WORKSPACE_OPTIONS_URL}
              data-section="pricing-cta"
              className="inline-flex items-center gap-2 px-10 py-4 text-base font-semibold transition-all duration-200"
              style={{
                backgroundColor: '#ffffff',
                color: BUFFER_TEXT_PRIMARY,
                fontFamily: BUFFER_FONT_FAMILY,
                borderRadius: '9999px',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.transform = 'translateY(-2px)';
                (e.target as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.transform = 'translateY(0)';
                (e.target as HTMLElement).style.boxShadow = 'none';
              }}
            >
              Get started free
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </a>
            <p
              className="mt-4 text-sm text-white/60"
              style={{ fontFamily: BUFFER_FONT_FAMILY }}
            >
              No credit card required · Cancel anytime
            </p>
          </div>

          {/* Right: Floating mockup */}
          <div
            className="relative hidden lg:block"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(40px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
            }}
          >
            <FloatingCard className="p-0 overflow-hidden" delay={0}>
              <BrowserFrame>
                <RawToPostMockup compact />
              </BrowserFrame>
            </FloatingCard>

            {/* Floating stats */}
            <FloatingCard
              className="absolute -left-8 bottom-8 p-4"
              delay={800}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🔥</div>
                <div>
                  <div className="font-bold" style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}>
                    5-day streak!
                  </div>
                  <div className="text-xs" style={{ color: BUFFER_TEXT_MUTED, fontFamily: BUFFER_FONT_FAMILY }}>
                    Keep it going
                  </div>
                </div>
              </div>
            </FloatingCard>
          </div>
        </div>
      </div>
    </section>
  );
};

// === SECTION 13: FOOTER ===
const Footer: React.FC = () => {
  return (
    <footer
      className="px-6 lg:px-8"
      style={{
        backgroundColor: BUFFER_WHITE,
        paddingTop: '64px',
        paddingBottom: '64px',
        borderTop: `1px solid ${BUFFER_BORDER}`,
      }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {WORKSPACE_LOGO_URL && (
              <img src={WORKSPACE_LOGO_URL} alt={WORKSPACE_BRAND_NAME} className="h-8 w-8 object-contain" />
            )}
            <span
              className="font-semibold text-lg"
              style={{ color: BUFFER_TEXT_PRIMARY, fontFamily: BUFFER_FONT_FAMILY }}
            >
              {WORKSPACE_BRAND_NAME}
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8">
            {FOOTER_LINKS.map((link, i) => (
              <a
                key={i}
                href={link.href}
                data-section={link.dataSectionId}
                className="text-sm font-medium transition-colors duration-200"
                style={{ color: BUFFER_TEXT_SECONDARY, fontFamily: BUFFER_FONT_FAMILY }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = BUFFER_TEXT_PRIMARY;
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.color = BUFFER_TEXT_SECONDARY;
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm"
          style={{
            borderTop: `1px solid ${BUFFER_BORDER}`,
            color: BUFFER_TEXT_MUTED,
            fontFamily: BUFFER_FONT_FAMILY,
          }}
        >
          <span data-section="footer-tagline">{WORKSPACE_TAGLINE}</span>
          <span>© {new Date().getFullYear()} {WORKSPACE_BRAND_NAME}</span>
        </div>
      </div>
    </footer>
  );
};

// === SECTION 14: MAIN COMPONENT AND ROOT RENDER ===
const LandingPage: React.FC = () => {
  useEffect(() => {
    // Load Figtree font (Buffer uses this)
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.fontFamily = BUFFER_FONT_FAMILY;
    document.body.style.backgroundColor = BUFFER_WHITE;

    const style = document.createElement('style');
    style.textContent = `
      html { scroll-behavior: smooth; }
      * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; box-sizing: border-box; }
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      .animate-bounce { animation: bounce 2s ease-in-out infinite; }
      .animate-pulse { animation: pulse 2s ease-in-out infinite; }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="min-h-full overflow-y-auto" data-preview-version={PREVIEW_BUNDLE_VERSION} style={{ fontFamily: BUFFER_FONT_FAMILY }}>
      <NavigationBar />
      <HeroSection />
      <WorkspaceOptionsSection />
      <VideoToContentSection />
      <LogoStrip />
      <HowItWorksSection />
      <FeaturesSection />
      <TestimonialsSection />
      <FAQSection />
      <PricingCTA />
      <Footer />
    </div>
  );
};

export default LandingPage;

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<LandingPage />);