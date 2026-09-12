import type { ReactNode } from 'react';
import type { Point3 } from '../shared/types';

/** One piece of work: a board, the form standing on it, and where to frame that form on its own.
 *  The element is shared by the canvas and the inspector, so both show the same geometry and
 *  materials rather than two copies that can drift apart. */
export type Study = {
  id: string;
  label: string;
  board: string;
  /** Board centre on the review plane. */
  at: [number, number];
  /** How far the form stands off its board. */
  lift: number;
  /** Camera distance that frames this form alone; the four differ enough in size to need it. */
  frame: number;
  /** Corner of the board the inspect control sits on. */
  badge: Point3;
  /** Fictional part data, shown in the inspector. Review tools are judged on what they say about
   *  the thing under review, not only on the geometry, so each form carries its own sheet. */
  code: string;
  description: string;
  specs: { label: string; value: string }[];
  form: ReactNode;
};

export const studies: Study[] = [
  {
    id: 'ring', label: 'Ring study', board: '#e0e7dc', at: [-3.3, 2.25], lift: 1, frame: 4.4, badge: [-1.05, 3.6, 0.1],
    code: 'FRM-001',
    description: 'A closed loop with a softened outer radius, studied for the way a single light source travels around the section.',
    specs: [{ label: 'Material', value: 'Powder-coated steel' }, { label: 'Mass', value: '412 g' }, { label: 'Dimensions', value: 'Ø 188 × 78 mm' }, { label: 'Finish', value: 'Matte, 20 GU' }],
    form: <mesh rotation={[0.38, -0.4, 0.1]} castShadow receiveShadow>
      <torusGeometry args={[0.94, 0.39, 32, 80]} /><meshStandardMaterial color="#567b63" roughness={0.32} metalness={0.12} />
    </mesh>,
  },
  {
    id: 'block', label: 'Block study', board: '#f0e0ce', at: [3.3, 2.25], lift: 1, frame: 6.2, badge: [5.55, 3.6, 0.1],
    code: 'FRM-002',
    description: 'A cased volume with an inset front face, testing how a shallow recess reads against a warm finish.',
    specs: [{ label: 'Material', value: 'Anodised aluminium' }, { label: 'Mass', value: '860 g' }, { label: 'Dimensions', value: '190 × 180 × 160 mm' }, { label: 'Finish', value: 'Bead blasted' }],
    form: <group rotation={[0.28, -0.45, -0.13]}>
      <mesh castShadow receiveShadow><boxGeometry args={[1.9, 1.8, 1.6]} /><meshStandardMaterial color="#cf8856" roughness={0.6} /></mesh>
      <mesh position={[0, 0, 0.83]}><boxGeometry args={[1.35, 1.22, 0.06]} /><meshStandardMaterial color="#e2aa78" roughness={0.6} /></mesh>
    </group>,
  },
  {
    id: 'facet', label: 'Facet study', board: '#e0e5e8', at: [-3.3, -2.25], lift: 0.98, frame: 4.6, badge: [-1.05, -0.9, 0.1],
    code: 'FRM-003',
    description: 'A twenty-sided solid, used to judge how flat facets break one light source into steps.',
    specs: [{ label: 'Material', value: 'Cast resin' }, { label: 'Mass', value: '540 g' }, { label: 'Dimensions', value: 'Ø 130 mm' }, { label: 'Finish', value: 'Unpolished' }],
    form: <mesh rotation={[0.18, 0.32, 0.4]} castShadow receiveShadow>
      <icosahedronGeometry args={[1.3, 0]} /><meshStandardMaterial color="#76959e" roughness={0.48} flatShading />
    </mesh>,
  },
  {
    id: 'stack', label: 'Stack study', board: '#e9dfd3', at: [3.3, -2.25], lift: 0.6, frame: 5.4, badge: [5.55, -0.9, 0.1],
    code: 'FRM-004',
    description: 'Three discs of decreasing radius, checking the rhythm of the gaps between layers.',
    specs: [{ label: 'Material', value: 'Oiled beech' }, { label: 'Mass', value: '295 g' }, { label: 'Dimensions', value: 'Ø 210 × 120 mm' }, { label: 'Finish', value: 'Hand oiled' }],
    form: <group rotation={[0.48, -0.3, 0.12]}>
      {[0, 0.45, 0.9].map((z, i) => <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.05 - i * 0.12, 1.05 - i * 0.12, 0.3, 64]} />
        <meshStandardMaterial color={['#ac977c', '#c3ad8c', '#dfceb0'][i]} roughness={0.65} />
      </mesh>)}
    </group>,
  },
];

/** The form under the name both scene graphs resolve anchors through. Rendering it from here is
 *  what keeps the canvas and the inspector showing one piece of work rather than two copies. */
export function Form({ study }: { study: Study }) {
  return <group name={`form-${study.id}`}>{study.form}</group>;
}
