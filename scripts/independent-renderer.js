#!/usr/bin/env node
const runtime = require("../renderers/runtime");

const command = process.argv[2] || "status";

function print(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

if (command === "status") {
  print(runtime.status());
  process.exit(0);
}

if (command === "self-test") {
  const result = runtime.inspectLibrary();
  print(result);
  process.exit(result.ok ? 0 : 1);
}

if (command === "queue") {
  const task = {
    id: process.argv[3] || `local-${Date.now()}`,
    title: process.argv[4] || "Independent renderer job",
    description: process.argv[5] || "Reusable digital-work task",
    plan: { skills: ["software"], deliverables: ["source_code", "tests"] },
    financial: false,
    humanApprovalRequired: false
  };
  print(runtime.queue(task));
  process.exit(0);
}

if (command === "improve") {
  print(runtime.recordImprovement({ reason: process.argv[3], suggestion: process.argv[4] }));
  process.exit(0);
}

process.stderr.write("Usage: node scripts/independent-renderer.js <status|self-test|queue|improve>\n");
process.exit(2);
