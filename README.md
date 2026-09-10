# ZOZ AI — AI Business Operating System

هذا المستودع هو النواة التشغيلية لـ ZOZ AI. الهدف ليس عرض Dashboard فقط، بل طبقة تشغيل تحفظ حالة العمل، تدير العملاء والفرص والطلبات، تنظم المهام، تتحقق من الموصلات، وتسجل القرارات والأحداث، مع بوابة موافقة بشرية للعمليات المالية.

## ما يعمل داخل النواة

- **Business layer:** عملاء، عملاء محتملون، مراحل مبيعات، طلبات، منتجات، موردون، مصروفات، وفرص.
- **Execution layer:** طابور مهام + دورة استقلالية تنفذ الأعمال الداخلية الآمنة فقط.
- **Human approval:** الدفع، الشراء، التحويل، السحب، التحصيل، واستلام الأموال لا تُنفذ تلقائيًا.
- **Approval ledger:** تسجيل طلبات الموافقة وحالتها وتوقيتها بدل الاعتماد على زر شكلي.
- **Audit log:** سجل مركزي للأحداث التشغيلية.
- **Connector verification:** لا يُعتبر الموصل جاهزًا للتشغيل الخارجي إلا بعد تحقق فعلي.
- **Persistence:** دعم KV-compatible REST عبر Environment Variables.
- **WhatsApp CRM:** استقبال رسائل WhatsApp وتحويلها إلى عميل/Lead داخل طبقة الأعمال، مع دعم التحقق من توقيع `X-Hub-Signature-256` عند توفير `WHATSAPP_APP_SECRET`.
- **Vercel:** المشروع يستهدف مشروع Vercel الحالي ولا ينشئ مشروعًا جديدًا.

## حدود الاستقلالية

ZOZ AI يستطيع تشغيل العمليات الداخلية الآمنة تلقائيًا. الموافقة البشرية لا تعني أن النواة ستنفذ حركة مالية فعلية: النواة تسجل التفويض، لكنها لا تحتوي على منفذ مالي مباشر. أي تكامل مالي مستقبلي يجب أن يظل خلف موافقة بشرية صريحة وأسرار محفوظة في Environment Variables.

## الأسرار

لا تضع أي Secret أو Access Token في GitHub أو الكود. استخدم Environment Variables في Vercel. راجع `.env.example` لمعرفة أسماء المتغيرات.

## نقاط التشغيل

- `/health` — صحة الخدمة.
- `/api/self-test` — الاختبار الداخلي.
- `/api/readiness` — العوائق الفعلية.
- `/api/plan` — خطة التنفيذ المرتبة.
- `/api/state` — الحالة التشغيلية.
- `/api/audit` — سجل التدقيق.
- `/api/approvals` — سجل الموافقات.
- `/api/jobs` — طابور المهام.
- `/api/business/summary` — ملخص التشغيل التجاري.
- `/api/business/customers` — العملاء.
- `/api/business/leads` — العملاء المحتملون.
- `/api/business/orders` — الطلبات.
- `/api/business/opportunities` — الفرص.
- `/api/business/actions/plan` — تخطيط إجراء مع تحديد ما إذا كان ماليًا.
- `/api/connectors/status` — حالة الموصلات.
- `/api/connectors/verify?id=whatsapp` — تحقق فعلي من WhatsApp API.
- `/api/automation/status` — حالة الاستقلالية الآمنة.
- `/api/automation/cycle` — تشغيل دورة الاستقلالية؛ GET متاح لـVercel Cron وPOST متاح للتشغيل اليدوي.
- `/api/whatsapp/webhook` — تحقق واستقبال WhatsApp Cloud API.

## الاختبارات

`npm test` يتحقق من syntax ويشغل اختبارات طبقة الأعمال واختبارات WhatsApp CRM.
