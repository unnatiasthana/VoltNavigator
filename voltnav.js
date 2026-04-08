/* ================================================
   voltnav.js
   VoltNavigator — Shared Page Scripts
   ------------------------------------------------
   Reusable across all pages. Include with:
     <script src="voltnav.js" defer></script>

   Public helpers (usable from any page / script):
     toast(msg, type)   — show a toast notification
                          type: '' | 'ok' | 'bad'

   Auto-initialises (only when elements exist):
     · Tab switching (login ↔ sign up)
     · Greeting swap animation
     · Password strength meter + match checker
     · Login form validation
     · Sign-up form validation
     · Forgot-password handler
     · Charge-bar counter animation
================================================ */

/* ── Utility: safe element getter ── */
function $id(id) { return document.getElementById(id); }

/* ─────────────────────────────────────────────
   TOAST  (works on every page)
───────────────────────────────────────────── */
let _toastTimer;
window.toast = function toast(msg, type = '') {
  const el = $id('notification-toast');
  if (!el) return;
  el.innerHTML = msg;
  el.className = 'toast show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
};

/* ─────────────────────────────────────────────
   AUTH PAGE — only runs if the auth card exists
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {

  /* ── Tab switching + greeting swap ── */
  const tLogin  = $id('tab-login');
  const tSignup = $id('tab-signup');
  const pill    = $id('tab-active-indicator');
  const track   = $id('forms-slider');
  const gtitle  = $id('greeting-title');
  const gsub    = $id('greeting-subtitle');

  if (tLogin && tSignup && pill && track) {
    const greetings = {
      login:  ['Welcome back 👋',    "Good to see you. Let's get you moving."],
      signup: ['Join the journey 🌱', 'Takes about 30 seconds. Really.'],
    };

    if (gtitle) { gtitle.style.transition = 'opacity 0.2s ease'; }
    if (gsub)   { gsub.style.transition   = 'opacity 0.2s ease'; }

    function switchTab(toSignup) {
      pill.classList.toggle('right', toSignup);
      track.classList.toggle('slide', toSignup);
      tLogin.classList.toggle('active', !toSignup);
      tSignup.classList.toggle('active', toSignup);
      tLogin.setAttribute('aria-selected', String(!toSignup));
      tSignup.setAttribute('aria-selected', String(toSignup));

      if (gtitle && gsub) {
        const [t, s] = toSignup ? greetings.signup : greetings.login;
        gtitle.style.opacity = '0';
        gsub.style.opacity   = '0';
        setTimeout(() => {
          gtitle.textContent   = t;
          gsub.textContent     = s;
          gtitle.style.opacity = '1';
          gsub.style.opacity   = '1';
        }, 190);
      }
    }

    tLogin.addEventListener('click',  () => switchTab(false));
    tSignup.addEventListener('click', () => switchTab(true));
  }

  /* ── Password strength ── */
  const sPass = $id('create-password');
  const sConf = $id('confirm-password');
  const shint = $id('password-strength-hint');
  const mhint = $id('password-match-hint');
  const segs  = ['strength-bar-1','strength-bar-2','strength-bar-3','strength-bar-4'].map(id => $id(id)).filter(Boolean);

  const hintMsgs = [
    'Use 8+ characters, a number, and a symbol',
    'Almost there — add a capital letter or number',
    'Getting warmer! Try adding a symbol like ! or @',
    "Nice — just one more character type and you're solid",
    'Great password! 💪',
  ];

  function score(pw) {
    let s = 0;
    if (pw.length >= 8)           s++;
    if (/[A-Z]/.test(pw))         s++;
    if (/[0-9]/.test(pw))         s++;
    if (/[^A-Za-z0-9]/.test(pw))  s++;
    return s;
  }

  function checkMatch() {
    if (!sConf || !sPass) return;
    if (!sConf.value) {
      if (mhint) { mhint.textContent = ''; mhint.className = 'fhint'; }
      return;
    }
    if (sConf.value === sPass.value) {
      if (mhint) { mhint.textContent = 'Passwords match ✓'; mhint.className = 'fhint ok'; }
    } else {
      if (mhint) { mhint.textContent = "These don't match yet"; mhint.className = 'fhint bad'; }
    }
  }

  if (sPass) {
    sPass.addEventListener('input', () => {
      const sc  = score(sPass.value);
      const cls = sc <= 1 ? 'w' : sc <= 3 ? 'm' : 's';
      segs.forEach((seg, i) => { seg.className = 'strength-segment' + (i < sc ? ' ' + cls : ''); });
      if (shint) {
        shint.textContent = sPass.value.length ? hintMsgs[sc] : hintMsgs[0];
        shint.className   = 'fhint' + (sc >= 3 ? ' ok' : '');
      }
      checkMatch();
    });
  }
  if (sConf) sConf.addEventListener('input', checkMatch);

  /* ── Login form ── */
  const fLogin = $id('login-form');
  if (fLogin) {
    fLogin.addEventListener('submit', e => {
      e.preventDefault();
      const email = ($id('login-email')?.value || '').trim();
      const pass  = $id('login-password')?.value || '';
      if (!email || !pass)                            { toast("Hey — don't forget both fields 😊", 'bad'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("That email doesn't look right 🤔",   'bad'); return; }
      toast('On it… just a sec ⚡');
      setTimeout(() => toast("You're in! Welcome back 🎉", 'ok'), 1500);
    });
  }

  /* ── Sign-up form ── */
  const fSignup = $id('signup-form');
  if (fSignup) {
    fSignup.addEventListener('submit', e => {
      e.preventDefault();
      const name  = ($id('your-name')?.value  || '').trim();
      const email = ($id('signup-email')?.value || '').trim();
      const pass  = $id('create-password')?.value || '';
      const conf  = $id('confirm-password')?.value || '';
      if (!name || !email || !pass || !conf)          { toast("Just a couple more fields to fill in 😊",       'bad'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("That email doesn't look quite right 🤔",        'bad'); return; }
      if (score(pass) < 2)                            { toast("Your password could use a bit more strength 💪", 'bad'); return; }
      if (pass !== conf)                              { toast("Oops — the passwords don't match yet 🙈",       'bad'); return; }
      toast('Creating your account… ⚡');
      setTimeout(() => toast(`Welcome to VoltNavigator, ${name}! 🎉`, 'ok'), 1600);
    });
  }

  /* ── Forgot password ── */
  const forgotLink = $id('forgot-password-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', e => {
      e.preventDefault();
      toast("If that email's with us, a reset link is on its way 📬");
    });
  }

  /* ── Charge-bar counter animation ── */
  const pctEl = $id('network-live-percent');
  if (pctEl) {
    const T0     = performance.now() + 1100;
    const DUR    = 3800;
    const TARGET = 78;
    (function tick(now) {
      if (now < T0) { requestAnimationFrame(tick); return; }
      const p = Math.min((now - T0) / DUR, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      pctEl.textContent = Math.round(eased * TARGET) + '%';
      if (p < 1) requestAnimationFrame(tick);
    })(performance.now());
  }

}); // end DOMContentLoaded
