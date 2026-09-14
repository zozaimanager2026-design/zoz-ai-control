# ZOZ AI — System Health, Diagnostics & Self-Repair

## الهدف
إضافة طبقة صيانة تشغيلية مستمرة داخل ZOZ AI لمراقبة الأدوات والملفات والمهام والاتصالات، اكتشاف الأعطال، تحليل السبب المحتمل، اقتراح الإصلاح، تنفيذ الإصلاحات الآمنة تلقائيًا، ثم إعادة الاختبار والتأكد من التعافي.

## المبدأ
Health → Detect → Diagnose → Repair safely → Verify → Recover → Learn.

لا يكفي تغيير حالة النظام إلى healthy. يجب أن يكون هناك فحص/دليل جديد بعد الإصلاح.

## المكونات الرئيسية للمراقبة
- GitHub: auth/read/write
- Vercel: deployment/runtime
- Database: connection/persistence
- Execution Engine: runtime/queue/proof
- WhatsApp: credentials/outbound/inbound/webhook
- Peach: credentials/api/template
- Codex: access/workspace/tests
- Automation: trigger/cycle
- File System: read/write/integrity

## حالات النظام
unknown / healthy / degraded / blocked / failed / recovering

## تحليل الأعطال
يتم تصنيف الأعطال إلى:
- transient
- authentication
- missing_resource
- code_or_build
- database
- messaging
- filesystem
- unknown

## الإصلاح الذاتي
الإصلاح التلقائي مسموح فقط للإجراءات الآمنة المسجلة في `SAFE_AUTO_REPAIR` وبعد وجود incident معروف. بعد كل إصلاح يجب إعادة الفحص.

أمثلة الإصلاح الآمن:
- retry transient check
- requeue safe failed task
- rebuild runtime cache
- recreate temporary directory
- restore non-secret configuration from a known schema

## ممنوع الإصلاح الذاتي
لا يجوز للنظام تلقائيًا:
- حذف بيانات المستخدم
- إسقاط قاعدة البيانات
- force push
- تعطيل الحماية
- تغيير بيانات اعتماد أو تدوير أسرار
- شراء خدمة أو تغيير فوترة
- إرسال/تحويل/سحب أموال
- تنفيذ أي التزام مالي

هذه الحالات تتحول إلى `human_action_required`.

## قاعدة المهام
إذا تعطلت مهمة عمل، يجب ربط العطل بـ taskId إن وجد، إنشاء incident، محاولة الإصلاح الآمن، ثم إعادة التحقق قبل إعادة المهمة للطابور.

لا تعتبر المهمة مكتملة بسبب إصلاح داخلي فقط. يجب أن يظل شرط `external execution proof/deliverable` من Execution Engine قائمًا.

## المطلوب في جلسة الكمبيوتر
1. إضافة `system-health-engine.js` إلى runtime.
2. إضافة persistence لحالة health/incidents/repair history.
3. إنشاء endpoint آمن لفحص health.
4. إنشاء endpoint آمن لتشغيل repair cycle.
5. ربط health cycle مع execution cycle دون جعل عطل health قادرًا على تجاوز financial gate.
6. ربط adapters حقيقية لكل أداة متاحة.
7. تشغيل health scan ثم repair ثم verification.
8. إضافة اختبارات للأعطال: timeout، auth failure، missing file، build failure، database failure، WhatsApp/Peach failure.
9. عدم وضع الأسرار في GitHub أو logs.
10. إضافة شاشة/بيانات mobile control تعرض: overall health، الأدوات المتوقفة، incident، السبب المحتمل، الإصلاح الجاري، آخر فحص، وما يحتاج موافقة بشرية.

## Definition of Done
- مراقبة دورية فعلية.
- تشخيص وتصنيف الأعطال.
- إصلاح ذاتي آمن ومحدود.
- إعادة اختبار بعد الإصلاح.
- سجل incidents وrepair history دائم.
- ربط الأعطال بالمهام عند الإمكان.
- عدم تجاوز الحواجز المالية أو الأمنية.
- عدم إعلان recovery بدون evidence.
- كل المكونات القديمة تبقى عاملة.
