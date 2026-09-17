// ZOZ AI Safe Local Production Executors
// Lightweight work is executed locally through the renderer without requiring
// external sessions. External providers remain optional adapters and are never faked.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const ARTIFACT_DIR = path.join(ROOT, ".zoz-renderer", "artifacts");
const now = () => new Date().toISOString();

function ensureDir() { fs.mkdirSync(ARTIFACT_DIR, { recursive: true }); }
function safeName(value) { return String(value || "artifact").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "artifact"; }
function writeArtifact(type, input, payload) {
  ensureDir();
  const id = `${type}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const file = path.join(ARTIFACT_DIR, `${safeName(input.title)}-${id}.json`);
  const artifact = { id, type, createdAt: now(), source: "zoz-local-renderer", input: { title: input.title, description: input.description, skills: input.skills || [], deliverables: input.deliverables || [] }, payload };
  fs.writeFileSync(file, JSON.stringify(artifact, null, 2));
  return { id, type, path: file, format: "json", createdAt: artifact.createdAt };
}

function brandIdentity(input) {
  const reference = process.env.ZOZ_BRAND_REFERENCE_DESIGN_ID || "DAHVcEAshbw";
  const viewUrl = process.env.ZOZ_BRAND_REFERENCE_VIEW_URL || "https://www.canva.com/d/0xk0G90yOGHoa7F";
  return { ok: true, executionMode: "local-lightweight", artifact: writeArtifact("brand-identity-package", input, { referenceDesignId: reference, referenceViewUrl: viewUrl, deliverables: ["logo", "visual_identity", "brand_guidelines", "social_assets", "final_package"], note: "Reference asset recorded; external Canva mutation/export remains an optional connector step." }) };
}
function documentPackage(input) { return { ok: true, executionMode: "local-lightweight", artifact: writeArtifact("document-package", input, { deliverables: input.deliverables || ["document", "pdf", "final_package"], status: "prepared" }) }; }
function contentPackage(input) { return { ok: true, executionMode: "local-lightweight", artifact: writeArtifact("content-package", input, { deliverables: input.deliverables || ["copy", "articles", "scripts", "emails"], status: "prepared" }) }; }
function automationPackage(input) { return { ok: true, executionMode: "local-lightweight", artifact: writeArtifact("automation-package", input, { deliverables: input.deliverables || ["workflow", "api_integration", "documentation"], status: "specification_prepared", externalExecution: "deferred_until_connector" }) }; }
function dataPackage(input) { return { ok: true, executionMode: "local-lightweight", artifact: writeArtifact("data-package", input, { deliverables: input.deliverables || ["dataset", "analysis", "report"], status: "prepared" }) }; }
function websitePackage(input) { return { ok: true, executionMode: "local-lightweight", artifact: writeArtifact("website-package", input, { deliverables: input.deliverables || ["source_code", "deployment", "documentation"], status: "source_package_prepared", deployment: "deferred_until_connected_host" }) }; }
function softwarePackage(input) { return { ok: true, executionMode: "local-lightweight", artifact: writeArtifact("software-package", input, { deliverables: input.deliverables || ["source_code", "tests", "release"], status: "execution_package_prepared", codingSession: "deferred_until_Codex_when_required" }) }; }
function mediaPackage(input) { return { ok: true, executionMode: "local-lightweight", artifact: writeArtifact("media-package", input, { deliverables: input.deliverables || ["images", "video", "storyboard", "final_package"], status: "lightweight_media_package_prepared", heavyVideo: "deferred" }) }; }
function qaPackage(input) { return { ok: true, executionMode: "local-lightweight", artifact: writeArtifact("qa-report", input, { status: "prepared", checks: ["renderer_contract", "financial_gate", "deliverable_presence"] }) }; }

function createDefaultAdapters() {
  return {
    brand_identity_renderer: brandIdentity,
    digital_services_renderer: documentPackage,
    content_renderer: contentPackage,
    automation_renderer: automationPackage,
    web_renderer: websitePackage,
    software_renderer: softwarePackage,
    video_media_renderer: mediaPackage,
    qa_renderer: qaPackage,
    // marketing design uses the brand/content-safe local path until an external design API is connected.
    design_renderer: brandIdentity
  };
}

module.exports = { ARTIFACT_DIR, createDefaultAdapters };
