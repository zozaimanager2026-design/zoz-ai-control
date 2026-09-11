(() => {
  const normalize = value => String(value || '').trim().toLowerCase().replace(/[؟?]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
  const say = text => { const el = document.getElementById('commandResult'); if (el) el.textContent = text; };
  const view = id => { if (typeof window.showView === 'function') window.showView(id); else { document.querySelectorAll('.view').forEach(x => x.classList.remove('active')); document.getElementById(id)?.classList.add('active'); } };
  const score = (text, terms) => terms.reduce((n, t) => n + (text.includes(normalize(t)) ? 1 : 0), 0);
  const interpret = raw => {
    const text = normalize(raw);
    if (!text) return {domain:'unknown', action:'unknown', confidence:0};
    const domains = [
      ['social',['السوشيال','السوشيال ميديا','يوتيوب','youtube','تيك توك','tiktok','انستجرام','انستغرام','instagram','فيسبوك','facebook','لينكدان','linkedin']],
      ['apps',['التطبيقات','الادوات','الموصلات','الخدمات','github','جيت هاب','vercel','فيرسل','shopify','شوبيفاي','whatsapp','واتساب']],
      ['blockers',['العوائق','المعوقات','المشاكل','الواقف','متوقف','متعطل','جاهزية','الجاهزية']],
      ['approvals',['الموافقات','الموافقة','المهام المعلقة','طلبات الموافقة']],
      ['orders',['الطلبات','طلب','طلبات','متابعة الطلبات','طلبات محتاجة متابعة']],
      ['leads',['العملاء','العملاء الجدد','المشترين','عميل','عملاء','فرص','فرصة بيع','فرص البيع']],
      ['system',['النظام','حالة النظام','وضع النظام','التشغيل الذاتي','الاستقلالية','الجاهزية']],
      ['content',['المحتوى','نشر','انشر','النشر','بوست','فيديو']]
    ];
    let best={domain:'unknown',score:0}; for(const [d,terms] of domains){const s=score(text,terms); if(s>best.score) best={domain:d,score:s};}
    let action='understand';
    if (/(انشر|نشر|رفع|نزّل|نزله|نزّل المحتوى)/.test(text)) action='publish';
    else if (/(دور|ابحث|هات|عايز|اريد|أريد|اعرف|معرفه|معرفة|وضع|حال|ايه|ما هو|شوف|شوفلي|تابع|متابعه|متابعة)/.test(text)) action='query';
    else if (/(نفذ|شغل|شغّل|ابدأ|اعمل|اعملها)/.test(text)) action='execute';
    else if (/(وافق|موافقه|موافقة|اعتماد)/.test(text)) action='approve';
    return {domain:best.domain, action, confidence:best.score ? Math.min(1, .55 + best.score*.18) : 0};
  };
  const route = async raw => {
    const i = interpret(raw), t = normalize(raw);
    if (!t) return true;
    if (i.domain === 'social' || i.domain === 'content') {
      view('social');
      if (i.action === 'publish' && typeof window.openUploadPost === 'function') window.openUploadPost();
      say(i.action === 'publish' ? 'فهمت أنك تريد تنفيذ محتوى؛ فتحت مسار النشر المناسب.' : 'فهمت أنك تريد التعامل مع السوشيال؛ فتحت مركز السوشيال المناسب.');
      return true;
    }
    if (i.domain === 'apps') { view('apps'); if (typeof window.loadApps === 'function') await window.loadApps(); say('فهمت أنك تريد التعامل مع التطبيقات والخدمات؛ عرضت الحالة المناسبة.'); return true; }
    if (i.domain === 'blockers') { view('blockers'); if (typeof window.loadReadiness === 'function') await window.loadReadiness(); say('فهمت أنك تريد معرفة ما الذي يوقف النظام؛ عرضت العوائق والخطوة التالية.'); return true; }
    if (i.domain === 'approvals') { view('approvals'); if (typeof window.loadApprovals === 'function') await window.loadApprovals(); say('فهمت أنك تريد معرفة الموافقات والمهام؛ عرضتها لك.'); return true; }
    if (i.domain === 'orders') { view('orders'); if (typeof window.loadOrders === 'function') await window.loadOrders(); say(i.action === 'query' ? 'فهمت أنك تريد معرفة وضع الطلبات؛ عرضتها لك.' : 'فهمت أنك تريد التعامل مع الطلبات؛ فتحت مسار الطلبات.'); return true; }
    if (i.domain === 'leads') { view('leads'); if (typeof window.loadLeads === 'function') await window.loadLeads(); say(i.action === 'query' ? 'فهمت أنك تريد العملاء أو فرص البيع؛ عرضت المسار المناسب.' : 'فهمت الهدف وفتحت مسار العملاء والفرص.'); return true; }
    if (i.domain === 'system') { view('home'); if (typeof window.loadReadiness === 'function') await window.loadReadiness(); say('فهمت أنك تريد معرفة وضع النظام؛ فحصت الجاهزية والحالة.'); return true; }
    if (i.confidence === 0) { say('فهمت الطلب جزئياً، لكن لا أريد اختيار مسار خاطئ. قل لي الهدف أو الشيء الذي تريد التعامل معه وسأختار الطريق المناسب.'); return true; }
    return false;
  };
  window.zozInterpretIntent = interpret;
  window.zozRouteCommand = route;
  const install = () => {
    const send = document.getElementById('sendBtn'), input = document.getElementById('commandInput'), mic = document.getElementById('micBtn');
    if (!send || !input) return;
    send.onclick = () => route(input.value);
    input.onkeydown = e => { if (e.key === 'Enter') route(input.value); };
    if (mic) mic.onclick = () => { const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){say('الأوامر الصوتية غير مدعومة في هذا المتصفح. استخدم الكتابة.');return;} const r=new SR(); r.lang='ar-EG'; r.interimResults=false; r.onstart=()=>say('أستمع… قل هدفك بطريقتك.'); r.onerror=()=>say('تعذر التقاط الصوت؛ جرّب مرة أخرى.'); r.onresult=e=>{const text=e.results[0][0].transcript; input.value=text; route(text);}; r.start(); };
    window.executeCommand = route;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
})();
