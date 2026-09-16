// ZOZ AI Independent Renderer Registry
// Every business section owns a renderer contract. Heavy execution stays outside Core.
// Free-first policy: prefer self-hosted/open-source execution before paid providers.
const RENDERERS = Object.freeze({
  brand_identity: { id: "brand_identity_renderer", section: "brand_identity", capabilities: ["logo", "visual_identity", "brand_guidelines", "social_assets"], queue: "zoz.render.brand" },
  websites: { id: "web_renderer", section: "websites", capabilities: ["landing_page", "business_website", "source_code", "deployment"], queue: "zoz.render.web" },
  automation: { id: "automation_renderer", section: "automation", capabilities: ["workflow", "api_integration", "webhook"], queue: "zoz.render.automation" },
  content: { id: "content_renderer", section: "content", capabilities: ["script", "copy", "social_posts"], queue: "zoz.render.content" },
  digital_services: { id: "digital_services_renderer", section: "digital_services", capabilities: ["dataset", "analysis", "report", "documents"], queue: "zoz.render.digital-services" },
  software: { id: "software_renderer", section: "software", capabilities: ["source_code", "tests", "release"], queue: "zoz.render.software" },
  media: { id: "video_media_renderer", section: "media", capabilities: ["images", "video", "storyboard", "thumbnail"], queue: "zoz.render.media" },
  qa: { id: "qa_renderer", section: "qa", capabilities: ["quality_check", "validation", "preview"], queue: "zoz.render.qa" }
});

const RENDER_POLICY = Object.freeze({
  executionPreference: ["self-hosted-open-source", "free-cloud", "paid-cloud"],
  paidFallbackAllowed: true,
  paidFallbackRequiresNeed: true,
  financialApprovalStillRequired: true
});

function getRenderer(section) { return RENDERERS[String(section || "").trim()] || null; }
function listRenderers() { return Object.values(RENDERERS).map(renderer => ({ ...renderer })); }
function getRenderPolicy() { return { ...RENDER_POLICY, executionPreference: [...RENDER_POLICY.executionPreference] }; }
function resolveRenderer({ serviceId, skills = [], deliverables = [] } = {}) {
  if (serviceId && RENDERERS[serviceId]) return RENDERERS[serviceId];
  const bySkill = ["media", "brand_identity", "websites", "automation", "software", "content_writing", "data"];
  for (const skill of bySkill) {
    if (skills.includes(skill)) {
      const section = skill === "content_writing" ? "content" : skill === "data" ? "digital_services" : skill;
      return RENDERERS[section];
    }
  }
  for (const [section, renderer] of Object.entries(RENDERERS)) {
    if (deliverables.some(item => renderer.capabilities.includes(item))) return renderer;
  }
  return null;
}

function buildRendererJob(task) {
  const renderer = resolveRenderer({ serviceId: task.serviceId, skills: task.plan?.skills || [], deliverables: task.plan?.deliverables || [] });
  if (!renderer) return { ok: false, reason: "renderer_not_registered" };
  return {
    ok: true,
    rendererId: renderer.id,
    section: renderer.section,
    queue: renderer.queue,
    jobId: task.id,
    input: { title: task.title, description: task.description, skills: task.plan?.skills || [], deliverables: task.plan?.deliverables || [] },
    approval: { financial: Boolean(task.financial), humanApprovalRequired: Boolean(task.humanApprovalRequired) },
    renderPolicy: getRenderPolicy(),
    status: "queued"
  };
}

module.exports = { RENDERERS, RENDER_POLICY, getRenderer, listRenderers, getRenderPolicy, resolveRenderer, buildRendererJob };
