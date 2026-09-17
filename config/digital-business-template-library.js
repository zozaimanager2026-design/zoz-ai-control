/**
 * ZOZ AI — Digital Business Template Library
 *
 * Reusable execution blueprints for client work. Templates are intentionally
 * renderer-independent so business delivery can continue while media tooling
 * evolves. Financial actions always remain behind the existing approval gate.
 */

const TEMPLATE_LIBRARY_VERSION = 1;

const templates = [
  {
    id: 'brand-identity-kit',
    category: 'design',
    name: 'Brand Identity Kit',
    goal: 'Create a practical visual identity package for a business.',
    deliverables: ['logo concepts', 'color palette', 'typography', 'social profile assets', 'brand usage guide'],
    inputs: ['business_name', 'business_type', 'target_audience', 'style_preferences', 'existing_assets'],
    workflow: ['brief', 'brand_direction', 'design', 'quality_check', 'delivery'],
    quality_checks: ['brand consistency', 'legibility', 'asset completeness', 'export formats'],
    approval_required: false
  },
  {
    id: 'landing-page',
    category: 'web',
    name: 'Landing Page',
    goal: 'Build a conversion-focused landing page for a product or service.',
    deliverables: ['page structure', 'copy', 'responsive design', 'CTA', 'contact form', 'deployment package'],
    inputs: ['business_name', 'offer', 'audience', 'brand_assets', 'contact_details', 'cta'],
    workflow: ['requirements', 'wireframe', 'copy', 'build', 'responsive_test', 'quality_check', 'delivery'],
    quality_checks: ['mobile layout', 'links', 'CTA', 'form behavior', 'performance basics'],
    approval_required: false
  },
  {
    id: 'business-website',
    category: 'web',
    name: 'Business Website',
    goal: 'Create a multi-page website presenting a business professionally.',
    deliverables: ['home', 'about', 'services', 'contact', 'FAQ', 'responsive UI'],
    inputs: ['business_profile', 'services', 'brand_assets', 'contact_details', 'social_links'],
    workflow: ['brief', 'site_map', 'content', 'design', 'development', 'testing', 'delivery'],
    quality_checks: ['navigation', 'responsive behavior', 'content completeness', 'forms', 'SEO basics'],
    approval_required: false
  },
  {
    id: 'ecommerce-product-pack',
    category: 'ecommerce',
    name: 'E-commerce Product Pack',
    goal: 'Prepare products for an online store with consistent presentation.',
    deliverables: ['product titles', 'descriptions', 'feature bullets', 'image brief', 'SEO fields', 'collection mapping'],
    inputs: ['product_data', 'prices', 'inventory_data', 'brand_guidelines', 'store_platform'],
    workflow: ['data_validation', 'content_creation', 'asset_preparation', 'store_mapping', 'quality_check', 'delivery'],
    quality_checks: ['missing fields', 'price consistency', 'SKU consistency', 'SEO completeness'],
    approval_required: true
  },
  {
    id: 'social-content-month',
    category: 'social-media',
    name: 'Social Media Content Month',
    goal: 'Produce a structured month of social content for a client.',
    deliverables: ['content calendar', 'post copy', 'creative briefs', 'short-form scripts', 'CTA set', 'report template'],
    inputs: ['business_profile', 'platforms', 'audience', 'offers', 'content_frequency', 'brand_voice'],
    workflow: ['strategy', 'calendar', 'copy', 'creative', 'quality_check', 'schedule_or_delivery'],
    quality_checks: ['brand voice', 'platform fit', 'CTA coverage', 'duplicate-content check'],
    approval_required: false
  },
  {
    id: 'seo-content-pack',
    category: 'content',
    name: 'SEO Content Pack',
    goal: 'Create search-oriented content around a defined topic cluster.',
    deliverables: ['keyword map', 'article briefs', 'articles', 'meta titles', 'meta descriptions', 'internal-link plan'],
    inputs: ['business_topic', 'target_market', 'keywords', 'tone', 'site_context'],
    workflow: ['research', 'keyword_map', 'outline', 'draft', 'quality_check', 'delivery'],
    quality_checks: ['search intent', 'originality', 'readability', 'metadata', 'internal links'],
    approval_required: false
  },
  {
    id: 'short-video-pack',
    category: 'video',
    name: 'Short Video Pack',
    goal: 'Produce a repeatable short-form video package for social channels.',
    deliverables: ['hooks', 'scripts', 'scene plan', 'caption copy', 'CTA', 'render-ready production data'],
    inputs: ['topic', 'audience', 'platform', 'brand_assets', 'offer'],
    workflow: ['idea', 'hook', 'script', 'scene_plan', 'render', 'quality_check', 'delivery_or_publish'],
    quality_checks: ['hook clarity', 'duration', 'captions', 'CTA', 'platform format'],
    approval_required: false
  },
  {
    id: 'automation-workflow',
    category: 'automation',
    name: 'Business Automation Workflow',
    goal: 'Design and implement a repeatable digital workflow for a business process.',
    deliverables: ['process map', 'trigger definition', 'actions', 'integrations', 'failure handling', 'handover guide'],
    inputs: ['current_process', 'desired_outcome', 'tools', 'permissions', 'approval_rules'],
    workflow: ['process_analysis', 'workflow_design', 'implementation', 'test', 'handover'],
    quality_checks: ['permissions', 'failure handling', 'duplicate prevention', 'approval boundaries', 'logging'],
    approval_required: true
  },
  {
    id: 'lead-generation-system',
    category: 'marketing',
    name: 'Lead Generation System',
    goal: 'Create a system for discovering, qualifying, tracking, and following up with leads.',
    deliverables: ['lead criteria', 'research workflow', 'qualification fields', 'CRM structure', 'follow-up sequences', 'report'],
    inputs: ['ideal_customer', 'market', 'service_offer', 'qualification_rules', 'channels'],
    workflow: ['target_definition', 'lead_research', 'qualification', 'CRM_entry', 'follow_up', 'reporting'],
    quality_checks: ['lead relevance', 'duplicate check', 'contact-data quality', 'consent/policy compliance'],
    approval_required: false
  },
  {
    id: 'digital-service-delivery',
    category: 'client-services',
    name: 'Digital Service Delivery',
    goal: 'Turn a client request into a controlled digital-work delivery cycle.',
    deliverables: ['requirements brief', 'execution plan', 'work product', 'QA report', 'delivery package', 'revision log'],
    inputs: ['client_request', 'deadline', 'deliverables', 'constraints', 'reference_files'],
    workflow: ['intake', 'scope', 'plan', 'execute', 'quality_check', 'package', 'deliver'],
    quality_checks: ['scope match', 'deliverable completeness', 'format validation', 'client instructions'],
    approval_required: false
  },
  {
    id: 'digital-offer-campaign',
    category: 'marketing',
    name: 'Digital Offer Campaign',
    goal: 'Build a complete campaign around a service or product offer.',
    deliverables: ['offer message', 'landing copy', 'social assets', 'CTA set', 'lead capture flow', 'campaign report'],
    inputs: ['offer', 'audience', 'price_or_quote', 'channels', 'brand_assets'],
    workflow: ['offer_definition', 'creative', 'landing', 'lead_capture', 'launch', 'monitoring', 'reporting'],
    quality_checks: ['message consistency', 'CTA', 'tracking', 'approval boundaries', 'asset completeness'],
    approval_required: true
  },
  {
    id: 'client-project-qa-delivery',
    category: 'operations',
    name: 'Client QA & Delivery Pack',
    goal: 'Package any completed digital project for professional delivery.',
    deliverables: ['final files', 'QA checklist', 'change log', 'usage notes', 'delivery message'],
    inputs: ['project_files', 'client_requirements', 'revision_history'],
    workflow: ['inventory', 'requirements_check', 'technical_check', 'package', 'delivery'],
    quality_checks: ['missing files', 'naming', 'links', 'format', 'requirements coverage'],
    approval_required: false
  }
];

function listTemplates(filters = {}) {
  return templates.filter((template) => {
    if (filters.category && template.category !== filters.category) return false;
    if (filters.id && template.id !== filters.id) return false;
    return true;
  });
}

function getTemplate(id) {
  return templates.find((template) => template.id === id) || null;
}

function matchTemplates(request = '') {
  const text = String(request).toLowerCase();
  const keywords = {
    'landing-page': ['landing', 'صفحة هبوط', 'صفحه هبوط'],
    'business-website': ['website', 'site', 'موقع', 'ويب'],
    'brand-identity-kit': ['logo', 'brand', 'هوية', 'لوجو'],
    'ecommerce-product-pack': ['shopify', 'product', 'منتج', 'متجر'],
    'social-content-month': ['social', 'سوشيال', 'منشورات', 'محتوى شهر'],
    'seo-content-pack': ['seo', 'article', 'مقال', 'محركات البحث'],
    'short-video-pack': ['video', 'reel', 'short', 'فيديو', 'ريلز'],
    'automation-workflow': ['automation', 'workflow', 'أتمتة', 'اوتوميشن'],
    'lead-generation-system': ['lead', 'leads', 'عملاء محتملين', 'عملاء محتملين'],
    'digital-offer-campaign': ['campaign', 'offer', 'حملة', 'عرض'],
    'digital-service-delivery': ['service', 'خدمة', 'مشروع'],
    'client-project-qa-delivery': ['delivery', 'تسليم', 'جودة', 'qa']
  };

  return templates
    .map((template) => ({
      template,
      score: (keywords[template.id] || []).reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.template);
}

module.exports = {
  TEMPLATE_LIBRARY_VERSION,
  templates,
  listTemplates,
  getTemplate,
  matchTemplates
};
