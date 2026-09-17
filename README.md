# ZOZ AI — AI Business Operating System

هذا المستودع هو النواة التشغيلية لـ ZOZ AI. الهدف ليس Dashboard شكليًا: النواة تحفظ حالة العمل، تدير العملاء والفرص والطلبات، تنظم المهام، تتحقق من الموصلات، وتسجل الأحداث، مع بوابة موافقة بشرية للعمليات المالية.

## WhatsApp / Peach

Peach هو مسار WhatsApp outbound الأساسي عند توفر بياناته. لا ينشئ النظام Repo أو Vercel Project جديدًا.

### Peach outbound contract

يستخدم النظام دائمًا هذا العنوان عند الإرسال عبر Peach:

`POST https://app.trypeach.io/api/v1/events`

Headers:

- `Authorization: <PEACH_API_KEY>`
- `Content-Type: application/json`

Body structure:

- `event_type: "send_template_message"`
- `contact.phone_number`
- `template_message.whats_app_template_id`
- `template_message.liquid_values`

`liquid_values` تُرسل كما يحددها الطلب/Template. النظام لا يفرض متغيرًا باسم `message`. لذلك يجب إرسال مثلًا `{"customer_name":"...","product_name":"..."}` حسب متغيرات Template الفعلية. عند الحاجة يمكن تعريف `PEACH_TEMPLATE_VARIABLE` في Environment Variables لتطبيقات أخرى، لكنه ليس اسمًا مفروضًا داخل Payload.

### Peach webhook

سجّل داخل Peach عنوان الـWebhook التالي:

`https://<ZOZ-AI-DOMAIN>/api/webhooks/peach`

يدعم endpoint أحداث:

- `message_delivery.sent`
- `message_delivery.delivered`
- `message_delivery.failed`
- `message_delivery.read`
- `message_delivery.replied`

عند `message_delivery.replied` يستخرج النظام رقم العميل واسمه ونص الرد، ثم ينشئ/يحدّث Customer وLead داخل WhatsApp CRM، ويسجل Audit Event، ويحفظ الحالة عند توفر KV persistence.

لا يتم تسجيل API keys أو tokens أو Authorization headers أو أسرار في Audit أو Responses.

### Meta webhook

مسار Meta موجود ومنفصل ولا يعتمد على Peach:

- `GET /api/whatsapp/webhook` — Meta verification challenge.
- `POST /api/whatsapp/webhook` — استقبال أحداث Meta مع التحقق من `WHATSAPP_APP_SECRET` عند توفره.

### WhatsApp outbound endpoint

`POST /api/whatsapp/send` محمي server-side بـ:

`Authorization: Bearer <WHATSAPP_SEND_SECRET>`

إذا لم يكن `WHATSAPP_SEND_SECRET` مضبوطًا، لا يسمح endpoint بالإرسال ويعيد `503`. الرسائل المالية تُرفض بـ `403` ولا تُرسل تلقائيًا.

عند وجود Peach credentials يستخدم النظام Peach. إذا لم تكن Peach مهيأة يمكن استخدام Meta outbound كمسار احتياطي تقني.

## Environment Variables في Vercel

أضف القيم فقط داخل Environment Variables في مشروع Vercel الحالي:

- `PEACH_API_KEY` — مفتاح Peach الحقيقي.
- `PEACH_TEMPLATE_ID` — ID الـWhatsApp Template المعتمد في Peach.
- `PEACH_TEMPLATE_VARIABLE` — اختياري فقط عند الحاجة؛ لا يوجد اسم متغير مفروض.
- `PEACH_BUSINESS_PHONE_NUMBER` — اختياري إذا كان مطلوبًا من حساب/Template Peach.
- `WHATSAPP_SEND_SECRET` — سر حماية `POST /api/whatsapp/send`.
- `WHATSAPP_VERIFY_TOKEN` — Meta webhook verification token.
- `WHATSAPP_APP_SECRET` — Meta signature validation.
- `CRON_SECRET` — حماية `/api/automation/cycle`؛ لا تتركه فارغًا في Production.
- `DATABASE_URL` أو `KV_REST_API_URL` + `KV_REST_API_TOKEN` — persistence حسب البنية الحالية.

لا تضع أي قيمة سرية داخل GitHub أو `.env.example`.

## التشغيل والتحقق

بعد ضبط Environment Variables:

1. شغّل `npm test`.
2. شغّل `node --check server.js`.
3. شغّل `node --check business.js`.
4. تحقق من `/api/self-test` و`/api/readiness`.
5. تحقق من `/api/connectors/verify?id=whatsapp`.
6. سجّل `POST https://<ZOZ-AI-DOMAIN>/api/webhooks/peach` داخل Peach.
7. أرسل رسالة اختبار غير مالية من خلال `POST /api/whatsapp/send` مع `Authorization: Bearer <WHATSAPP_SEND_SECRET>` و`liquid_values` المطابقة للـTemplate.

## Financial safety

الدفع، الشراء، التحويل، السحب، التحصيل، واستلام الأموال تبقى خلف Human Approval. موافقة المستخدم لا تعني تنفيذ حركة مالية فعلية؛ النواة تسجل التفويض فقط ولا تنفذ حركة مالية تلقائية.

## Cron protection

المساران `GET /api/automation/cycle` و`POST /api/automation/cycle` محميان بـ `CRON_SECRET`. غياب السر في Production يعيد `503` بدل تشغيل الدورة، وAuthorization الخاطئ يعيد `401`.

## الاختبارات

`npm test` يشمل syntax checks، طبقة الأعمال، WhatsApp CRM، Peach payload/webhook structure، حماية WhatsApp outbound، حماية Cron، وتكاملات المشروع الموجودة.

## ZOZ Native Image Renderer — Hugging Face ZeroGPU

The image pipeline is now free-first and provider-agnostic. When `ZOZ_HF_SPACE_URL` is configured, the ZOZ media renderer routes image generation to the ZOZ-owned Hugging Face Gradio Space under `hf-spaces/zoz-native-image/`. Paid image providers are not the default path.

The current reference model is `Qwen/Qwen-Image-2512` (Apache-2.0). Hugging Face documents ZeroGPU as a shared GPU runtime for Gradio Spaces; the free personal tier currently includes 5 minutes of daily GPU quota, so this is a development/production-small-work runtime rather than an unlimited free GPU promise.

Required renderer environment variables:

- `ZOZ_HF_SPACE_URL` — URL of the deployed ZOZ Native Image Space.
- `ZOZ_HF_SPACE_SECRET` — optional Space secret if renderer authentication is enabled.
- `HF_TOKEN` — optional token for authenticated/private Spaces.
- `ZOZ_IMAGE_MODEL` — optional model override; default `Qwen/Qwen-Image-2512`.

The renderer keeps a fallback to the existing ZOZ-owned native HTTP service through `ZOZ_NATIVE_IMAGE_RENDERER_URL`. No paid provider is introduced by this change.
