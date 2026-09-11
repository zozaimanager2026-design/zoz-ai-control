# ZOZ AI — AI Business Operating System

هذا المستودع هو النواة التشغيلية لـ ZOZ AI. الهدف ليس عرض Dashboard فقط، بل طبقة تشغيل تحفظ حالة العمل، تدير العملاء والفرص والطلبات، تنظم المهام، تتحقق من الموصلات، وتسجل القرارات والأحداث، مع بوابة موافقة بشرية للعمليات المالية.

## ما يعمل داخل النواة

- **Business layer:** عملاء، عملاء محتملون، مراحل مبيعات، طلبات، منتجات، موردون، مصروفات، وفرص.
- **Execution layer:** طابور مهام + دورة استقلالية تنفذ الأعمال الداخلية الآمنة فقط.
- **Human approval:** الدفع، الشراء، التحويل، السحب، التحصيل، واستلام الأموال لا تُنفذ تلقائيًا.
- **Approval ledger:** تسجيل طلبات الموافقة وحالتها وتوقيتها بدل الاعتماد على زر شكلي.
- **Audit log:** سجل مركزي للأحداث التشغيلية.
- **Connector verification:** لا يُعتبر الموصل جاهزًا للتشغيل الخارجي إلا بعد تحقق فعلي.
- **Persistence:** دعم KV-compatible REST عبر Environment Variables. بدون KV تبقى الحالة `memory_only` ويظهر ذلك كعائق في readiness.
- **WhatsApp CRM:** استقبال رسائل WhatsApp وتحويلها إلى عميل/Lead داخل طبقة الأعمال، مع دعم التحقق من توقيع `X-Hub-Signature-256` عند توفير `WHATSAPP_APP_SECRET`.
- **Vercel:** المشروع يستهدف مشروع Vercel الحالي ولا ينشئ مشروعًا جديدًا.
- **Production monitor:** GitHub Actions يفحص الصحة والاختبار الداخلي وreadiness وحماية دورة الاستقلالية كل 6 ساعات، مع تشغيل يدوي متاح.

## حدود الاستقلالية

ZOZ AI يستطيع تشغيل العمليات الداخلية الآمنة تلقائيًا. الموافقة البشرية لا تعني أن النواة ستنفذ حركة مالية فعلية: النواة تسجل التفويض، لكنها لا تحتوي على منفذ مالي مباشر. أي تكامل مالي مستقبلي يجب أن يظل خلف موافقة بشرية صريحة وأسرار محفوظة في Environment Variables.

## حماية دورة الاستقلالية

المساران `GET /api/automation/cycle` و`POST /api/automation/cycle` محميان بـ `CRON_SECRET`.

- على Vercel: إذا لم يكن `CRON_SECRET` مضبوطًا، يُعاد `503` بدل تشغيل الدورة.
- عند غياب أو خطأ Authorization، يُعاد `401`.
- التشغيل المصرح به فقط يستخدم `Authorization: Bearer <CRON_SECRET>`.
- لا يتم وضع السر داخل GitHub أو الكود أو سجلات GitHub Actions.

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
- `/api/automation/cycle` — دورة الاستقلالية المحمية؛ التشغيل يتطلب `CRON_SECRET`.
- `/api/whatsapp/webhook` — تحقق واستقبال WhatsApp Cloud API.

## الاختبارات والتحقق المستقل

`npm test` يتحقق من syntax ويشغل اختبارات طبقة الأعمال وWhatsApp CRM واختبار حماية دورة الاستقلالية.

`/.github/workflows/production-monitor.yml` هو مسار التحقق المستقل عند تعذر الوصول المباشر إلى Vercel API؛ لا يعتمد على كشف أو تمرير `CRON_SECRET` إلى GitHub.

## التعامل مع العوائق

إذا تعذر Vercel API/MCP بسبب `403` أو `Not authorized`، لا يتم إنشاء مشروع بديل ولا تكرار التفويض بلا دليل جديد. تُنفذ تغييرات الكود والاختبارات والمراقبة عبر GitHub/GitHub Actions، ويُعتبر runtime في Vercel غير متحقق منه مباشرة حتى ينجح فحص مستقل. التفاصيل في `BLOCKER_PLAYBOOK.md`.
