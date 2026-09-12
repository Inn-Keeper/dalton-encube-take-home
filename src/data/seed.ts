import type { Thread } from '../shared/types';

export const currentUser = 'Dalton';

// Anchored in form-local space and taken from real surface hits, so each note sits on its form in
// the canvas and in the inspector alike, and follows the surface when the form is turned.
export const seedThreads: Thread[] = [
  { id: 'ring-note', anchor: [-0.19, 0.625, 0.588], on: 'form-ring', resolved: false, messages: [
    { id: 'm1', author: 'Maya', createdAt: '2026-09-11T08:40:00Z', text: 'The softer edge is working well. Could we carry this radius into the rest of the collection?' },
    { id: 'm2', author: 'Leo', createdAt: '2026-09-11T08:44:00Z', text: 'Agreed. It gives the forms a more consistent character.' },
  ] },
  { id: 'block-note', anchor: [0.361, 0.414, 1.225], on: 'form-block', resolved: false, messages: [
    { id: 'm3', author: 'Leo', createdAt: '2026-09-11T09:10:00Z', text: 'Let’s compare this warm finish with the green version before choosing a direction.' },
  ] },
  { id: 'stack-note', anchor: [0.689, -0.308, 0.788], on: 'form-stack', resolved: true, messages: [
    { id: 'm4', author: 'Nora', createdAt: '2026-09-11T09:20:00Z', text: 'The spacing between the layers feels balanced now. Ready for the next review.' },
  ] },
];
