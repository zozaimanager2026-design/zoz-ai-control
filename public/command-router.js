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
      ['blockers',['العوائق','المعوقات','المشاكل','الواقف','متوقف','متعطل','جاهزية','الجاهزية','ما الذي يمنع','ايه اللي واقف']],
      ['approvals',['الموافقات','الموافقة','المهام المعلقة','طلبات الموافقة','الاعتمادات']],
      ['orders',['الطلبات','طلب','طلبات','متابعة الطلبات','طلبات محتاجة متابعة','التنفيذ','التسليم']],
      ['leads',['العملاء','العملاء الجدد','المشترين','عميل','عملاء','فرص','فرصة بيع','فرص البيع','ليد','leads']],
      ['system',['النظام','حالة النظام','وضع النظام','التشغيل الذاتي','الاستقلالية','الجاهزية','الحالة العامة','العمليات']],
      ['content',['المحتوى','نشر','انشر','النشر','بوست','فيديو','منشور']],
      ['finance',['الفلوس','المال','الدفع','تحويل','مصاريف','تكلفة','هامش الربح','الربح','الموافقة المالية']],
      ['delivery',['التوصيل','الشحن','شركة الشحن','مندوب','التسليم']]
    ];
    let best={domain:'unknown',score:0};
    for(const [d,terms] of domains){const s=score(text,terms); if(s>best.score) best={domain:d,score:s};}
    let action='understand';
    if (/(انشر|نشر|رفع|نزله|نزّل|انزل|اعمل منشور)/.test(text)) action='publish';
    else if (/(دور|ابحث|هات|عايز|اريد|اعرف|معرفه|معرفة|وضع|حال|ايه|ما هو|شوف|تابع|متابعه|متابعة|اعرض|وريني)/.test(text)) action='query';
    else if (/(نفذ|شغل|شغّل|ابدأ|اعمل|اعملها|جهز)/.test(text)) action='execute';
    else if (/(وافق|موافقه|موافقة|اعتماد)/.test(text)) action='approve';
    return {domain:best.domain, action, confidence:best.score ? Math.min(1, .55 + best.score*.15) : 0};
  };
  const route = async raw => {
    const i = interpret(raw), t = normalize(raw);
    if (!t) return true;
    if (i.domain === 'social' || i.domain === 'content') {
      view('social');
      if (i.action === 'publish' && typeof window.openUploadPost === 'function') window.openUploadPost();
      say(i.action === 'publish' ? 'فهمت الهدف: مسار المحتوى والنشر.' : 'فهمت الهدف: مركز السوشيال والمحتوى.');
      return true;
    }
    if (i.domain === 'apps') { view('apps'); if (typeof window.loadApps === 'function') await window.loadApps(); say('فهمت الهدف: التطبيقات والخدمات والموصلات.'); return true; }
    if (i.domain === 'blockers') { view('blockers'); if (typeof window.loadReadiness === 'function') await window.loadReadiness(); say('فهمت الهدف: العوائق والجاهزية والخطوة التالية.'); return true; }
    if (i.domain === 'approvals' || i.domain === 'finance') { view('approvals'); if (typeof window.loadApprovals === 'function') await window.loadApprovals(); say(i.domain === 'finance' ? 'فهمت الهدف: الحالة المالية والموافقات. أي دفع أو شراء أو تحويل يظل بقرارك.' : 'فهمت الهدف: الموافقات والمهام المعلقة.'); return true; }
    if (i.domain === 'orders' || i.domain === 'delivery') { view('orders'); if (typeof window.loadOrders === 'function') await window.loadOrders(); say(i.domain === 'delivery' ? 'فهمت الهدف: الطلبات والتوصيل والتسليم.' : 'فهمت الهدف: الطلبات والمتابعة والتنفيذ.'); return true; }
    if (i.domain === 'leads') { view('leads'); if (typeof window.loadLeads === 'function') await window.loadLeads(); say('فهمت الهدف: العملاء والمشترين وفرص البيع.'); return true; }
    if (i.domain === 'system') { view('home'); if (typeof window.loadReadiness === 'function') await window.loadReadiness(); say('فهمت الهدف: الحالة العامة للنظام والجاهزية.'); return true; }
    if (i.confidence === 0) { say('فهمت الطلب جزئياً. سأختار المسار من الهدف نفسه، وليس من كلمة أمر محددة. اكتب ما تريد الوصول إليه بطريقتك.'); return true; }
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
