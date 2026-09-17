const assert = require('node:assert/strict');
const {
  TEMPLATE_LIBRARY_VERSION,
  templates,
  listTemplates,
  getTemplate,
  matchTemplates
} = require('./digital-business-template-library');

assert.equal(TEMPLATE_LIBRARY_VERSION, 1);
assert.ok(templates.length >= 12);
assert.equal(getTemplate('landing-page').name, 'Landing Page');
assert.equal(getTemplate('missing-template'), null);
assert.equal(listTemplates({ category: 'web' }).length, 2);
assert.equal(matchTemplates('محتاج صفحة هبوط لشركة').at(0).id, 'landing-page');
assert.equal(matchTemplates('محتاج لوجو وهوية').at(0).id, 'brand-identity-kit');
assert.equal(matchTemplates('اعمل نظام أتمتة للمتابعة').at(0).id, 'automation-workflow');

console.log('digital-business-template-library tests passed');
