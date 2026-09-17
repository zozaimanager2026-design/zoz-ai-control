const assert = require('node:assert/strict');
const schema = require('./digital-business-template-library.schema.json');
const { templates } = require('./digital-business-template-library');

for (const template of templates) {
  for (const field of schema.templateRequiredFields) {
    assert.ok(Object.prototype.hasOwnProperty.call(template, field), `${template.id} missing ${field}`);
  }
  assert.ok(schema.allowedCategories.includes(template.category), `${template.id} uses unknown category`);
  assert.equal(template.category === 'video', false);
}

assert.equal(schema.rules.digitalOnly, true);
assert.equal(schema.rules.financialApprovalGateImmutable, true);
console.log('digital business template schema tests passed');
