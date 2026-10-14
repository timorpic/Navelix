import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

export function summarizeCoverage(lcovFile) {
  const measured = new Map();
  for (const record of readFileSync(lcovFile, 'utf8').split('end_of_record')) {
    const source = record.match(/^SF:(.+)$/m)?.[1];
    if (!source) continue;
    const lines = [...record.matchAll(/^DA:(\d+),(\d+)/gm)];
    measured.set(resolve(source), { total: lines.length, covered: lines.filter(line => Number(line[2]) > 0).length });
  }
  const groups = {};
  const files = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(path); continue; }
      if (!/\.tsx?$/.test(path) || /(?:\.test|\.d)\.ts$/.test(path)) continue;
      const found = measured.get(resolve(path));
      const source = readFileSync(path, 'utf8').replace(/\n$/, '');
      const total = found?.total ?? source.split('\n').length;
      const covered = found?.covered ?? 0;
      const group = path.split('/')[1];
      groups[group] ??= { files: 0, measuredFiles: 0, lines: 0, covered: 0 };
      groups[group].files++; groups[group].measuredFiles += Number(!!found);
      groups[group].lines += total; groups[group].covered += covered;
      files.push({ path: relative(process.cwd(), resolve(path)), measured: !!found, lines: total, covered });
    }
  }
  walk('src');
  const total = files.reduce((sum, file) => sum + file.lines, 0);
  const covered = files.reduce((sum, file) => sum + file.covered, 0);
  const percent = total ? covered / total * 100 : 0;
  const summary = { description: 'Conservative source coverage: all unmeasured TS/TSX files count as zero. Bundled component tests lack source mapping in Node coverage.', percent, total, covered, groups, files };
  writeFileSync('coverage/all-source-summary.json', JSON.stringify(summary, null, 2) + '\n');
  console.log(`All-source conservative line coverage: ${percent.toFixed(2)}% (${covered}/${total}); unmeasured files count as zero.`);
  for (const [group, value] of Object.entries(groups)) console.log(`  src/${group}: ${value.measuredFiles}/${value.files} files measured, ${value.lines ? (value.covered / value.lines * 100).toFixed(2) : 0}% lines`);
  return summary;
}
