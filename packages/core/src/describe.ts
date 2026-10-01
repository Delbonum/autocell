import type { CompareOp, Condition, Model, Rule } from './types';

const OP_WORD: Record<CompareOp, string> = {
  '=': 'genau',
  '!=': 'nicht genau',
  '<': 'weniger als',
  '<=': 'höchstens',
  '>': 'mehr als',
  '>=': 'mindestens',
};

const OFFSET_WORD: Record<string, string> = {
  '-1,0': 'links',
  '1,0': 'rechts',
  '0,-1': 'oberhalb',
  '0,1': 'unterhalb',
  '-1,-1': 'oben links',
  '1,-1': 'oben rechts',
  '-1,1': 'unten links',
  '1,1': 'unten rechts',
};

function stateList(model: Model, states: number[]): string {
  const names = states.map((s) => `„${model.states[s]?.name ?? `#${s}`}“`);
  if (names.length <= 1) return `im Zustand ${names[0] ?? '–'}`;
  return `in den Zuständen ${names.slice(0, -1).join(', ')} oder ${names[names.length - 1]}`;
}

/** Beschreibt eine Bedingung in deutscher Sprache. */
export function describeCondition(model: Model, c: Condition): string {
  if (c.type === 'neighborCount') {
    const one = c.value === 1;
    return `sich ${OP_WORD[c.op]} ${c.value} ${one ? 'Nachbar' : 'Nachbarn'} ${stateList(model, c.states)} ${one ? 'befindet' : 'befinden'}`;
  }
  if (c.type === 'neighborAt') {
    const where = OFFSET_WORD[`${c.dx},${c.dy}`] ?? `bei (${c.dx}, ${c.dy})`;
    const name = model.states[c.state]?.name ?? `#${c.state}`;
    return `die Zelle ${where} ${c.op === '=' ? '' : 'nicht '}im Zustand „${name}“ ist`;
  }
  return `die Zelle seit ${OP_WORD[c.op]} ${c.value} Generationen in diesem Zustand ist`;
}

/** Beschreibt eine Regel als ganzen Satz. */
export function describeRule(model: Model, from: number, r: Rule): string {
  const fromName = model.states[from]?.name ?? `#${from}`;
  const toName = model.states[r.target]?.name ?? `#${r.target}`;
  let text = `Eine Zelle in „${fromName}“ wechselt zu „${toName}“`;
  if (r.conditions.length === 0) text += ' (immer)';
  else text += `, wenn ${r.conditions.map((c) => describeCondition(model, c)).join(r.combine === 'any' ? ' oder ' : ' und ')}`;
  if (r.probability < 1) text += ` – mit ${formatPercent(r.probability)} Wahrscheinlichkeit pro Generation`;
  return text + '.';
}

export function formatPercent(p: number): string {
  const v = Math.round(p * 10000) / 100;
  return `${String(v).replace('.', ',')} %`;
}

/** Prüft ein Modell auf Probleme, die zwar ladbar, aber vermutlich unbeabsichtigt sind. */
export function lintModel(model: Model): string[] {
  const out: string[] = [];
  const n = model.states.length;
  model.states.forEach((s, i) => {
    if (!s.name.trim()) out.push(`Zustand ${i + 1} hat keinen Namen.`);
    s.rules.forEach((r, k) => {
      if (r.target === i) out.push(`„${s.name}“, Regel ${k + 1}: wechselt in denselben Zustand und hat keine Wirkung.`);
      if (r.target >= n) out.push(`„${s.name}“, Regel ${k + 1}: Zielzustand existiert nicht.`);
      if (r.probability <= 0) out.push(`„${s.name}“, Regel ${k + 1}: Wahrscheinlichkeit 0 % – die Regel greift nie.`);
      for (const c of r.conditions) {
        if (c.type === 'neighborCount' && c.states.length === 0) out.push(`„${s.name}“, Regel ${k + 1}: Bedingung ohne Nachbarzustand.`);
      }
    });
  });
  const seen = new Map<string, number>();
  model.states.forEach((s, i) => {
    const k = s.name.trim().toLowerCase();
    if (k && seen.has(k)) out.push(`Die Zustände ${seen.get(k)! + 1} und ${i + 1} heißen gleich.`);
    seen.set(k, i);
  });
  return out;
}
