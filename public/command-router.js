(() => {
  const original = window.executeCommand;
  const normalize = value => String(value || '').trim().replace(/[؟?]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
  const findMainSection = terms => {
    try {
      const doc = document.getElementById('frame')?.contentDocument;
      if (!doc) return false;
      const heads = [...doc.querySelectorAll('section h2')];
      const h = heads.find(x => terms.some(t => normalize(x.textContent).includes(normalize(t))));
      if (h) { h.scrollIntoView({behavior:'smooth', block:'start'}); return true; }
    } catch (_) {}
    return false;
  };
  const frameCall = (name) => {
    try {
      const w = document.getElementById('frame')?.contentWindow;
      if (w && typeof w[name] === 'function') { w[name](); return true; }
    } catch (_) {}
    return false;
  };
  const say = text => {
    const el = document.getElementById('commandResult');
    if (el) el.textContent = text;
  };
  const openSocial = () => {
    const buttons = [...document.querySelectorAll('.bar button')];
    const b = buttons.find(x => normalize(x.textContent).includes('السوشيال'));
    if (b) { b.click(); return true; }
    return false;
  };
  const route = async raw => {
    const text = normalize(raw);
    if (!text) return true;
    if (/^(افتح|اذهب|انتقل).*(السوشيال|السوشيال ميديا|السوشياليات|السوشيال ميديا)/i.test(text) || /^(السوشيال|السوشيال ميديا)$/i.test(text)) {
      openSocial(); say('تم فتح مركز السوشيال داخل Mobile Control.'); return true;
    }
    if (/^(افتح|اذهب|انتقل).*(الادوات|الموصلات|الخدمات|التطبيقات)/i.test(text) || /^(الادوات|الموصلات|الخدمات|التطبيقات)$/i.test(text)) {
      if (findMainSection(['حاله الادوات'])) { say('تم فتح حالة الأدوات والموصلات.'); return true; }
    }
    if (/(تحقق|افحص|فحص).*(الموصلات|الادوات|الخدمات)/i.test(text)) {
      if (frameCall('verifyConnectors')) { say('بدأ فحص الموصلات والخدمات.'); return true; }
      if (findMainSection(['حاله الادوات'])) { say('تم فتح حالة الأدوات.'); return true; }
    }
    if (/^(افتح|اذهب|انتقل).*(التشغيل الذاتي|الاستقلاليه|دوره الاستقلاليه)/i.test(text) || /^(التشغيل الذاتي|الاستقلاليه)$/i.test(text)) {
      if (findMainSection(['التشغيل الذاتي'])) { say('تم فتح التشغيل الذاتي.'); return true; }
    }
    if (/(فحص|افحص|تحقق).*(النظام|الحاله|الجاهزيه)/i.test(text)) {
      if (frameCall('checkReadiness')) { say('تم فحص جاهزية النظام.'); return true; }
      if (frameCall('checkHealth')) { say('تم فحص النظام.'); return true; }
    }
    if (/^(افتح|اذهب|انتقل).*(العوائق|المشاكل|المعوقات)/i.test(text)) {
      const b = [...document.querySelectorAll('.bar button')].find(x => normalize(x.textContent).includes('العوائق'));
      if (b) { b.click(); say('تم فتح العوائق والخطوة التالية.'); return true; }
    }
    if (/^(افتح|اذهب|انتقل).*(الموافقات|المهام)/i.test(text) || /(اعرض|اظهر|عرض).*(الموافقات|المهام)/i.test(text)) {
      const panel = document.getElementById('approvalPanel');
      if (panel) { panel.style.display='block'; if (typeof window.loadApprovals === 'function') await window.loadApprovals(); say('تم فتح مركز الموافقات والمهام.'); return true; }
    }
    if (/(انشر|نشر|اداره النشر|ادارة النشر|رفع محتوى)/i.test(text) && /(سوشيال|تيك توك|يوتيوب|انستجرام|انستغرام|محتوى)/i.test(text)) {
      openSocial(); if (typeof window.openUploadPost === 'function') window.openUploadPost(); else say('تم فتح مركز السوشيال.'); return true;
    }
    if (/(واتساب|whatsapp)/i.test(text)) {
      if (findMainSection(['حاله الادوات'])) { say('تم فتح حالة الأدوات؛ WhatsApp ما زال موصلاً كعائق إعداد وليس تنفيذاً مباشراً.'); return true; }
    }
    if (/(جيت هاب|github|فيرسل|vercel|لينكدان|linkedin|شوبيفاي|shopify|يوتيوب|youtube|تيك توك|tiktok|انستجرام|instagram)/i.test(text)) {
      if (findMainSection(['حاله الادوات'])) { say('تم فتح حالة الأدوات والخدمات المرتبطة.'); return true; }
    }
    if (/(ابحث|بحث).*(مشترين|عملاء|فرص)/i.test(text)) {
      const b = [...document.querySelectorAll('.bar button')].find(x => normalize(x.textContent).includes('العملاء'));
      if (b) { b.click(); say('تم فتح مسار العملاء. البحث الخارجي يحتاج محرك بحث/موصل متصل؛ لن يتم اختلاق نتائج.'); return true; }
    }
    return false;
  };
  window.executeCommand = async function(raw) {
    if (await route(raw)) return;
    if (typeof original === 'function') return original(raw);
  };
})();
