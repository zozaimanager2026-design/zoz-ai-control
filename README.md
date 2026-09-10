# zoz-ai-control
Zoz AI Control — لوحة تحكم ذكية لإدارة أدوات ومهام Zoz AI مع نظام موافقات للمهام الحساسة.

## التشغيل الحقيقي
المشروع يعمل كطبقة التحكم الأساسية، ويحتوي على فحص جاهزية، سجل تدقيق، طابور مهام، وتنفيذ آمن للمهام غير المالية.

### قواعد مهمة
- لا تُحفظ الأسرار داخل GitHub.
- أضف مفاتيح الخدمات في Environment Variables على منصة الاستضافة، وليس في المحادثة.
- لا يُعتبر أي موصل خارجي متصلًا إلا بعد اعتماد فعلي والتحقق من الخدمة.
- الدفع والشراء والتحويل والسحب واستلام الأموال تتطلب موافقة المستخدم.
- المشروع المستهدف هو `zoz-ai-control` ولا حاجة لإنشاء مشروع Vercel جديد.

### متغيرات البيئة
راجع `.env.example` لمعرفة أسماء المتغيرات المطلوبة. التخزين الدائم يحتاج `KV_REST_API_URL` و`KV_REST_API_TOKEN`. الموصلات الخارجية تحتاج مفاتيحها الخاصة.

### WhatsApp Business
قناة الأعمال هي رقم ZOZ AI على WhatsApp Business. تكامل Cloud API أصبح مجهزًا في النواة للتحقق من رقم الهاتف عبر `WHATSAPP_ACCESS_TOKEN` و`WHATSAPP_PHONE_NUMBER_ID`، واستقبال Webhook عبر `/api/whatsapp/webhook`. إعداد التحقق يحتاج `WHATSAPP_VERIFY_TOKEN` أيضًا. لا تُضع أي قيمة سرية داخل GitHub.

### نقاط الفحص
- `/health` — صحة الخدمة.
- `/api/self-test` — اختبار مكونات التحكم الأساسية.
- `/api/readiness` — العوائق الحالية.
- `/api/plan` — ترتيب التنفيذ.
- `/api/connectors/status` — حالات الموصلات.
- `/api/connectors/verify?id=whatsapp` — التحقق الفعلي من WhatsApp API.
- `/api/automation/status` — قابلية التشغيل الآلي.
- `/api/audit` — سجل التدقيق.
- `/api/whatsapp/webhook` — نقطة تحقق Webhook الخاصة بـWhatsApp Cloud API.
