import { useState, useEffect } from 'react';
import { useSpaceRuntime } from '../SpaceRuntimeContext';
import type { DesktopThemeTokens } from '../types';

// Version marker for auto-upgrade detection
// Increment this when making breaking changes that stale copies need
export const EMAIL_GATE_VERSION = 18; // v18: Version bump to re-assert custom EmailGate over any overwritten/stale published copy (Buffer-style redesign with vibrant blue CTAs, coral accent badges, white backgrounds, premium minimal aesthetic)

type ParsedResponseBody = { data: unknown; rawText: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Parses a fetch Response body safely so a 5xx HTML page (proxy timeout,
// memory-crash restart, etc.) does not throw inside `response.json()` and
// get swallowed into the generic "Connection error" copy. Always returns
// an object instead of throwing — callers inspect `response.ok` themselves.
async function parseResponseBody(response: Response): Promise<ParsedResponseBody> {
  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    return { data: null, rawText: '' };
  }

  if (!rawText) {
    return { data: null, rawText: '' };
  }

  try {
    return { data: JSON.parse(rawText) as unknown, rawText };
  } catch {
    return { data: null, rawText };
  }
}

// Pick the most informative error message we can show to the user given
// what came back over the wire. Server-provided `error` always wins; for
// unparseable / non-JSON responses we expose the HTTP status so the bug
// is debuggable instead of being hidden behind "Connection error".
function describeResponseFailure(
  response: Response,
  body: unknown,
  rawText: string,
  fallback: string,
): string {
  if (isRecord(body)) {
    const errField = body.error;
    if (typeof errField === 'string' && errField.trim()) return errField;
    const msgField = body.message;
    if (typeof msgField === 'string' && msgField.trim()) return msgField;
  }

  const status = response.status;
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is temporarily unavailable. Please try again in a moment.';
  }
  if (status >= 500) return `Server error (${status}). Please try again.`;
  if (status === 404) return 'This space could not be found. Please contact support.';
  if (status === 403) return 'This email is not authorized to access this space.';
  if (status === 400 && rawText) {
    // Sometimes the server returns a plain text 400; surface a trimmed copy
    const snippet = rawText.trim().slice(0, 140);
    if (snippet) return snippet;
  }

  return fallback;
}

// Snapshot of the JSON envelope returned by /api/space/:spaceId/register.
// All fields are optional because the server has historically added/removed
// keys; the client narrows individually before use.
interface SpaceRegisterResponseBody {
  success?: boolean;
  workspaceSessionId?: string;
  contactId?: string;
  email?: string;
  isReturningUser?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  visitorId?: string | null;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

// Snapshot of the JSON envelope returned by /api/auth/otp/space/{send,verify}.
interface OtpResponseBody {
  success?: boolean;
  resendCooldown?: number;
  attemptsRemaining?: number;
  expiresIn?: number;
}

interface EmailGateProps {
  spaceId: string;
  branding?: {
    name?: string;
    tagline?: string;
    logoUrl?: string;
  };
  themeTokens?: DesktopThemeTokens;
}

type GateStep = 'loading' | 'email' | 'code' | 'complete';

// ============================================================================
// BUFFER-STYLE DESIGN SYSTEM CONSTANTS
// ============================================================================
const COLORS = {
  // Backgrounds
  pageBg: '#FAFAFA',
  cardBg: '#FFFFFF',

  // Primary CTA - Vibrant Blue
  ctaBlue: '#3B82F6',
  ctaBlueHover: '#2563EB',

  // Accent Badge - Soft Coral/Peach
  badgeBg: '#FDE8E4',
  badgeText: '#E57356',

  // Text Colors
  headline: '#1F2937',
  body: '#6B7280',
  subtle: '#9CA3AF',

  // Borders & Shadows
  border: '#E5E7EB',
  inputBorder: '#D1D5DB',
  shadow: 'rgba(0, 0, 0, 0.04)',
  shadowMd: 'rgba(0, 0, 0, 0.08)',

  // States
  error: '#DC2626',
  success: '#10B981',
};

export default function EmailGate({
  spaceId,
  branding,
  themeTokens,
}: EmailGateProps) {
  const { setSessionId } = useSpaceRuntime();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<GateStep>('loading');
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Get workspaceId from window context
  const workspaceId = (window as any).__WORKSPACE_ID__ || null;
  const gdprEnabled = !!(window as any).__GDPR_ENABLED__;
  const guestModeEnabled = !!(window as any).__GUEST_MODE_ENABLED__;
  const rawSocialProviders = (window as any).__SOCIAL_PROVIDERS__;
  const socialProviders: string[] = Array.isArray(rawSocialProviders) ? rawSocialProviders : [];

  const brandName = branding?.name || 'Bipp';
  const tagline = branding?.tagline || 'Build publicly. Grow together.';
  const logoUrl = branding?.logoUrl;

  useEffect(() => {
    storeAttribution();
    checkExistingSession();
  }, [spaceId]);

  // Pre-fill email from localStorage when loaded inside the onboarding walkthrough
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('walkthrough') === 'true') {
      const storedEmail = localStorage.getItem('user_email');
      if (storedEmail) setEmail(storedEmail);
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const checkExistingSession = async () => {
    const sessionKey = `space_session_${spaceId}`;
    const existingSession = localStorage.getItem(sessionKey);

    if (existingSession) {
      try {
        const session = JSON.parse(existingSession);
        const effectiveSessionId = session.workspaceSessionId || session.id;

        if (effectiveSessionId) {
          if (workspaceId) {
            try {
              const configRes = await fetch(`/api/auth/otp/space/config/${workspaceId}`);
              const configData = await configRes.json();
              const otpConfig = configData.config || configData;

              if (otpConfig.enabled) {
                setOtpEnabled(true);
                const checkRes = await fetch(`/api/auth/otp/space/check-session?workspaceId=${workspaceId}&sessionUuid=${encodeURIComponent(effectiveSessionId)}`, {
                  credentials: 'include'
                });
                const checkData = await checkRes.json();

                if (checkData.verified) {
                  setSessionId(effectiveSessionId);
                  setStep('complete');
                  return;
                } else {
                  setStep('email');
                  return;
                }
              }
            } catch (e) {
              console.log('[EmailGate] OTP config check failed, using simple mode');
            }
          }

          setSessionId(effectiveSessionId);
          setStep('complete');
          return;
        }
      } catch (e) {
        console.error('Failed to parse session:', e);
      }
    }

    if (workspaceId) {
      try {
        const configRes = await fetch(`/api/auth/otp/space/config/${workspaceId}`);
        const configData = await configRes.json();
        const otpConfig = configData.config || configData;
        setOtpEnabled(otpConfig.enabled || false);
      } catch (e) {
        setOtpEnabled(false);
      }
    }

    setStep('email');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();

      if (otpEnabled && workspaceId) {
        const attribution = getAttribution();
        const visitorId = getVisitorId();
        const sessionId = `csess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

        const registerRes = await fetch(`/api/space/${spaceId}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            sessionId,
            visitorId,
            attribution,
            metadata: {},
            workspaceId,
            marketingConsent,
          }),
        });

        const { data: registerResult, rawText: registerRawText } =
          await parseResponseBody(registerRes);

        if (!registerRes.ok) {
          console.error('[EmailGate] register failed', {
            status: registerRes.status,
            body: registerResult ?? registerRawText.slice(0, 200),
          });
          setError(
            describeResponseFailure(
              registerRes,
              registerResult,
              registerRawText,
              'Failed to create session. Please try again.',
            ),
          );
          setLoading(false);
          return;
        }

        if (!isRecord(registerResult)) {
          console.error('[EmailGate] register returned an unparseable body', {
            status: registerRes.status,
            rawText: registerRawText.slice(0, 200),
          });
          setError('The server returned an unexpected response. Please try again.');
          setLoading(false);
          return;
        }

        const registerBody = registerResult as SpaceRegisterResponseBody;
        const wsSessionId = registerBody.workspaceSessionId;
        setPendingSessionId(wsSessionId);

        if (typeof (window as any).fbq === 'function' && (window as any).__META_PIXEL_ID__) {
          (window as any).fbq('init', (window as any).__META_PIXEL_ID__, { em: normalizedEmail.toLowerCase().trim() });
        }
        fireLeadEventWithRetry(normalizedEmail);

        const sessionKey = `space_session_${spaceId}`;
        const pendingSession = {
          id: wsSessionId,
          workspaceSessionId: wsSessionId,
          email: normalizedEmail,
          contactId: registerResult.contactId || null,
          timestamp: Date.now(),
          verified: registerResult.isReturningUser === false,
          isReturningUser: !!registerResult.isReturningUser,
          metadata: registerResult.metadata || {},
        };
        localStorage.setItem(sessionKey, JSON.stringify(pendingSession));

        if (registerResult.isReturningUser === false) {
          try {
            window.dispatchEvent(new CustomEvent('audos:session-established', {
              detail: { workspaceSessionId: wsSessionId, email: normalizedEmail },
            }));
          } catch (e) {}

          setSessionId(wsSessionId);
          setStep('complete');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/auth/otp/space/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: normalizedEmail, workspaceId, sessionUuid: wsSessionId }),
        });

        const { data: otpResult, rawText: otpRawText } = await parseResponseBody(response);

        if (!response.ok) {
          console.error('[EmailGate] otp send failed', {
            status: response.status,
            body: otpResult ?? otpRawText.slice(0, 200),
          });
          setError(
            describeResponseFailure(
              response,
              otpResult,
              otpRawText,
              'Failed to send code. Please try again.',
            ),
          );
          setLoading(false);
          return;
        }

        const otpBody: OtpResponseBody = isRecord(otpResult) ? otpResult : {};
        setResendCooldown(otpBody.resendCooldown ?? 60);
        setStep('code');
      } else {
        await registerSession();
      }
    } catch (err) {
      console.error('[EmailGate] Network error in handleEmailSubmit:', err);
      setError('Connection error. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 4) {
      setError('Please enter the 4-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (!pendingSessionId) {
        setError('Session expired. Please start over.');
        setStep('email');
        setLoading(false);
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();
      const response = await fetch('/api/auth/otp/space/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, code, workspaceId, sessionUuid: pendingSessionId }),
      });

      const { data: verifyResult, rawText: verifyRawText } = await parseResponseBody(response);
      const verifyBody: OtpResponseBody = isRecord(verifyResult) ? verifyResult : {};

      if (!response.ok || !verifyBody.success) {
        console.error('[EmailGate] otp verify failed', {
          status: response.status,
          body: verifyResult ?? verifyRawText.slice(0, 200),
        });
        if (typeof verifyBody.attemptsRemaining === 'number') {
          setError(`Invalid code. ${verifyBody.attemptsRemaining} attempts remaining.`);
        } else {
          setError(
            describeResponseFailure(
              response,
              verifyResult,
              verifyRawText,
              'Invalid code. Please try again.',
            ),
          );
        }
        setLoading(false);
        return;
      }

      await completeVerifiedSession();
    } catch (err) {
      console.error('[EmailGate] Network error in handleCodeSubmit:', err);
      setError('Connection error. Please check your internet connection and try again.');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !pendingSessionId) return;

    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const response = await fetch('/api/auth/otp/space/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail, workspaceId, sessionUuid: pendingSessionId }),
      });

      const { data: resendResult, rawText: resendRawText } = await parseResponseBody(response);

      if (response.ok) {
        const resendBody: OtpResponseBody = isRecord(resendResult) ? resendResult : {};
        setResendCooldown(resendBody.resendCooldown ?? 60);
        setCode('');
      } else {
        console.error('[EmailGate] otp resend failed', {
          status: response.status,
          body: resendResult ?? resendRawText.slice(0, 200),
        });
        setError(
          describeResponseFailure(
            response,
            resendResult,
            resendRawText,
            'Failed to resend code. Please try again.',
          ),
        );
      }
    } catch (err) {
      console.error('[EmailGate] Network error in handleResendCode:', err);
      setError('Connection error. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeVerifiedSession = async () => {
    const sessionKey = `space_session_${spaceId}`;
    const normalizedEmail = email.toLowerCase().trim();
    let verifiedMetadata: Record<string, unknown> = {};
    try {
      const existingSession = localStorage.getItem(sessionKey);
      if (existingSession) {
        const parsed = JSON.parse(existingSession);
        if (parsed.metadata) verifiedMetadata = parsed.metadata;
      }
    } catch {}
    const session = {
      id: pendingSessionId,
      workspaceSessionId: pendingSessionId,
      email: normalizedEmail,
      timestamp: Date.now(),
      verified: true,
      isReturningUser: true,
      metadata: verifiedMetadata,
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));

    try {
      window.dispatchEvent(new CustomEvent('audos:session-established', {
        detail: {
          workspaceSessionId: pendingSessionId,
          email: normalizedEmail,
        }
      }));
    } catch (e) {}

    setSessionId(pendingSessionId!);
    setStep('complete');
    setLoading(false);
  };

  const registerSession = async () => {
    const normalizedEmail = email.toLowerCase().trim();
    const attribution = getAttribution();
    const visitorId = getVisitorId();
    const sessionId = `csess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    const response = await fetch(`/api/space/${spaceId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        sessionId,
        visitorId,
        attribution,
        metadata: {},
        workspaceId,
        marketingConsent,
      }),
    });

    const { data: registerResult, rawText: registerRawText } = await parseResponseBody(response);

    if (!response.ok) {
      console.error('[EmailGate] registerSession failed', {
        status: response.status,
        body: registerResult ?? registerRawText.slice(0, 200),
      });
      setError(
        describeResponseFailure(
          response,
          registerResult,
          registerRawText,
          'Registration failed. Please try again.',
        ),
      );
      setLoading(false);
      return;
    }

    if (!isRecord(registerResult)) {
      console.error('[EmailGate] registerSession returned an unparseable body', {
        status: response.status,
        rawText: registerRawText.slice(0, 200),
      });
      setError('The server returned an unexpected response. Please try again.');
      setLoading(false);
      return;
    }

    const registerBody = registerResult as SpaceRegisterResponseBody;
    const effectiveSessionId =
      registerBody.workspaceSessionId ||
      `anon_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    const sessionKey = `space_session_${spaceId}`;
    const session = {
      id: effectiveSessionId,
      workspaceSessionId: registerBody.workspaceSessionId || effectiveSessionId,
      email: normalizedEmail,
      contactId: registerBody.contactId || null,
      timestamp: Date.now(),
      isReturningUser: !!registerBody.isReturningUser,
      metadata: registerBody.metadata || {},
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));

    try {
      window.dispatchEvent(new CustomEvent('audos:session-established', {
        detail: {
          workspaceSessionId: registerBody.workspaceSessionId,
          email: normalizedEmail,
        }
      }));
    } catch (e) {}

    if (typeof (window as any).fbq === 'function' && (window as any).__META_PIXEL_ID__) {
      (window as any).fbq('init', (window as any).__META_PIXEL_ID__, { em: normalizedEmail.toLowerCase().trim() });
    }
    fireLeadEventWithRetry(normalizedEmail);

    setSessionId(effectiveSessionId);
    setStep('complete');
    setLoading(false);
  };

  const handleGuestMode = async () => {
    setError('');
    setLoading(true);

    try {
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const sessionKey = `space_session_${spaceId}`;
      const guestSession = {
        id: guestId,
        workspaceSessionId: guestId,
        email: null,
        isGuest: true,
        timestamp: Date.now(),
        verified: true,
        metadata: {},
      };
      localStorage.setItem(sessionKey, JSON.stringify(guestSession));

      try {
        window.dispatchEvent(new CustomEvent('audos:session-established', {
          detail: { workspaceSessionId: guestId, isGuest: true },
        }));
      } catch (e) {}

      setSessionId(guestId);
      setStep('complete');
    } catch (err) {
      setError('Could not continue as guest. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    const returnUrl = encodeURIComponent(window.location.href);
    const url = workspaceId
      ? `/api/auth/social/${provider}?workspaceId=${workspaceId}&spaceId=${spaceId}&returnUrl=${returnUrl}`
      : `/api/auth/social/${provider}?spaceId=${spaceId}&returnUrl=${returnUrl}`;
    window.location.href = url;
  };

  function getVisitorId(): string {
    const key = 'audos_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `v_${Math.random().toString(36).substring(2)}_${Date.now()}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getAttrCookie(): Record<string, string> | null {
    try {
      const raw = localStorage.getItem('audos_attribution');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setAttrCookie(jsonStr: string) {
    const ATTR_COOKIE_NAME = 'audos_attr';
    const MULTI_LEVEL_TLDS = ['co.uk','co.za','co.in','co.jp','co.kr','co.nz','com.au','com.br','com.cn','com.mx','com.sg','com.hk','com.tw','com.ar','com.co','com.eg','com.my','com.ng','com.pe','com.ph','com.pk','com.tr','com.ua','com.vn','org.uk','org.au','net.au','net.uk','ac.uk','gov.uk','gov.au','edu.au','ne.jp','or.jp'];
    const hostname = window.location.hostname;
    const platformDomains = [
      'replit.dev', 'replit.app', 'repl.co',
      'github.io', 'herokuapp.com', 'netlify.app', 'vercel.app',
      'pages.dev', 'workers.dev', 'web.app', 'firebaseapp.com',
      'azurewebsites.net', 'cloudfront.net', 'amazonaws.com',
      'ngrok.io', 'ngrok.app', 'railway.app', 'render.com',
      'fly.dev', 'deno.dev', 'glitch.me'
    ];
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    const isIP = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    let isPlatform = false;
    for (let i = 0; i < platformDomains.length; i++) {
      if (hostname.endsWith('.' + platformDomains[i]) || hostname === platformDomains[i]) {
        isPlatform = true;
        break;
      }
    }
    let domainPart = '';
    if (!isLocalhost && !isIP && !isPlatform) {
      const parts = hostname.split('.');
      const lastTwo = parts.slice(-2).join('.');
      if (MULTI_LEVEL_TLDS.indexOf(lastTwo) !== -1 && parts.length >= 3) {
        domainPart = '; domain=.' + parts.slice(-3).join('.');
      } else if (parts.length >= 2) {
        domainPart = '; domain=.' + parts.slice(-2).join('.');
      }
    }
    const isSecure = window.location.protocol === 'https:';
    const secureFlag = isSecure ? '; Secure' : '';
    document.cookie = ATTR_COOKIE_NAME + '=' + encodeURIComponent(jsonStr) + '; max-age=86400; path=/' + domainPart + '; SameSite=Lax' + secureFlag;
  }

  function storeAttribution() {
    const params = new URLSearchParams(window.location.search);
    const hasUtm = params.has('utm_source') || params.has('utm_medium') || params.has('utm_campaign') || params.has('fbclid') || params.has('gclid') || params.has('ref');
    if (!hasUtm) return;

    const attr: Record<string, string> = { capturedAt: Date.now().toString() };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref'].forEach(p => {
      const v = params.get(p);
      if (v) attr[p === 'ref' ? 'referrer' : p.replace('utm_', 'utm').replace('_', '')] = v;
    });
    if (document.referrer) attr.httpReferrer = document.referrer;

    try {
      localStorage.setItem('audos_attribution', JSON.stringify(attr));
    } catch {}

    const cookieAttr: Record<string, string> = { capturedAt: new Date().toISOString() };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref'].forEach(p => {
      const v = params.get(p);
      if (v) cookieAttr[p] = v;
    });
    if (document.referrer) cookieAttr.httpReferrer = document.referrer;
    try {
      setAttrCookie(JSON.stringify(cookieAttr));
      console.log('[EmailGate] Attribution stored in cookie:', cookieAttr);
    } catch {}
  }

  async function fireLeadEventWithRetry(emailAddr: string, attempt = 0) {
    const tryFireFbq = (): boolean => {
      if (typeof (window as any).fbq === 'function') {
        (window as any).fbq('track', 'Lead', {
          content_name: 'Email Capture',
          content_category: 'space',
        }, {
          em: emailAddr.toLowerCase().trim()
        });
        console.log('[EmailGate] Meta Pixel Lead event fired for:', emailAddr);
        return true;
      }
      return false;
    };

    if (!tryFireFbq()) {
      console.log('[EmailGate] fbq not ready, will retry with exponential backoff...');
      const maxRetries = 5;
      const delays = [100, 200, 400, 800, 1600];

      const retryWithBackoff = (retryAttempt: number) => {
        if (retryAttempt >= maxRetries) {
          console.warn('[EmailGate] Failed to fire Lead event - fbq never loaded after 5 retries');
          return;
        }
        setTimeout(() => {
          if (tryFireFbq()) {
            console.log(`[EmailGate] Lead event fired after ${retryAttempt + 1} retries`);
          } else {
            retryWithBackoff(retryAttempt + 1);
          }
        }, delays[retryAttempt]);
      };

      retryWithBackoff(0);
    }

    if (!workspaceId) return;
    try {
      await fetch(`/api/space/${spaceId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'lead',
          sessionId: `lead_${Date.now()}`,
          visitorId: getVisitorId(),
          metadata: { email: emailAddr, ...getAttribution() },
          workspaceId,
        }),
      });
    } catch {
      if (attempt < 2) setTimeout(() => fireLeadEventWithRetry(emailAddr, attempt + 1), 2000);
    }
  }

  const getAttribution = () => {
    const params = new URLSearchParams(window.location.search);

    const urlAttribution: Record<string, string | null> = {};
    if (params.get('utm_source')) urlAttribution.utmSource = params.get('utm_source');
    if (params.get('utm_medium')) urlAttribution.utmMedium = params.get('utm_medium');
    if (params.get('utm_campaign')) urlAttribution.utmCampaign = params.get('utm_campaign');
    if (params.get('utm_content')) urlAttribution.utmContent = params.get('utm_content');
    if (params.get('utm_term')) urlAttribution.utmTerm = params.get('utm_term');
    if (params.get('fbclid')) urlAttribution.fbclid = params.get('fbclid');
    if (params.get('gclid')) urlAttribution.gclid = params.get('gclid');
    if (params.get('ref')) urlAttribution.referrer = params.get('ref');
    if (document.referrer) urlAttribution.httpReferrer = document.referrer;

    const storedAttr = getAttrCookie();

    const merged: Record<string, string | null> = {};
    if (storedAttr) {
      for (const [key, value] of Object.entries(storedAttr)) {
        if (value && key !== 'capturedAt') merged[key] = value;
      }
    }
    for (const [key, value] of Object.entries(urlAttribution)) {
      if (value) merged[key] = value;
    }

    return Object.keys(merged).length > 0 ? merged : null;
  };

  // Brand logo mark
  const BrandMark = ({ size = 40 }: { size?: number }) => {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt={brandName}
          style={{ width: size, height: size, objectFit: 'contain', borderRadius: 8 }}
        />
      );
    }
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.25,
          backgroundColor: COLORS.ctaBlue,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontWeight: 700,
          fontSize: size * 0.4,
          fontFamily: `'Inter', system-ui, -apple-system, sans-serif`,
          flexShrink: 0,
        }}
      >
        {brandName.charAt(0).toUpperCase()}
      </div>
    );
  };

  // Social proof avatars component
  const SocialProofAvatars = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${['#FDE8E4', '#E0F2FE', '#FEF3C7', '#D1FAE5', '#EDE9FE'][i]} 0%, ${['#FECACA', '#BAE6FD', '#FCD34D', '#A7F3D0', '#DDD6FE'][i]} 100%)`,
              border: '2px solid white',
              marginLeft: i === 0 ? 0 : -10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            {['👨‍💻', '👩‍🎨', '🧑‍🚀', '👨‍🔬', '👩‍💼'][i]}
          </div>
        ))}
      </div>
      <span style={{ color: COLORS.body, fontSize: 14, fontWeight: 500 }}>
        Join 2,000+ builders
      </span>
    </div>
  );

  if (step === 'loading' || step === 'complete') {
    return null;
  }

  // ============================================================================
  // OTP Code verification screen - Buffer style
  // ============================================================================
  if (step === 'code') {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: COLORS.pageBg,
            fontFamily: `'Inter', system-ui, -apple-system, sans-serif`,
          }}
        >
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
            <div style={{ width: '100%', maxWidth: 400 }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                  <BrandMark size={56} />
                </div>
                <h1 style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: COLORS.headline,
                  margin: '0 0 12px 0',
                  letterSpacing: '-0.02em',
                }}>
                  Check your inbox
                </h1>
                <p style={{ fontSize: 16, color: COLORS.body, margin: 0, lineHeight: 1.6 }}>
                  We sent a 4-digit code to<br />
                  <span style={{ fontWeight: 600, color: COLORS.headline }}>{email}</span>
                </p>
              </div>

              {/* Code Form Card */}
              <div style={{
                backgroundColor: COLORS.cardBg,
                borderRadius: 16,
                padding: 32,
                boxShadow: `0 1px 3px ${COLORS.shadow}, 0 4px 20px ${COLORS.shadow}`,
                border: `1px solid ${COLORS.border}`,
              }}>
                <form onSubmit={handleCodeSubmit}>
                  <div style={{ marginBottom: 24 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={code}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setCode(val);
                        setError('');
                      }}
                      placeholder="0000"
                      style={{
                        width: '100%',
                        padding: '16px 20px',
                        fontSize: 32,
                        fontWeight: 600,
                        textAlign: 'center',
                        letterSpacing: '0.3em',
                        fontFamily: 'monospace',
                        borderRadius: 12,
                        border: `2px solid ${error ? COLORS.error : COLORS.inputBorder}`,
                        backgroundColor: COLORS.cardBg,
                        color: COLORS.headline,
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onFocus={(e) => {
                        if (!error) {
                          e.target.style.borderColor = COLORS.ctaBlue;
                          e.target.style.boxShadow = `0 0 0 3px rgba(59, 130, 246, 0.1)`;
                        }
                      }}
                      onBlur={(e) => {
                        if (!error) {
                          e.target.style.borderColor = COLORS.inputBorder;
                          e.target.style.boxShadow = 'none';
                        }
                      }}
                      disabled={loading}
                      autoFocus
                      data-testid="input-code"
                    />
                    {error && (
                      <p style={{ marginTop: 8, fontSize: 14, color: COLORS.error }} data-testid="text-error">
                        {error}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || code.length !== 4}
                    style={{
                      width: '100%',
                      padding: '16px 24px',
                      fontSize: 16,
                      fontWeight: 600,
                      borderRadius: 100,
                      border: 'none',
                      backgroundColor: loading || code.length !== 4 ? '#93C5FD' : COLORS.ctaBlue,
                      color: '#FFFFFF',
                      cursor: loading || code.length !== 4 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: loading || code.length !== 4 ? 'none' : `0 4px 14px rgba(59, 130, 246, 0.4)`,
                    }}
                    onMouseOver={(e) => {
                      if (!loading && code.length === 4) {
                        e.currentTarget.style.backgroundColor = COLORS.ctaBlueHover;
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!loading && code.length === 4) {
                        e.currentTarget.style.backgroundColor = COLORS.ctaBlue;
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                    data-testid="button-verify"
                  >
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </button>
                </form>

                {/* Resend / Change email */}
                <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', justifyContent: 'center', gap: 16 }}>
                  <button
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      color: resendCooldown > 0 ? COLORS.subtle : COLORS.ctaBlue,
                      cursor: resendCooldown > 0 ? 'default' : 'pointer',
                      padding: 0,
                    }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                  <span style={{ color: COLORS.subtle }}>|</span>
                  <button
                    onClick={() => { setStep('email'); setCode(''); setError(''); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      color: COLORS.body,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Change email
                  </button>
                </div>
              </div>

              {/* Footer trust line */}
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <p style={{ fontSize: 13, color: COLORS.subtle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.subtle} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  Your data is private and secure
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ============================================================================
  // Main email entry screen - Buffer-style full landing page
  // ============================================================================
  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: COLORS.pageBg,
          fontFamily: `'Inter', system-ui, -apple-system, sans-serif`,
          overflowY: 'auto',
        }}
      >

        {/* ===== HERO SECTION ===== */}
        <section style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 24px',
          backgroundColor: '#FFFFFF',
        }}>
          <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
            {/* Brand header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 48 }}>
              <BrandMark size={40} />
              <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.headline }}>
                {brandName}
              </span>
            </div>

            {/* Coral accent badge */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <span style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: COLORS.badgeBg,
                color: COLORS.badgeText,
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 100,
              }}>
                For entrepreneurs who build out loud
              </span>
            </div>

            {/* Hero headline */}
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h1 style={{
                fontSize: 'clamp(32px, 8vw, 48px)',
                fontWeight: 700,
                color: COLORS.headline,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                margin: '0 0 20px 0',
              }}>
                Turn your messy notes into polished posts in seconds
              </h1>
              <p style={{
                fontSize: 18,
                color: COLORS.body,
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 400,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}>
                AI-powered tools for founders who build in public. Stay consistent, sound authentic, grow your audience.
              </p>
            </div>

            {/* Email form */}
            <div style={{
              backgroundColor: COLORS.cardBg,
              borderRadius: 20,
              padding: 32,
              boxShadow: `0 1px 3px ${COLORS.shadow}, 0 8px 32px ${COLORS.shadowMd}`,
              border: `1px solid ${COLORS.border}`,
            }}>
              <form onSubmit={handleEmailSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter your email"
                    style={{
                      width: '100%',
                      padding: '16px 20px',
                      fontSize: 16,
                      borderRadius: 12,
                      border: `2px solid ${error ? COLORS.error : COLORS.inputBorder}`,
                      backgroundColor: COLORS.cardBg,
                      color: COLORS.headline,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxShadow: `0 1px 2px ${COLORS.shadow}`,
                    }}
                    onFocus={(e) => {
                      if (!error) {
                        e.target.style.borderColor = COLORS.ctaBlue;
                        e.target.style.boxShadow = `0 0 0 3px rgba(59, 130, 246, 0.1)`;
                      }
                    }}
                    onBlur={(e) => {
                      if (!error) {
                        e.target.style.borderColor = COLORS.inputBorder;
                        e.target.style.boxShadow = `0 1px 2px ${COLORS.shadow}`;
                      }
                    }}
                    disabled={loading}
                    required
                    autoFocus
                    data-testid="input-email"
                  />
                  {error && (
                    <p style={{ marginTop: 8, fontSize: 14, color: COLORS.error }} data-testid="text-error">
                      {error}
                    </p>
                  )}
                </div>

                {/* GDPR Consent Block */}
                {gdprEnabled && (
                  <div style={{
                    marginBottom: 16,
                    padding: 12,
                    backgroundColor: COLORS.pageBg,
                    borderRadius: 10,
                    fontSize: 13,
                    color: COLORS.body,
                  }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      By entering your email, you agree to our{' '}
                      <a href="/privacy" style={{ fontWeight: 600, color: COLORS.headline, textDecoration: 'underline' }}>
                        Privacy Policy
                      </a>.
                    </p>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        style={{ marginTop: 2, width: 16, height: 16, accentColor: COLORS.ctaBlue }}
                      />
                      <span>I want to receive marketing emails and updates (optional)</span>
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    fontSize: 16,
                    fontWeight: 600,
                    borderRadius: 100,
                    border: 'none',
                    backgroundColor: loading || !email ? '#93C5FD' : COLORS.ctaBlue,
                    color: '#FFFFFF',
                    cursor: loading || !email ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: loading || !email ? 'none' : `0 4px 14px rgba(59, 130, 246, 0.4)`,
                  }}
                  onMouseOver={(e) => {
                    if (!loading && email) {
                      e.currentTarget.style.backgroundColor = COLORS.ctaBlueHover;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!loading && email) {
                      e.currentTarget.style.backgroundColor = COLORS.ctaBlue;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                  data-testid="button-continue"
                >
                  {loading ? 'Just a moment...' : 'Get Started — Free'}
                </button>
              </form>

              {/* Trust indicators */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                marginTop: 20,
                fontSize: 13,
                color: COLORS.subtle,
                flexWrap: 'wrap',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill={COLORS.success}>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  100% free
                </span>
                <span>•</span>
                <span>No credit card</span>
                <span>•</span>
                <span>Instant access</span>
              </div>

              {/* Social Login */}
              {socialProviders.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.subtle }}>or continue with</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: socialProviders.length === 1 ? '1fr' : '1fr 1fr', gap: 12 }}>
                    {socialProviders.map((provider) => (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => handleSocialLogin(provider)}
                        disabled={loading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          padding: '14px 20px',
                          borderRadius: 100,
                          border: `1px solid ${COLORS.border}`,
                          backgroundColor: COLORS.cardBg,
                          color: COLORS.headline,
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: loading ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => {
                          if (!loading) {
                            e.currentTarget.style.backgroundColor = COLORS.pageBg;
                            e.currentTarget.style.borderColor = COLORS.inputBorder;
                          }
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = COLORS.cardBg;
                          e.currentTarget.style.borderColor = COLORS.border;
                        }}
                      >
                        {provider === 'google' && (
                          <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        )}
                        {provider === 'facebook' && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )}
                        {provider === 'apple' && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
                          </svg>
                        )}
                        {provider === 'linkedin' && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        )}
                        <span style={{ textTransform: 'capitalize' }}>{provider}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Guest Mode */}
              {guestModeEnabled && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleGuestMode}
                    disabled={loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      color: COLORS.subtle,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      padding: 0,
                    }}
                    data-testid="button-guest-mode"
                  >
                    Continue as guest →
                  </button>
                </div>
              )}
            </div>

            {/* Social proof avatars */}
            <div style={{ marginTop: 32 }}>
              <SocialProofAvatars />
            </div>
          </div>

          {/* Scroll indicator */}
          <div style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            animation: 'bounce 2s infinite',
          }}>
            <style>{`
              @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
                40% { transform: translateX(-50%) translateY(-8px); }
                60% { transform: translateX(-50%) translateY(-4px); }
              }
            `}</style>
            <svg width="24" height="24" fill="none" stroke={COLORS.subtle} strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </section>

        {/* ===== VALUE PROPS SECTION ===== */}
        <section style={{ padding: '96px 24px', backgroundColor: COLORS.pageBg }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: COLORS.badgeBg,
                color: COLORS.badgeText,
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 100,
                marginBottom: 16,
              }}>
                Built for builders
              </span>
              <h2 style={{
                fontSize: 'clamp(28px, 6vw, 36px)',
                fontWeight: 700,
                color: COLORS.headline,
                margin: '0 0 16px 0',
                letterSpacing: '-0.02em',
              }}>
                Every tool a founder actually needs
              </h2>
              <p style={{ fontSize: 17, color: COLORS.body, margin: 0, lineHeight: 1.6 }}>
                {brandName} keeps you consistent, visible, and growing — without the content overwhelm.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                {
                  icon: '✍️',
                  title: 'Raw-to-Post',
                  subtitle: 'From messy to magnetic',
                  desc: `Paste your chaotic notes, half-formed ideas, or weekly summary — ${brandName} shapes them into a post that sounds exactly like you.`
                },
                {
                  icon: '📊',
                  title: 'Consistency Pulse',
                  subtitle: 'Know what works',
                  desc: 'Log your posts and track engagement patterns over time. Discover which themes land, and get prompts to follow up on your best content.'
                },
                {
                  icon: '🤖',
                  title: 'Otto, your AI coach',
                  subtitle: 'Never stare at a blank screen',
                  desc: 'Ask Otto to punch up a headline, reframe your story, or suggest your next post based on what you shipped this week.'
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 20,
                    padding: 24,
                    backgroundColor: COLORS.cardBg,
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: `0 1px 3px ${COLORS.shadow}`,
                  }}
                >
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: COLORS.badgeBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.headline, margin: '0 0 4px 0' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.badgeText, margin: '0 0 8px 0' }}>
                      {item.subtitle}
                    </p>
                    <p style={{ fontSize: 15, color: COLORS.body, margin: 0, lineHeight: 1.5 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== HOW IT WORKS SECTION ===== */}
        <section style={{ padding: '96px 24px', backgroundColor: '#FFFFFF' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{
                fontSize: 'clamp(28px, 6vw, 36px)',
                fontWeight: 700,
                color: COLORS.headline,
                margin: '0 0 16px 0',
                letterSpacing: '-0.02em',
              }}>
                How {brandName} helps you build in public
              </h2>
              <p style={{ fontSize: 17, color: COLORS.body, margin: 0, lineHeight: 1.6 }}>
                Three simple steps to content that connects.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {[
                {
                  step: '1',
                  title: 'Dump your week into Raw-to-Post',
                  desc: `No perfect sentences needed. Just tell ${brandName} what you shipped, learned, or struggled with — and it drafts a post that sounds like you.`
                },
                {
                  step: '2',
                  title: 'Watch your Consistency Pulse',
                  desc: `Record when you posted and what kind of response you got. ${brandName} spots patterns so you know which story angles bring in the most followers.`
                },
                {
                  step: '3',
                  title: 'Ask Otto for momentum',
                  desc: `Stuck on a hook? Not sure what to post next? Otto knows your recent posts and can suggest your next move or sharpen your writing.`
                }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: COLORS.ctaBlue,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 20,
                    flexShrink: 0,
                  }}>
                    {item.step}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.headline, margin: '0 0 8px 0' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: 15, color: COLORS.body, margin: 0, lineHeight: 1.6 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== SOCIAL PROOF SECTION ===== */}
        <section style={{ padding: '96px 24px', backgroundColor: COLORS.pageBg }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{
                fontSize: 'clamp(28px, 6vw, 36px)',
                fontWeight: 700,
                color: COLORS.headline,
                margin: '0 0 16px 0',
                letterSpacing: '-0.02em',
              }}>
                Founders who post publicly, grow faster
              </h2>
              <p style={{ fontSize: 17, color: COLORS.body, margin: 0, lineHeight: 1.6 }}>
                {`Here’s what early ${brandName} users are saying.`}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                {
                  quote: `I used to sit on updates for days because I didn’t know how to make them interesting. Raw-to-Post got me to ship a post in 10 minutes. Got three DMs from potential customers that same day.`,
                  name: 'Marcus L.',
                  role: 'Solo SaaS founder'
                },
                {
                  quote: `The Consistency Pulse showed me that my "failure" posts get way more engagement than my wins. That was a real mindset shift for me.`,
                  name: 'Priya S.',
                  role: 'Indie maker'
                },
                {
                  quote: `Otto suggested I write about my pricing mistake as a thread. I did. It went viral for my niche. ${brandName} changed how I think about building in public.`,
                  name: 'Tom A.',
                  role: 'Bootstrapped founder'
                }
              ].map((testimonial, i) => (
                <div
                  key={i}
                  style={{
                    padding: 24,
                    backgroundColor: COLORS.cardBg,
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: `0 1px 3px ${COLORS.shadow}`,
                  }}
                >
                  <p style={{
                    fontSize: 15,
                    color: COLORS.headline,
                    margin: '0 0 16px 0',
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                  }}>
                    "{testimonial.quote}"
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: COLORS.badgeBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      color: COLORS.badgeText,
                      fontSize: 14,
                    }}>
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.headline, margin: 0 }}>
                        {testimonial.name}
                      </p>
                      <p style={{ fontSize: 13, color: COLORS.body, margin: 0 }}>
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== FINAL CTA SECTION ===== */}
        <section style={{ padding: '96px 24px', backgroundColor: COLORS.ctaBlue }}>
          <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ marginBottom: 32 }}>
              <BrandMark size={56} />
            </div>

            <h2 style={{
              fontSize: 'clamp(28px, 6vw, 36px)',
              fontWeight: 700,
              color: '#FFFFFF',
              margin: '0 0 16px 0',
              letterSpacing: '-0.02em',
            }}>
              Your next post is one update away
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)', margin: '0 0 32px 0', lineHeight: 1.6 }}>
              {`Join ${brandName} free. Turn this week’s work into content that builds your audience.`}
            </p>

            <form onSubmit={handleEmailSubmit} style={{ maxWidth: 400, margin: '0 auto' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="Enter your email"
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  fontSize: 16,
                  borderRadius: 12,
                  border: '2px solid rgba(255,255,255,0.3)',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: '#FFFFFF',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: 12,
                }}
                disabled={loading}
                required
              />
              {error && (
                <p style={{ fontSize: 14, color: '#FEE2E2', marginBottom: 12 }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  borderRadius: 100,
                  border: 'none',
                  backgroundColor: loading || !email ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                  color: loading || !email ? 'rgba(255,255,255,0.8)' : COLORS.ctaBlue,
                  cursor: loading || !email ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  if (!loading && email) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {loading ? 'Just a moment...' : 'Get Started Free'}
              </button>
            </form>

            {guestModeEnabled && (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={handleGuestMode}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.7)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                >
                  Continue as guest →
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer style={{ padding: '48px 24px', backgroundColor: '#FFFFFF' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              <BrandMark size={28} />
              <span style={{ fontSize: 16, fontWeight: 700, color: COLORS.headline }}>
                {brandName}
              </span>
            </div>
            <p style={{ fontSize: 14, color: COLORS.body, margin: '0 0 8px 0' }}>
              {tagline}
            </p>
            <p style={{ fontSize: 13, color: COLORS.subtle, margin: 0 }}>
              © {new Date().getFullYear()} {brandName}. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
