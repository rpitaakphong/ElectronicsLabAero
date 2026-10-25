import { readFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import { createRecord, CAPTURES } from '../../activities/noise-filtering-main-lab/model.js';
import { createZip, validateFile } from '../../activities/noise-filtering-main-lab/files.js';
export const decode = async () => {};
export function prelabZip(pre) {
  const workspace = { package: pre.package, course: '2145427', activity: pre.activity, stage: 'prelab', current: 9,
    fields: pre.responses, checks: pre.confirmations, frozen: pre.originals, finalized: pre.status === 'finalized', created: pre.created_client, updated: pre.updated_client };
  return zipSync({ 'prelab_evidence.json': strToU8(JSON.stringify(pre)), 'workspace_backup.json': strToU8(JSON.stringify({ kind: '2145427-W12-workspace-backup', version: 4, workspace })), 'prelab_report.txt': strToU8('Synthetic pre-lab report') }, { level: 0 });
}
export async function fixtures() {
  const record = createRecord();
  record.fields['group.groupId'] = 'SYNTHETIC-GROUP';
  record.fields['group.student1Name'] = 'Synthetic first member';
  record.fields['group.student3Name'] = 'Synthetic integration example';
  record.fields['build.resistanceActual'] = '47000'; record.fields['build.capacitanceActual'] = '33'; record.fields['design.type'] = 'low-pass';
  record.fields['build.observations'] = 'Synthetic pulse comparison <literal> & measured values';
  record.fields['processing.program'] = 'Python';
  record.fields['processing.rate'] = '0.0005 s, 2000 samples/s, five seconds, checked CSV time column';
  record.fields['code.processing'] = '// </pre><script>window.__injected=true</script>\n' + '# literal processing code\n'.repeat(4500);
  record.fields['code.generator'] = '// source-only sketch';
  for (const [i, f] of [120, 150, 180].entries()) {
    for (const [column, value] of Object.entries({ frequency: String(f), input: '0.07', output: '0.03', units: 'V RMS', predicted: '7', attenuation: '7.4' })) record.fields[`spectrum.${i + 1}.${column}`] = value;
  }
  const image = await readFile(new URL('../../activities/noise-filtering-main-lab/figures/fft-input-output-comparison.jpeg', import.meta.url));
  const files = {};
  for (const c of CAPTURES.filter(c => c.kind === 'image')) files[`${c.id}.image`] = await validateFile(`${c.id}.image`, new Blob([image]), `synthetic-${c.id}.jpeg`, decode);
  const pre = JSON.parse(await readFile(new URL('../../activities/noise-filtering-prelab/examples/prelab-evidence.synthetic.json', import.meta.url), 'utf8'));
  return { main: await createZip(record, files), prelab: prelabZip(pre), pre, record, image };
}
