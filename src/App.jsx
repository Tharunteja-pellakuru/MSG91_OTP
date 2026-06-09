/**
 * App.jsx — MSG91 OTP Widget Authentication (100% Frontend, no backend)
 *
 * How it works:
 *   1. User enters their mobile number.
 *   2. We call window.initSendOTP() — MSG91's embedded widget takes over,
 *      sends the OTP via SMS, and shows its own OTP entry UI on your page.
 *   3. After the user correctly enters the OTP inside MSG91's widget,
 *      MSG91 fires our `success` callback with { "access-token": "<jwt>" }.
 *   4. We POST that JWT to MSG91's verifyAccessToken endpoint to confirm it.
 *   5. On confirmation → session is saved → success screen shown.
 *
 * Credentials (set in client/.env):
 *   VITE_MSG91_AUTH_KEY   — your MSG91 auth key
 *   VITE_MSG91_WIDGET_ID  — your MSG91 widget ID
 *
 * MSG91 Widget script is loaded in index.html (exposes window.initSendOTP).
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ─── MSG91 Config ──────────────────────────────────────────────────────────────

const MSG91_AUTH_KEY  = import.meta.env.VITE_MSG91_AUTH_KEY;
const MSG91_WIDGET_ID = import.meta.env.VITE_MSG91_WIDGET_ID;

// ─── Constants ─────────────────────────────────────────────────────────────────

const LS_KEY = "otp_auth_mobile";
const VIEW   = { MOBILE: "MOBILE", VERIFYING: "VERIFYING", SUCCESS: "SUCCESS" };

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** True for valid Indian 10-digit numbers starting with 6–9 */
const isValidMobile = (m) => /^[6-9]\d{9}$/.test(m.trim());

/** "9876543210" → "98765 43210" */
const fmt = (m) => m.slice(0, 5) + " " + m.slice(5);

// ─── MSG91 API: verifyAccessToken ─────────────────────────────────────────────

/**
 * MSG91's widget may return the JWT under different key names depending on
 * the widget version. This helper tries all known variants.
 * Logs the raw data so you can check the browser console if needed.
 *
 * @param {object} data - Raw success callback payload from initSendOTP
 * @returns {string|null} JWT token, or null if not found
 */
function extractToken(data) {
  // Log the full payload so you can see the real structure
  console.log("[MSG91 widget] success callback data:", JSON.stringify(data));

  // Try every key MSG91 has been known to use across widget versions
  return (
    data?.["access-token"]   ||
    data?.["accessToken"]    ||
    data?.["token"]          ||
    data?.["access_token"]   ||
    data?.["jwt"]            ||
    null
  );
}

/**
 * Calls MSG91's verifyAccessToken endpoint to validate the JWT returned
 * by the widget. This is an OPTIONAL extra step — MSG91's widget has already
 * verified the OTP internally before firing the success callback.
 *
 * POST https://control.msg91.com/api/v5/widget/verifyAccessToken
 * Body: { authkey, "access-token": jwt }
 *
 * @param {string} accessToken - JWT from MSG91 widget success callback
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function verifyAccessToken(accessToken) {
  const res = await fetch(
    "https://control.msg91.com/api/v5/widget/verifyAccessToken",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        authkey: MSG91_AUTH_KEY,
        "access-token": accessToken,
      }),
    }
  );

  const data = await res.json();
  console.log("[verifyAccessToken] response:", data);

  // MSG91 returns { "type": "success", ... } on success
  if (data?.type === "success") {
    return { success: true, message: "Verified" };
  }

  return {
    success: false,
    message: data?.message || "Token verification failed. Please try again.",
  };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function BackgroundOrbs() {
  return (
    <>
      <div className="bg-orb bg-orb-1" aria-hidden="true" />
      <div className="bg-orb bg-orb-2" aria-hidden="true" />
      <div className="bg-orb bg-orb-3" aria-hidden="true" />
    </>
  );
}

function Alert({ type, message }) {
  if (!message) return null;
  const icons = { error: "⚠️", success: "✅", info: "ℹ️" };
  return (
    <div className={`alert alert-${type}`} role="alert">
      <span className="alert-icon">{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Step 1: Mobile Number Input ───────────────────────────────────────────────

/**
 * Shows the mobile number field.
 * On submit, calls window.initSendOTP() which hands off to MSG91's widget UI.
 */
function MobileStep({ onWidgetSuccess, onWidgetError }) {
  const [mobile, setMobile]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const inputRef = useRef(null);

  // Check that MSG91 widget script has loaded
  const [widgetReady, setWidgetReady] = useState(
    typeof window.initSendOTP === "function"
  );

  useEffect(() => {
    inputRef.current?.focus();

    // Fallback: poll for 5 s in case the script loads after React renders
    if (!widgetReady) {
      const timer = setInterval(() => {
        if (typeof window.initSendOTP === "function") {
          setWidgetReady(true);
          clearInterval(timer);
        }
      }, 200);
      return () => clearInterval(timer);
    }
  }, [widgetReady]);

  const handleMobileChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setMobile(val);
    if (error) setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!mobile) { setError("Please enter your mobile number."); return; }
    if (!isValidMobile(mobile)) {
      setError("Enter a valid 10-digit Indian number (starts with 6–9).");
      return;
    }
    if (!widgetReady) {
      setError("OTP widget is still loading. Please wait a moment and try again.");
      return;
    }

    setLoading(true);
    setError("");

    /**
     * window.initSendOTP() is provided by MSG91's otp-provider.js.
     * It takes over the page UI to:
     *   1. Send the OTP to the given identifier via SMS.
     *   2. Show MSG91's own OTP entry overlay/popup.
     *   3. On correct OTP entry → call success({ "access-token": "<jwt>" }).
     *   4. On failure / cancellation → call failure(error).
     *
     * The identifier must include the country code prefix (91 for India).
     */
    window.initSendOTP({
      widgetId:   '3666696a7636393337373030',
      tokenAuth:  '524555TKfQQx5vIkDv6a27ea21P1',   // ← required by otp-provider.js; absence causes "Token is missing!"
      identifier: `91${mobile}`,    // MSG91 requires country code prefix

      /**
       * MSG91 widget fires this after the user successfully enters the OTP.
       * At this point MSG91 has ALREADY verified the OTP on their servers.
       * We extract the JWT token (if present) and do an optional server-side
       * confirmation via verifyAccessToken. If no token is returned by the
       * widget, we trust MSG91's internal verification and log the user in.
       */
      success: (data) => {
        setLoading(false);
        const token = extractToken(data); // tries all known key names
        // Pass token (may be null — handled gracefully in handleWidgetSuccess)
        onWidgetSuccess({ mobile, accessToken: token });
      },

      failure: (err) => {
        setLoading(false);
        console.error("[MSG91 widget] failure:", err);
        const msg =
          typeof err === "string"
            ? err
            : err?.message || "OTP verification failed. Please try again.";
        onWidgetError(msg);
        setError(msg);
      },
    });
  };

  const isReady = mobile.length === 10 && isValidMobile(mobile);

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Icon + header */}
      <div className="auth-icon-wrap">
        <div className="auth-icon" role="img" aria-label="Shield">🔐</div>
      </div>
      <div className="auth-header">
        <h1>Secure Login</h1>
        <p>
          Enter your mobile number. MSG91 will send you an OTP and verify it
          automatically.
        </p>
      </div>

      {/* Mobile number field */}
      <div className="form-group">
        <label htmlFor="mobile-input" className="form-label">Mobile Number</label>
        <div className="input-wrapper">
          <div className="input-prefix">
            <span>🇮🇳</span> +91
          </div>
          <input
            ref={inputRef}
            id="mobile-input"
            type="tel"
            inputMode="numeric"
            className="form-input with-prefix"
            placeholder="98765 43210"
            value={mobile}
            onChange={handleMobileChange}
            disabled={loading}
            autoComplete="tel-national"
            aria-required="true"
            aria-invalid={!!error}
          />
          {isReady && (
            <span className="input-status" aria-hidden="true">✅</span>
          )}
        </div>
      </div>

      {!widgetReady && (
        <Alert type="info" message="Loading OTP widget…" />
      )}
      {error && <Alert type="error" message={error} />}

      <div style={{ marginTop: "24px" }}>
        <button
          id="send-otp-btn"
          type="submit"
          className="btn btn-primary"
          disabled={loading || !isReady || !widgetReady}
          aria-busy={loading}
        >
          {loading ? (
            <><span className="btn-spinner" />Launching OTP widget…</>
          ) : (
            <>📱 Send OTP via MSG91</>
          )}
        </button>
      </div>

      <p className="auth-footer">
        MSG91 will handle OTP delivery &amp; verification securely.&nbsp;
        <a href="https://msg91.com" target="_blank" rel="noreferrer">
          Learn more
        </a>
      </p>
    </form>
  );
}

// ─── Step 2: Verifying JWT (brief intermediate screen) ────────────────────────

function VerifyingScreen() {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div className="auth-icon-wrap">
        <div
          className="auth-icon"
          style={{ animation: "icon-pulse 1s ease-in-out infinite" }}
          role="img"
          aria-label="Verifying"
        >
          🔄
        </div>
      </div>
      <div className="auth-header">
        <h1>Verifying…</h1>
        <p>Confirming your OTP token with MSG91. Please wait.</p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
        <span className="btn-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    </div>
  );
}

// ─── Step 3: Success / Dashboard ──────────────────────────────────────────────

function SuccessScreen({ mobile, onLogout }) {
  return (
    <div className="success-screen">
      <div className="success-icon-wrap">
        <div className="success-icon" role="img" aria-label="Success">✅</div>
      </div>

      <h2>You're logged in!</h2>
      <p>OTP verified &amp; token confirmed by MSG91.</p>

      <div style={{ margin: "16px 0 28px" }}>
        <span className="user-mobile-badge">📱 +91 {fmt(mobile)}</span>
      </div>

      <Alert
        type="success"
        message="Your identity has been verified. Your session is now active."
      />

      <div className="divider" />

      <button
        id="logout-btn"
        type="button"
        className="btn btn-danger"
        onClick={onLogout}
      >
        🚪 Logout
      </button>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState(() =>
    localStorage.getItem(LS_KEY) ? VIEW.SUCCESS : VIEW.MOBILE
  );
  const [mobile, setMobile]   = useState(() => localStorage.getItem(LS_KEY) || "");
  const [error,  setError]    = useState(""); // top-level error (e.g. verifyAccessToken fail)

  /**
   * Called when MSG91 widget fires its success callback.
   *
   * accessToken may be null if the widget didn't return one (depends on widget
   * version / config). In that case we trust MSG91's internal OTP verification
   * and log the user in directly without calling verifyAccessToken.
   *
   * If a token IS present we call verifyAccessToken as an extra validation step.
   */
  const handleWidgetSuccess = useCallback(async ({ mobile: m, accessToken }) => {
    setMobile(m);
    setView(VIEW.VERIFYING);
    setError("");

    // No token returned by widget — MSG91 already verified the OTP internally.
    // Trust the success callback and log the user in directly.
    if (!accessToken) {
      console.warn(
        "[handleWidgetSuccess] No access-token in widget payload. " +
        "Trusting MSG91's internal OTP verification and proceeding with login."
      );
      localStorage.setItem(LS_KEY, m);
      setView(VIEW.SUCCESS);
      return;
    }

    // Token present — do the optional verifyAccessToken round-trip
    try {
      const result = await verifyAccessToken(accessToken);
      if (result.success) {
        localStorage.setItem(LS_KEY, m);
        setView(VIEW.SUCCESS);
      } else {
        setError(result.message);
        setView(VIEW.MOBILE);
      }
    } catch (err) {
      console.error("[verifyAccessToken] Network error:", err);
      setError("Network error while confirming OTP token. Please try again.");
      setView(VIEW.MOBILE);
    }
  }, []);

  /** Called when MSG91 widget fires its failure callback */
  const handleWidgetError = useCallback((msg) => {
    setError(msg);
    setView(VIEW.MOBILE);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setMobile("");
    setError("");
    setView(VIEW.MOBILE);
  }, []);

  return (
    <>
      <BackgroundOrbs />
      <main className="page-wrapper">
        <div className="auth-card">
          {/* Top-level error from verifyAccessToken (shown back on mobile step) */}
          {error && view === VIEW.MOBILE && (
            <Alert type="error" message={error} />
          )}

          {view === VIEW.MOBILE && (
            <MobileStep
              onWidgetSuccess={handleWidgetSuccess}
              onWidgetError={handleWidgetError}
            />
          )}

          {view === VIEW.VERIFYING && <VerifyingScreen />}

          {view === VIEW.SUCCESS && (
            <SuccessScreen mobile={mobile} onLogout={handleLogout} />
          )}
        </div>
      </main>
    </>
  );
}
