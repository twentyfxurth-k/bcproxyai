// Parse thai-eval.log output into SQL that seeds exam_attempts + exam_answers
// + model_category_scores for category='thai'. Reads log from first CLI arg,
// writes SQL to stdout.
import fs from 'node:fs';
import path from 'node:path';

const logPath = process.argv[2];
if (!logPath) {
  console.error('usage: node gen-thai-seed-sql.mjs <log-path>');
  process.exit(1);
}
const log = fs.readFileSync(path.resolve(logPath), 'utf8');

const re = /^\[(\d+)\/\d+\]\s+score=([\d.]+)\/10\s+(\S+)\s+(.+)$/gm;
const out = [];
let m;
while ((m = re.exec(log)) !== null) {
  const modelId = m[3];
  const probeList = m[4].split('|').map((p) => p.trim());
  const perPrompt = probeList.map((p) => (p.startsWith('P(') ? 1 : 0));
  const passes = perPrompt.reduce((a, b) => a + b, 0);
  out.push({ modelId, passes, total: probeList.length, perPrompt });
}
console.error(`parsed ${out.length} models`);

const sqlEscape = (s) => s.replace(/'/g, "''");

console.log('-- Thai ground-truth seed');
console.log(`-- generated ${new Date().toISOString()}`);
console.log('BEGIN;');
console.log(
  "DELETE FROM exam_answers WHERE question_id LIKE 'thai-seed-%';",
);
console.log(
  "DELETE FROM exam_attempts WHERE id IN (SELECT attempt_id FROM exam_answers WHERE question_id LIKE 'thai-seed-%');",
);
console.log("DELETE FROM model_category_scores WHERE category = 'thai';");
console.log();

for (const r of out) {
  const id = sqlEscape(r.modelId);
  const pct = ((r.passes / r.total) * 100).toFixed(1);
  const passed = r.passes > 0 ? 'TRUE' : 'FALSE';
  // Check the model exists before trying to insert (avoid FK failure)
  console.log(`DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM models WHERE id = '${id}') THEN
    WITH a AS (
      INSERT INTO exam_attempts (model_id, attempt_number, started_at, finished_at,
        total_questions, passed_questions, score_pct, passed, total_latency_ms, exam_level)
      VALUES ('${id}', 99, now(), now(), ${r.total}, ${r.passes}, ${pct}, ${passed}, 0, 'middle')
      RETURNING id
    )
    INSERT INTO exam_answers (attempt_id, question_id, category, question, answer, passed, check_method)
    SELECT a.id, v.qid, 'thai', v.q, 'auto-eval', v.pass, 'thai-post-gen'
    FROM a, (VALUES
${r.perPrompt
  .map(
    (p, i) =>
      `      ('thai-seed-${i + 1}', 'Thai eval prompt #${i + 1}', ${p === 1 ? 'TRUE' : 'FALSE'})`,
  )
  .join(',\n')}
    ) AS v(qid, q, pass);
    INSERT INTO model_category_scores (model_id, category, score_pct, passed_count, total_count)
    VALUES ('${id}', 'thai', ${pct}, ${r.passes}, ${r.total});
  END IF;
END $$;`);
}
console.log('COMMIT;');

console.error('SQL emitted for', out.length, 'models');
