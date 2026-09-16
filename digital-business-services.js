const SERVICES = {
  brand_identity: {
    label: "الهوية البصرية واللوجو",
    skills: ["brand_identity", "marketing_design"],
    primaryTools: ["design_tools", "phone"],
    alternatives: ["design_tools", "document_tools"],
    deliverables: ["logo", "visual_identity", "brand_guidelines", "social_assets", "final_package"]
  },
  websites: {
    label: "تصميم وتطوير المواقع",
    skills: ["websites"],
    primaryTools: ["github", "vercel", "phone"],
    alternatives: ["github", "vercel"],
    deliverables: ["landing_page", "business_website", "source_code", "deployment", "documentation"]
  },
  automation: {
    label: "الأتمتة وAPI",
    skills: ["automation"],
    primaryTools: ["automation_tools", "github", "phone"],
    alternatives: ["github", "automation_tools"],
    deliverables: ["workflow", "api_integration", "webhook", "documentation"]
  },
  content: {
    label: "المحتوى وإدارة القنوات",
    skills: ["content_writing", "media", "marketing_design"],
    primaryTools: ["media_tools", "design_tools", "phone"],
    alternatives: ["document_tools", "design_tools"],
    deliverables: ["script", "thumbnail", "video", "social_posts", "final_package"]
  },
  digital_services: {
    label: "الخدمات الرقمية والبيانات",
    skills: ["data", "pdf_documents", "content_writing"],
    primaryTools: ["data_tools", "document_tools", "phone"],
    alternatives: ["document_tools", "data_tools"],
    deliverables: ["dataset", "analysis", "report", "documents", "final_package"]
  },
  software: {
    label: "البرمجيات والتطوير",
    skills: ["software"],
    primaryTools: ["github", "codex", "phone"],
    alternatives: ["github", "codex"],
    deliverables: ["source_code", "tests", "release", "documentation"]
  },
  media: {
    label: "الصور والفيديو",
    skills: ["media", "marketing_design"],
    primaryTools: ["media_tools", "design_tools", "phone"],
    alternatives: ["design_tools", "document_tools"],
    deliverables: ["images", "video", "storyboard", "thumbnail", "final_package"]
  }
};

function getService(serviceId) {
  return SERVICES[String(serviceId || "").trim()] || null;
}

function listServices() {
  return Object.entries(SERVICES).map(([id, service]) => ({ id, ...service }));
}

function fallbackTools(serviceId, unavailable = []) {
  const service = getService(serviceId);
  if (!service) return [];
  const blocked = new Set(unavailable);
  return service.alternatives.filter(tool => !blocked.has(tool));
}

module.exports = { SERVICES, getService, listServices, fallbackTools };
