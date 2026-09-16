const assert = require("assert");
const { scoreContent, buildProductionBrief } = require("./autonomous-runtime");

const item = {
  title: "خلّي الـAI يشتغل بدلًا منك",
  hook: "أنت نايم… والـAI شغال. هل ده ممكن فعلًا؟",
  body: "المشكلة إن أغلب الناس تستخدم الذكاء الاصطناعي للإجابة فقط. في هذا الفيديو نوضح كيف يتحول إلى نظام ينفذ خطوات حقيقية، مع مثال واضح، إيقاع سريع، وقيمة عملية للمشاهد.\n\nفي النهاية سنوضح ما الذي يجب أن يظل تحت موافقة الإنسان.",
  cta: "تابع ZOZ AI وشوف التجربة خطوة بخطوة."
};
const quality = scoreContent(item);
assert(quality.score >= 70, "Professional content candidate should pass the quality gate");
const brief = buildProductionBrief(item);
assert.strictEqual(brief.targetSeconds, 60);
assert(brief.structure.includes("hook_0_3s"));
assert.strictEqual(brief.publish.previewRequired, true);
assert.strictEqual(brief.publish.humanApprovalRequired, true);
console.log("content-production-pipeline.test.js: OK");
