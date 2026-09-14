# ZOZ AI — Computer Session Quick Start

## هدف الجلسة
جلسة قصيرة لإغلاق أكبر قدر ممكن من متطلبات الاستقلالية. لا تحذف أو تعطل أي نظام موجود.

## 1) GitHub
```powershell
cd <PROJECT>
git status
git branch --show-current
git remote -v
git fetch origin
git pull --ff-only origin main
```
لا تستخدم reset أو force-push. إذا فشل pull انسخ الخطأ فقط.

## 2) اختبار المشروع
```powershell
npm install
npm test
node --check execution-engine.js
node --check api/execution.js
node --check api/execution-cycle.js
node --check server.js
```
لا تتجاوز أي فشل.

## 3) Vercel Environment Variables
يجب وجود الأسرار في Vercel فقط:
- DATABASE_URL أو ZOZ_DATABASE_URL
- CRON_SECRET
- EXECUTION_API_SECRET
- متطلبات Peach/WhatsApp الحالية
لا تطبع الأسرار ولا تضعها في GitHub.

## 4) Execution
تحقق من production endpoints:
- /api/execution
- /api/execution-cycle
المطلوب إثبات durable persistence وأن الحالة تبقى بعد restart.

مهم: execution-engine الحالي ينقل مراحل داخلية. لا يجوز اعتبار المهمة completed لمجرد وصول stage إلى follow_up. يجب وجود external execution proof وdeliverable فعلي.

## 5) WhatsApp / Peach
تحقق من:
1. credentials
2. WABA/business phone
3. approved template
4. outbound
5. inbound webhook
6. حفظ الرسائل في CRM/state
7. reply routing
8. duplicate protection
9. financial conversations = human approval
لا ترسل رسالة حقيقية إلا بإذن صريح وقت الاختبار.

## 6) Codex
يجب أن يستطيع قراءة repo وتعديله وتشغيل tests وcommit/push ومتابعة Vercel.

### Prompt جاهز لـ Codex
"أنت تعمل على zozaimanager2026-design/zoz-ai-control. لا تحذف أو تعطل أي نظام موجود. افحص المشروع أولاً ثم نفّذ أقل تغييرات لازمة. أصلح build/test/runtime blockers، ثبّت durable persistence، أمّن execution-cycle، امنع completed بدون external execution proof/deliverable، حافظ على financial approval gate، وجهّز adapters حقيقية للأدوات الخارجية بدل fake execution، وتحقق من WhatsApp/Peach دون إرسال حقيقي إلا بإذن صريح. شغّل كل الاختبارات. في النهاية أعطني DONE / BLOCKED / REQUIRED ENV / COMMANDS TO RUN. لا تضع أسراراً في الكود أو commit."

## 7) بعد كل تعديل
```powershell
git status
git diff --stat
npm test
git log -1 --oneline
```
ثم تحقق من deployment.

## Definition of Done
- production يعمل
- durable persistence=true
- execution API يعمل من الهاتف
- scheduled/triggered execution يعمل حسب خطة Vercel
- external tool adapters حقيقية وليست محاكاة
- quality check قبل delivery
- delivery/follow-up مسجلان
- WhatsApp outbound + inbound end-to-end
- financial approval gate لا يمكن تجاوزه
- كل الأنظمة القديمة باقية
