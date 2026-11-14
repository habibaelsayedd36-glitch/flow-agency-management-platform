"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/flow-icons";
import { InstallAppButton } from "@/components/install-app-button";

export type AuthUserView = { id: string; fullName: string; email: string; role: string; status: string; organizationId: string | null; organizationStatus: string | null };
export type OrganizationView = { id: string; companyName: string; contactPerson: string; phone: string | null; category: string | null; website: string | null; description: string | null; additionalRequirements: string | null; preferredLanguage: string; targetMarketplaces: string[]; requiredServices: string[]; monthlyProductEstimate: number | null; status: string; createdAt: string };

type Props = { onAuthenticated: () => void; language: "en" | "ar"; onLanguageChange: (language: "en" | "ar") => void };
type AuthMode = "login" | "register" | "forgot" | "reset";

const marketplaceOptions = ["Amazon", "Noon", "TikTok Shop", "Shopify", "InstaShop"];
const serviceOptions = [
  ["product-photography", "Product photography"],
  ["bilingual-listing", "Bilingual listing content"],
  ["photography-listing-bundle", "Photography + listing"],
  ["marketplace-account-management", "Marketplace account management"],
];

const copy = {
  en: {
    portal: "CLIENT PORTAL", loginTitle: "Welcome back", signIn: "Sign in to your FLOW workspace.", email: "Work email", password: "Password", forgot: "Forgot password?", signInButton: "Sign in", noAccount: "New to FLOW?", createAccount: "Create a workspace", register: "Create your workspace", registerSub: "A few details help us shape the right flow for your products.", contact: "Contact person", company: "Company name", phone: "Phone number", category: "Business category", website: "Website (optional)", business: "Tell us what you sell", language: "Preferred language", marketplaces: "Where do you sell?", services: "What would you like help with?", quantity: "Estimated products per month", requirements: "Anything else we should know?", submit: "Send account request", creating: "Creating workspace…", hasAccount: "Already have an account?", loginLabel: "Sign in", passwordHint: "At least 12 characters", forgotTitle: "Reset your password", forgotSub: "We’ll send a secure reset link if email delivery is configured for your workspace.", sendLink: "Send reset link", back: "Back to sign in", resetTitle: "Choose a new password", resetButton: "Save new password", genericError: "Something went wrong. Please try again.", verifyDone: "Email verified", verifyText: "Your email address is confirmed. The FLOW team will review your workspace request.", verifyInvalid: "This verification link is invalid or has expired.", success: "Workspace request received", successText: "Thanks for introducing your business to FLOW. Your workspace is in review. You can sign in to check its status.", authPending: "Your workspace is awaiting FLOW team activation.", marketplacesPlaceholder: "Select all that apply", businessPlaceholder: "For example: homeware, beauty, electronics…", submitHint: "New client accounts are reviewed by the FLOW team before production access is enabled.", or: "OR", terms: "By continuing, you agree to use FLOW’s client portal for your agency work.", apply: "Request access", secure: "A considered workflow, from first submission to final listing."},
  ar: {
    portal: "بوابة العملاء", loginTitle: "مرحباً بعودتك", signIn: "سجّل الدخول إلى مساحة العمل الخاصة بك مع FLOW.", email: "البريد الإلكتروني للعمل", password: "كلمة المرور", forgot: "هل نسيت كلمة المرور؟", signInButton: "تسجيل الدخول", noAccount: "جديد مع FLOW؟", createAccount: "إنشاء مساحة عمل", register: "أنشئ مساحة عملك", registerSub: "بعض التفاصيل تساعدنا في إعداد المسار المناسب لمنتجاتك.", contact: "الشخص المسؤول", company: "اسم الشركة", phone: "رقم الهاتف", category: "مجال العمل", website: "الموقع الإلكتروني (اختياري)", business: "أخبرنا بما تبيعه", language: "اللغة المفضلة", marketplaces: "أين تبيع؟", services: "ما الخدمات التي تحتاجها؟", quantity: "المنتجات المتوقعة شهرياً", requirements: "معلومات إضافية", submit: "إرسال طلب الحساب", creating: "جارٍ إنشاء المساحة…", hasAccount: "لديك حساب بالفعل؟", loginLabel: "تسجيل الدخول", passwordHint: "12 حرفاً على الأقل", forgotTitle: "إعادة تعيين كلمة المرور", forgotSub: "سنرسل رابطاً آمناً إذا كان البريد مفعلاً لمساحة العمل.", sendLink: "إرسال رابط الاستعادة", back: "العودة لتسجيل الدخول", resetTitle: "اختر كلمة مرور جديدة", resetButton: "حفظ كلمة المرور", genericError: "حدث خطأ. حاول مرة أخرى.", verifyDone: "تم تأكيد البريد الإلكتروني", verifyText: "تم تأكيد بريدك. سيقوم فريق FLOW بمراجعة طلب مساحة العمل.", verifyInvalid: "رابط التأكيد غير صالح أو انتهت صلاحيته.", success: "تم استلام طلب مساحة العمل", successText: "شكراً لتعريفنا بنشاطك. مساحة العمل قيد المراجعة، ويمكنك تسجيل الدخول لمتابعة حالتها.", authPending: "مساحة العمل بانتظار تفعيل فريق FLOW.", marketplacesPlaceholder: "اختر كل ما ينطبق", businessPlaceholder: "مثلاً: أدوات منزلية، جمال، إلكترونيات…", submitHint: "يراجع فريق FLOW حسابات العملاء الجدد قبل تفعيل الوصول للإنتاج.", or: "أو", terms: "باستمرارك، توافق على استخدام بوابة FLOW لأعمال الوكالة.", apply: "طلب الوصول", secure: "مسار مدروس من تقديم المنتج حتى صفحة البيع."},
};

function Logo({ variant = "green" }: { variant?: "green" | "white" }) {
  const src = variant === "white"
    ? "https://www.flow-agency-eg.com/assets/logo/flow-lockup-white.png"
    : "https://www.flow-agency-eg.com/assets/logo/flow-lockup-green.png";
  return <img className="flow-lockup" src={src} alt="FLOW Agency" />;
}

export function AuthScreen({ onAuthenticated, language, onLanguageChange }: Props) {
  const text = copy[language];
  const [mode, setMode] = useState<AuthMode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [marketplaces, setMarketplaces] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [queryToken, setQueryToken] = useState("");
  const [verificationState, setVerificationState] = useState<"idle" | "done" | "invalid">("idle");
  const rtl = language === "ar";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get("reset");
    const verify = params.get("verify");
    if (reset) { setQueryToken(reset); setMode("reset"); }
    if (verify) {
      setQueryToken(verify);
      fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: verify }) })
        .then(async (response) => response.ok ? setVerificationState("done") : setVerificationState("invalid"))
        .catch(() => setVerificationState("invalid"));
    }
  }, []);

  const serviceLabels = useMemo(() => new Map<string, string>(serviceOptions as [string, string][]), []);
  const action = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      if (mode === "login") {
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || text.genericError);
        onAuthenticated();
        return;
      }
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: data.get("fullName"),
            companyName: data.get("companyName"),
            email: data.get("email"),
            password: data.get("password"),
            phone: data.get("phone"),
            category: data.get("category"),
            website: data.get("website"),
            description: data.get("description"),
            preferredLanguage: data.get("preferredLanguage"),
            targetMarketplaces: marketplaces,
            requiredServices: services,
            monthlyProductEstimate: data.get("monthlyProductEstimate"),
            additionalRequirements: data.get("additionalRequirements"),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || text.genericError);
        setNotice(text.successText);
        setMode("login");
        return;
      }
      if (mode === "forgot") {
        const response = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email") }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || text.genericError);
        setNotice(result.message || text.forgotSub);
        return;
      }
      const response = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: queryToken, password: data.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || text.genericError);
      setNotice(text.successText);
      window.history.replaceState({}, "", window.location.pathname);
      setMode("login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.genericError);
    } finally {
      setBusy(false);
    }
  };

  const toggleChoice = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <main className={`auth-page ${rtl ? "is-rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      <section className="auth-brand-panel">
        <div className="auth-brand-top"><Logo variant="white" /><span className="portal-kicker">{text.portal}</span></div>
        <div className="auth-brand-copy">
          <span className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> E-COMMERCE CONTENT & MARKETPLACE OPERATIONS</span>
          <h1>From product to marketplace — in one <em>flow.</em></h1>
          <p>{text.secure}</p>
          <div className="auth-service-stack">
            <div className="auth-service"><span className="auth-service-icon"><Icon name="camera" size={18} /></span><span><b>Studio photography</b><small>Marketplace-ready image sets</small></span><Icon name="arrow" size={17} className="auth-service-arrow" /></div>
            <div className="auth-service"><span className="auth-service-icon"><Icon name="file" size={18} /></span><span><b>Bilingual listing content</b><small>Arabic + English, SEO considered</small></span><Icon name="arrow" size={17} className="auth-service-arrow" /></div>
            <div className="auth-service"><span className="auth-service-icon"><Icon name="marketplace" size={18} /></span><span><b>Marketplace account support</b><small>One clear production workflow</small></span><Icon name="arrow" size={17} className="auth-service-arrow" /></div>
          </div>
          <div className="auth-trust-row"><span>Built around the platforms you sell on</span><div className="marketplace-wordmarks"><b>amazon</b><b>noon</b><b>Shopify</b><b>TikTok Shop</b></div></div>
        </div>
        <div className="auth-footer-note"><span>FLOW Agency</span><span>Egypt · E-commerce content studio</span></div>
        <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-top"><span className="auth-help">{mode === "register" ? "A workspace built around your products." : "Your work, in one clear place."}</span><div className="auth-form-top-actions"><InstallAppButton language={language} /><button type="button" className="language-toggle" onClick={() => onLanguageChange(rtl ? "en" : "ar")} aria-label="Switch language"><Icon name="globe" size={16} /> {rtl ? "EN" : "عربي"}</button></div></div>
        <div className="auth-card-wrap">
          <div className="auth-card">
            {verificationState !== "idle" ? (
              <div className="auth-complete-state">
                <span className={`success-mark ${verificationState === "invalid" ? "error-mark" : ""}`}><Icon name={verificationState === "done" ? "check" : "close"} size={22} /></span>
                <span className="eyebrow">{verificationState === "done" ? text.verifyDone : text.verifyInvalid}</span>
                <h2>{verificationState === "done" ? text.verifyDone : text.verifyInvalid}</h2>
                <p>{text.verifyText}</p>
                <button type="button" className="button button-primary button-wide" onClick={() => { setVerificationState("idle"); window.history.replaceState({}, "", window.location.pathname); }}>{text.back}</button>
              </div>
            ) : mode === "register" ? (
              <>
                <span className="eyebrow">FLOW CLIENT PORTAL</span>
                <h2>{text.register}</h2>
                <p className="auth-description">{text.registerSub}</p>
                <form className="auth-form onboarding-form" onSubmit={action}>
                  <div className="form-grid-two">
                    <label className="field-label">{text.contact}<input name="fullName" required autoComplete="name" maxLength={140} placeholder="e.g. Mariam Hassan" /></label>
                    <label className="field-label">{text.company}<input name="companyName" required maxLength={180} placeholder="Your business name" /></label>
                  </div>
                  <div className="form-grid-two">
                    <label className="field-label">{text.email}<input name="email" type="email" required autoComplete="email" maxLength={254} placeholder="you@company.com" /></label>
                    <label className="field-label">{text.phone}<input name="phone" type="tel" maxLength={40} placeholder="+20 …" /></label>
                  </div>
                  <div className="form-grid-two">
                    <label className="field-label">{text.category}<input name="category" maxLength={120} placeholder="Home, beauty, electronics…" /></label>
                    <label className="field-label">{text.website}<input name="website" type="url" maxLength={300} placeholder="https://" /></label>
                  </div>
                  <label className="field-label">{text.business}<textarea name="description" rows={2} maxLength={3000} placeholder={text.businessPlaceholder} /></label>
                  <fieldset className="choice-field"><legend>{text.marketplaces}</legend><div className="choice-row">{marketplaceOptions.map((item) => <button key={item} type="button" className={`choice-chip ${marketplaces.includes(item) ? "selected" : ""}`} onClick={() => toggleChoice(item, marketplaces, setMarketplaces)}>{marketplaces.includes(item) && <Icon name="check" size={13} />}{item}</button>)}</div></fieldset>
                  <fieldset className="choice-field"><legend>{text.services}</legend><div className="choice-row">{serviceOptions.map(([key, label]) => <button key={key} type="button" className={`choice-chip ${services.includes(key) ? "selected" : ""}`} onClick={() => toggleChoice(key, services, setServices)}>{services.includes(key) && <Icon name="check" size={13} />}{rtl ? serviceLabels.get(key) : label}</button>)}</div></fieldset>
                  <div className="form-grid-two">
                    <label className="field-label">{text.quantity}<input name="monthlyProductEstimate" type="number" min="0" max="100000" step="1" placeholder="e.g. 50" /></label>
                    <label className="field-label">{text.language}<select name="preferredLanguage" defaultValue={language}><option value="en">English</option><option value="ar">العربية</option></select></label>
                  </div>
                  <label className="field-label">{text.requirements}<textarea name="additionalRequirements" rows={2} maxLength={3000} /></label>
                  <label className="field-label">{text.password}<div className="password-input-wrap"><input name="password" type={showPassword ? "text" : "password"} required minLength={12} autoComplete="new-password" placeholder={text.passwordHint} /><button type="button" className="password-toggle" onClick={() => setShowPassword((show) => !show)}>{showPassword ? "Hide" : "Show"}</button></div></label>
                  <p className="form-hint"><Icon name="shield" size={15} />{text.submitHint}</p>
                  {error && <div className="form-alert error-alert" role="alert">{error}</div>}
                  <button type="submit" className="button button-primary button-wide" disabled={busy}>{busy ? text.creating : text.submit}<Icon name="arrow" size={17} /></button>
                </form>
                <p className="auth-switch">{text.hasAccount} <button type="button" onClick={() => { setMode("login"); setError(""); }}>{text.loginLabel}</button></p>
              </>
            ) : mode === "forgot" ? (
              <>
                <span className="eyebrow">ACCOUNT ACCESS</span><h2>{text.forgotTitle}</h2><p className="auth-description">{text.forgotSub}</p>
                <form className="auth-form" onSubmit={action}><label className="field-label">{text.email}<input name="email" type="email" required autoComplete="email" /></label>{notice && <div className="form-alert success-alert">{notice}</div>}{error && <div className="form-alert error-alert">{error}</div>}<button type="submit" className="button button-primary button-wide" disabled={busy}>{busy ? "Sending…" : text.sendLink}<Icon name="arrow" size={17} /></button></form>
                <button type="button" className="text-button back-button" onClick={() => { setMode("login"); setNotice(""); setError(""); }}>{text.back}</button>
              </>
            ) : mode === "reset" ? (
              <>
                <span className="eyebrow">ACCOUNT ACCESS</span><h2>{text.resetTitle}</h2><p className="auth-description">{text.passwordHint}</p>
                <form className="auth-form" onSubmit={action}><label className="field-label">{text.password}<input name="password" type="password" required minLength={12} autoComplete="new-password" /></label>{notice && <div className="form-alert success-alert">{notice}</div>}{error && <div className="form-alert error-alert">{error}</div>}<button type="submit" className="button button-primary button-wide" disabled={busy}>{busy ? "Saving…" : text.resetButton}<Icon name="arrow" size={17} /></button></form>
                <button type="button" className="text-button back-button" onClick={() => { setMode("login"); setError(""); }}>{text.back}</button>
              </>
            ) : (
              <>
                <span className="eyebrow">FLOW CLIENT PORTAL</span>
                <h2>{text.loginTitle}</h2>
                <p className="auth-description">{text.signIn}</p>
                {notice && <div className="form-alert success-alert">{notice}</div>}
                <form className="auth-form" onSubmit={action}>
                  <label className="field-label">{text.email}<span className="input-icon-wrap"><Icon name="mail" size={16} /><input name="email" type="email" required autoComplete="email" placeholder="you@company.com" /></span></label>
                  <label className="field-label">{text.password}<div className="password-input-wrap"><input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="••••••••••••" /><button type="button" className="password-toggle" onClick={() => setShowPassword((show) => !show)}>{showPassword ? "Hide" : "Show"}</button></div></label>
                  <div className="auth-form-meta"><button type="button" className="text-button" onClick={() => { setMode("forgot"); setNotice(""); setError(""); }}>{text.forgot}</button></div>
                  {error && <div className="form-alert error-alert" role="alert">{error}</div>}
                  <button type="submit" className="button button-primary button-wide" disabled={busy}>{busy ? "Signing in…" : text.signInButton}<Icon name="arrow" size={17} /></button>
                </form>
                <div className="auth-divider"><span>{text.or}</span></div>
                <p className="auth-switch">{text.noAccount} <button type="button" onClick={() => { setMode("register"); setError(""); setNotice(""); }}>{text.apply}</button></p>
                <p className="auth-terms">{text.terms}</p>
              </>
            )}
          </div>
          <div className="auth-panel-mark"><Logo /><span>Trusted by sellers on Amazon, Noon, TikTok Shop & Shopify</span></div>
        </div>
        <footer className="auth-mobile-footer">© {new Date().getFullYear()} FLOW Agency · <a href="https://www.flow-agency-eg.com/" target="_blank" rel="noreferrer">Official website <Icon name="external" size={12} /></a></footer>
      </section>
    </main>
  );
}
