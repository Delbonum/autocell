import { customNeighborhood, neighborhood } from './neighborhood';
import type { Model, Rule } from './types';

export type TemplateId = 'empty' | 'gol' | 'sir' | 'traffic' | 'fire' | 'brain';

export interface Template {
  id: TemplateId;
  name: string;
  category: 'Eigenes' | 'Klassiker' | 'Verkehr' | 'Biologie & Medizin' | 'Physik & Umwelt';
  description: string;
  defaultSize: { width: number; height: number };
  model: () => Model;
}

const rule = (target: number, conditions: Rule['conditions'], probability = 1, combine: Rule['combine'] = 'all'): Rule => ({
  target,
  combine,
  probability,
  conditions,
});

export const TEMPLATES: readonly Template[] = [
  {
    id: 'empty',
    name: 'Leeres Projekt',
    category: 'Eigenes',
    description: 'Zwei Zustände ohne Regeln – Zustände, Regeln und Nachbarschaft legst du selbst fest.',
    defaultSize: { width: 60, height: 40 },
    model: () => ({
      states: [
        { name: 'Leer', color: '#0f1a13', initialShare: 100, rules: [] },
        { name: 'Zustand 1', color: '#7cf283', initialShare: 0, rules: [] },
      ],
      neighborhood: neighborhood('moore'),
      boundary: { type: 'torus' },
    }),
  },
  {
    id: 'gol',
    name: 'Game of Life',
    category: 'Klassiker',
    description: 'Conways Klassiker: Geburt bei genau 3, Überleben bei 2 oder 3 lebenden Nachbarn.',
    defaultSize: { width: 80, height: 56 },
    model: () => ({
      states: [
        {
          name: 'Tot',
          color: '#0f1a13',
          initialShare: 70,
          rules: [rule(1, [{ type: 'neighborCount', states: [1], op: '=', value: 3 }])],
        },
        {
          name: 'Lebendig',
          color: '#7cf283',
          initialShare: 30,
          rules: [
            rule(
              0,
              [
                { type: 'neighborCount', states: [1], op: '<', value: 2 },
                { type: 'neighborCount', states: [1], op: '>', value: 3 },
              ],
              1,
              'any',
            ),
          ],
        },
      ],
      neighborhood: neighborhood('moore'),
      boundary: { type: 'torus' },
    }),
  },
  {
    id: 'sir',
    name: 'Epidemie (SIR)',
    category: 'Biologie & Medizin',
    description: 'Ansteckung mit 30 % Wahrscheinlichkeit pro Generation, Genesung nach 8 Generationen, nachlassende Immunität.',
    defaultSize: { width: 80, height: 56 },
    model: () => ({
      states: [
        {
          name: 'Gesund',
          color: '#3f7553',
          initialShare: 99.6,
          rules: [rule(1, [{ type: 'neighborCount', states: [1], op: '>=', value: 1 }], 0.3)],
        },
        { name: 'Infiziert', color: '#ff9a3c', initialShare: 0.4, rules: [rule(2, [{ type: 'age', op: '>=', value: 8 }])] },
        { name: 'Genesen', color: '#4ea3ff', initialShare: 0, rules: [rule(0, [{ type: 'age', op: '>=', value: 40 }], 0.1)] },
      ],
      neighborhood: neighborhood('moore'),
      boundary: { type: 'torus' },
    }),
  },
  {
    id: 'traffic',
    name: 'Verkehrsfluss (Regel 184)',
    category: 'Verkehr',
    description: 'Jede Zeile ist eine Fahrspur nach rechts. Ein Fahrzeug fährt, wenn die Zelle vor ihm frei ist – ab etwa 50 % Dichte entstehen Staus, die rückwärts wandern.',
    defaultSize: { width: 120, height: 40 },
    model: () => ({
      states: [
        {
          name: 'Straße',
          color: '#24302a',
          initialShare: 45,
          rules: [rule(1, [{ type: 'neighborAt', dx: -1, dy: 0, op: '!=', state: 0 }])],
        },
        {
          name: 'Fährt',
          color: '#4ea3ff',
          initialShare: 55,
          rules: [
            rule(0, [{ type: 'neighborAt', dx: 1, dy: 0, op: '=', state: 0 }]),
            rule(2, []),
          ],
        },
        {
          name: 'Steht',
          color: '#ff9a3c',
          initialShare: 0,
          rules: [rule(0, [{ type: 'neighborAt', dx: 1, dy: 0, op: '=', state: 0 }])],
        },
      ],
      neighborhood: customNeighborhood([{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }]),
      boundary: { type: 'torus' },
    }),
  },
  {
    id: 'fire',
    name: 'Waldbrand',
    category: 'Physik & Umwelt',
    description: 'Bäume wachsen nach, Feuer springt auf benachbarte Bäume über, selten schlägt ein Blitz ein.',
    defaultSize: { width: 100, height: 70 },
    model: () => ({
      states: [
        { name: 'Leer', color: '#1c1f1a', initialShare: 40, rules: [rule(1, [], 0.02)] },
        {
          name: 'Baum',
          color: '#2f6b3a',
          initialShare: 60,
          rules: [rule(2, [{ type: 'neighborCount', states: [2], op: '>=', value: 1 }]), rule(2, [], 0.0002)],
        },
        { name: 'Brennt', color: '#ff9a3c', initialShare: 0, rules: [rule(0, [])] },
      ],
      neighborhood: neighborhood('vonNeumann'),
      boundary: { type: 'fixed', state: 0 },
    }),
  },
  {
    id: 'brain',
    name: 'Brian’s Brain',
    category: 'Klassiker',
    description: 'Feuern, erholen, ruhen: Aus drei Zuständen entstehen wandernde Muster.',
    defaultSize: { width: 80, height: 56 },
    model: () => ({
      states: [
        {
          name: 'Ruhe',
          color: '#0f1a13',
          initialShare: 80,
          rules: [rule(1, [{ type: 'neighborCount', states: [1], op: '=', value: 2 }])],
        },
        { name: 'Feuert', color: '#e3ece5', initialShare: 10, rules: [rule(2, [])] },
        { name: 'Erholt', color: '#4ea3ff', initialShare: 10, rules: [rule(0, [])] },
      ],
      neighborhood: neighborhood('moore'),
      boundary: { type: 'torus' },
    }),
  },
];

export function getTemplate(id: TemplateId): Template {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unbekannte Vorlage: ${id}`);
  return t;
}
