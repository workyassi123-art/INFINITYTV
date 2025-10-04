/* ===== Merchant contact (EDIT THESE) ===== */
const ADMIN_PHONE = '+212600000000';
const ADMIN_EMAIL = 'sales@yourdomain.com';

/* ========= Smooth anchors with sticky header offset ========= */
function setupSmoothAnchors() {
  const header = document.querySelector('header');
  const headerH = () => (header ? header.getBoundingClientRect().height : 0);

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY - headerH() - 6;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  const setScrollMargins = () => {
    const m = headerH() + 8;
    document.querySelectorAll('section').forEach(s => (s.style.scrollMarginTop = `${m}px`));
  };
  setScrollMargins();
  window.addEventListener('resize', setScrollMargins);
}

/* ========= FAQ accordion (auto height, one open at a time) ========= */
/* ========= FAQ accordion (no clipping, auto height) ========= */
function setupFAQ() {
  const list = document.querySelector('#faq .faq-list');
  if (!list) return;

  // initialize: all closed
  list.querySelectorAll('.faq-item').forEach(item => {
    const a = item.querySelector('.faq-a');
    item.classList.remove('open');
    item.querySelector('.faq-q')?.setAttribute('aria-expanded', 'false');
    if (a) {
      a.style.maxHeight = '0px';
      a.style.overflow = 'hidden';
    }
  });

  // open/close helper with transition safety
  const openItem = (item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    if (!a) return;

    item.classList.add('open');
    q?.setAttribute('aria-expanded', 'true');

    // first set to exact height for animation
    a.style.maxHeight = a.scrollHeight + 'px';

    // after the transition ends, set to none so it can grow with content
    const onEnd = () => {
      if (item.classList.contains('open')) {
        a.style.maxHeight = 'none';
      }
      a.removeEventListener('transitionend', onEnd);
    };
    a.addEventListener('transitionend', onEnd, { once: true });
  };

  const closeItem = (item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    if (!a) return;

    // if it was 'none', fix current height first to enable animation
    if (getComputedStyle(a).maxHeight === 'none') {
      a.style.maxHeight = a.scrollHeight + 'px';
      // force reflow
      a.getBoundingClientRect();
    }
    item.classList.remove('open');
    q?.setAttribute('aria-expanded', 'false');
    a.style.maxHeight = '0px';
  };

  // delegated click
  list.addEventListener('click', (e) => {
    const q = e.target.closest('.faq-q');
    if (!q || !list.contains(q)) return;

    const item = q.closest('.faq-item');
    const isOpen = item.classList.contains('open');

    // close others
    list.querySelectorAll('.faq-item.open').forEach(closeItem);

    // open this one if it wasn't open
    if (!isOpen) openItem(item);
  });

  // keyboard support
  list.querySelectorAll('.faq-q').forEach(q => {
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q.click(); }
    });
  });

  // on resize: recalc heights for currently open items
  window.addEventListener('resize', () => {
    list.querySelectorAll('.faq-item.open .faq-a').forEach(a => {
      a.style.maxHeight = 'none';          // allow it to grow/shrink naturally
      // Immediately set to none; if you prefer to animate on resize, comment the line above
    });
  });
}


/* ========= Order Modal + Firestore ========= */
function setupOrderModal() {
  const modal = document.getElementById('order-modal');
  if (!modal) return;

  const form       = modal.querySelector('#order-form');
  const planInput  = modal.querySelector('#order-plan');
  const nameInput  = modal.querySelector('#order-name');
  const emailInput = modal.querySelector('#order-email');
  const phoneInput = modal.querySelector('#order-phone');
  const countryInput = modal.querySelector('#order-country');   // ✅ NEW
  const appSelect  = modal.querySelector('#order-app');

  const openModal = (planText) => {
    if (planText && planInput) planInput.value = planText;
    modal.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    nameInput?.focus();
  };
  const closeModal = () => {
    modal.classList.remove('open');
    document.documentElement.style.overflow = '';
  };

  // open from .plan-cta (cards) or any [data-plan] (hero Free Trial)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.plan-cta, [data-plan]');
    if (!btn) return;
    if (btn.tagName === 'A') e.preventDefault();

    const plan =
      btn.closest('.plan-card')?.querySelector('.plan-title')?.textContent?.trim()
      || btn.dataset.plan
      || btn.textContent?.trim()
      || '';

    openModal(plan);
  });

  // close: X / Cancel / backdrop / Esc
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('.modal-close')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  // submit → Firestore 'orders'
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!nameInput.value.trim() || !emailInput.value.trim()) {
        alert('Please enter your name and email.');
        return;
      }
      if (!countryInput.value.trim()) {       // ✅ optional: enforce country
        alert('Please enter your country.');
        return;
      }

      const order = {
        plan:    planInput.value.trim(),
        name:    nameInput.value.trim(),
        email:   emailInput.value.trim(),
        phone:  (phoneInput.value || '').trim(),
        country:(countryInput.value || '').trim(),   // ✅ NEW
        app:     appSelect.value,
        createdAt: window._fb?.serverTimestamp ? window._fb.serverTimestamp() : new Date()
      };

      try {
        if (!window._fb || !window._fb.db) {
          console.error('Firebase not initialized. window._fb =', window._fb);
          alert('Server not connected (Firebase not initialized).');
          return;
        }

        await window._fb.addDoc(
          window._fb.collection(window._fb.db, 'orders'),
          order
        );

        alert('✅ Order saved! We will contact you soon.');
        form.reset();
        closeModal();
      } catch (err) {
        console.error('Firestore error (orders):', err);
        alert(`❌ ${err.code || 'error'} — ${err.message || 'Error saving order.'}`);
      }
    }, { capture: true });
  }
}


/* ========= Contact forms → Firestore 'contact' ========= */
function setupContactForms() {
  const forms = document.querySelectorAll('form#contact-form, form[data-fb-collection="contact"]');
  forms.forEach(form => {
    if (form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    // inputs inside this form (IDs optional)
    const emailEl = form.querySelector('input[type="email"], input[name="email"], #contact-email');
    const msgEl   = form.querySelector('textarea, [name="message"], #contact-message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();

      const email   = (emailEl?.value || '').trim();
      const message = (msgEl?.value || '').trim();
      if (!email || !message) { alert('Please fill in both fields.'); return; }

      try {
        if (!window._fb || !window._fb.db) {
          console.error('Firebase not initialized. window._fb =', window._fb);
          alert('Server not connected (Firebase not initialized).');
          return;
        }

        await window._fb.addDoc(
          window._fb.collection(window._fb.db, 'contact'),
          { email, message, createdAt: window._fb.serverTimestamp() }
        );

        alert('✅ Your message has been sent!');
        form.reset();
      } catch (err) {
        console.error('Firestore error (contact):', err);
        alert(`❌ ${err.code || 'error'} — ${err.message || 'Something went wrong.'}`);
      }
    }, { capture: true });
  });
}

/* ========= Stat counters ========= */
function setupStatCounters() {
  const counters = document.querySelectorAll('.stat-num[data-target]');
  if (!counters.length) return;

  const format = (n, locale) => new Intl.NumberFormat(locale || 'fr-FR').format(n);
  const animate = (el) => {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    const target   = parseFloat(el.dataset.target || '0');
    const duration = parseInt(el.dataset.duration || '1200', 10);
    const prefix   = el.dataset.prefix || '';
    const suffix   = el.dataset.suffix || '';
    const locale   = el.dataset.locale || 'fr-FR';
    const startTs  = performance.now();
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

    function tick(now) {
      const t = Math.min(1, (now - startTs) / duration);
      const eased = easeOutCubic(t);
      const value = Math.floor(target * eased);
      el.textContent = prefix + format(value, locale) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(c => io.observe(c));
  } else {
    counters.forEach(animate);
  }
}

/* ========= Ticker clone (seamless loop) ========= */
function setupTicker() {
  document.querySelectorAll('.logo-ticker .ticker-viewport').forEach(view => {
    const track = view.querySelector('.ticker-track');
    if (!track) return;
    if (view.querySelector('.ticker-track.clone')) return;
    const clone = track.cloneNode(true);
    clone.classList.add('clone');
    view.appendChild(clone);
  });
}

/* ========= Channels demo loader ========= */
async function setupChannels(){
  const WORKER_URL = "https://tvplus-channels.<ton-sous-domaine>.workers.dev/"; // replace
  const grid = document.getElementById('ch-grid');
  const tags = document.getElementById('ch-tags');
  const input = document.getElementById('ch-search');
  if(!grid || !tags || !input) return;

  grid.setAttribute('aria-busy','true');
  let items = [];
  try{
    const r = await fetch(WORKER_URL, {cache:'no-store'});
    const p = await r.json();
    items = (p.items||[]).map(x=>({region:x.region,title:x.title}));
  }catch(e){
    items = [
      {region:"EU",title:"FRANCE SPORTS"}, {region:"UK",title:"SKY SPORTS"},
      {region:"US",title:"US NEWS"}, {region:"AR",title:"BEIN SPORTS 4K"}
    ];
  }

  const regions = ["All", ...Array.from(new Set(items.map(i=>i.region))).sort()];
  let state = {q:"", region:"All"};

  tags.innerHTML = regions.map(r =>
    `<button class="tag" role="tab" aria-selected="${r==='All'}" data-r="${r}">${r}</button>`
  ).join("");

  tags.addEventListener('click', e=>{
    const b = e.target.closest('.tag'); if(!b) return;
    state.region = b.dataset.r;
    tags.querySelectorAll('.tag').forEach(t=>t.setAttribute('aria-selected', t===b));
    render();
  });
  input.addEventListener('input', ()=>{ state.q = input.value.toLowerCase().trim(); render(); });

  function render(){
    const list = items
      .filter(x => state.region==="All" || x.region===state.region)
      .filter(x => !state.q || x.title.toLowerCase().includes(state.q))
      .sort((a,b)=>a.title.localeCompare(b.title));

    grid.innerHTML = list.map(x => `
      <li class="ch-card">
        <div class="ch-name">${x.title}</div>
        <div class="ch-card-bottom"><span class="ch-cat">${x.region}</span></div>
      </li>`).join("");
    grid.setAttribute('aria-busy','false');
  }
  render();
}

/* ========= WhatsApp FAB ========= */
function setupWhatsAppFAB(){
  if(document.querySelector('.fab-whatsapp')) return;
  const a = document.createElement('a');
  const PHONE = '+212600000000'; // replace
  a.href = `https://wa.me/${PHONE.replace(/\D/g,'')}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.className = 'fab-whatsapp';
  a.ariaLabel = 'Contact us on WhatsApp';
  a.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0012.06 0C5.5 0 .2 5.3.2 11.86a11.8 11.8 0 001.62 6.02L0 24l6.3-1.64a11.91 11.91 0 005.76 1.48h.01c6.56 0 11.86-5.3 11.86-11.86 0-3.17-1.24-6.15-3.41-8.5zM12.06 21.4h-.01a9.5 9.5 0 01-4.84-1.31l-.35-.2-3.74.97 1-3.64-.23-.37a9.5 9.5 0 01-1.46-5.01c0-5.24 4.26-9.5 9.5-9.5 2.54 0 4.92.99 6.72 2.8A9.43 9.43 0 0121.56 12c0 5.24-4.26 9.4-9.5 9.4zm5.46-7.07c-.3-.16-1.76-.87-2.03-.96-.27-.1-.47-.16-.66.15-.2.31-.76.96-.93 1.16-.17.19-.35.22-.66.08-.3-.15-1.27-.47-2.42-1.5a9.04 9.04 0 01-1.67-2.07c-.17-.31-.02-.48.13-.64.14-.14.31-.35.47-.53.16-.19.21-.31.3-.52.1-.2.05-.39-.02-.55-.08-.16-.66-1.6-.9-2.2-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.52.08-.8.39-.27.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.13 3.25 5.17 4.55.72.31 1.28.49 1.72.62.72.23 1.38.2 1.9.12.58-.09 1.76-.72 2-1.42.25-.7.25-1.3.17-1.42-.08-.13-.27-.2-.56-.35z"/></svg>`;
  document.body.appendChild(a);
}

/* ========= Back to top ========= */
function setupBackToTop(){
  if(document.querySelector('.back-to-top')) return;
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5l-7 7h4v7h6v-7h4z"/></svg>';
  btn.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
  document.body.appendChild(btn);
  const toggle = () => btn.classList.toggle('show', window.scrollY > 400);
  window.addEventListener('scroll', toggle, {passive:true});
  toggle();
}

/* ========= Cookie banner ========= */
function setupCookieBanner(){
  if(localStorage.getItem('cookieConsent')) return;
  const wrap = document.createElement('div');
  wrap.className = 'cookie-banner';
  wrap.innerHTML = `
    <p>Nous utilisons des cookies pour améliorer votre expérience. En cliquant «&nbsp;Accepter&nbsp;», vous consentez.</p>
    <div class="cookie-actions">
      <button class="cookie-decline" type="button">Refuser</button>
      <button class="cookie-accept" type="button">Accepter</button>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('.cookie-accept').addEventListener('click', ()=>{
    localStorage.setItem('cookieConsent','1');
    wrap.remove();
  });
  wrap.querySelector('.cookie-decline').addEventListener('click', ()=> wrap.remove());
}

/* ========= Start at top on refresh ========= */
if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }
window.addEventListener('load', () => window.scrollTo(0, 0));
window.addEventListener('pageshow', (e) => { if (e.persisted) window.scrollTo(0, 0); });

/* ========= Init ========= */
document.addEventListener('DOMContentLoaded', () => {
  setupSmoothAnchors();
  setupFAQ();
  setupOrderModal();
  setupContactForms();
  setupStatCounters();
  setupTicker();
  setupChannels();
  setupWhatsAppFAB();
  setupBackToTop();
  setupCookieBanner();
});

    document.getElementById('contact-form').addEventListener('submit', function(e) {
      e.preventDefault();
      alert('Merci pour votre message ! Nous vous répondrons bientôt.');
      this.reset();
    });