// The steps of the Zettelkasten trail on the ontology page. Each node is the title of an example note
// in ontologies/zettelkasten/Examples; a test checks that they all exist.
export interface Step {
  title: string;
  nodes: string[];
  text: string;
}

export const STEPS: Step[] = [
  {
    title: 'Capture',
    nodes: ['Folders are enough'],
    text: 'A thought arrives. You write it down as a <b>fleeting note</b>, with no polish, and deal with it within a day or two. Its <code>status</code> says whether it is still in the inbox.',
  },
  {
    title: 'Read',
    nodes: ['How to Take Smart Notes', 'Sönke Ahrens', 'Writing is the medium of thinking (highlight)'],
    text: 'You read a <b>book</b> or an <b>article</b>. It has a <b>writer</b>, and each passage you mark becomes a <b>highlight</b> that points back to its source with <code>highlighted_in</code>.',
  },
  {
    title: 'Rewrite',
    nodes: ['Ahrens: write to think'],
    text: 'A <b>literature note</b> says what the source means in your own words. It must <code>cites</code> its source and can say which highlight it is <code>based_on</code>.',
  },
  {
    title: 'Distil',
    nodes: ['Write for your future self', 'Writing is how thinking happens'],
    text: 'An idea worth keeping becomes a <b>permanent note</b>: one idea, standing alone. <code>derived_from</code> keeps the trail back to the literature note.',
  },
  {
    title: 'Connect',
    nodes: ['Notes are only useful when linked'],
    text: 'Permanent notes link to each other with <code>extends</code>, <code>supports</code>, <code>example_of</code> and <code>follows</code>. A permanent note can reject an earlier thought with a dashed red <code>contradicts</code>, and the fleeting note is <code>processed_into</code> it.',
  },
  {
    title: 'Structure',
    nodes: ['Note-taking index'],
    text: 'A <b>structure note</b> is a hub: it <code>indexes</code> permanent notes in reading order, so you can find your way back in.',
  },
  {
    title: 'Write',
    nodes: ['Thesis chapter on note-taking'],
    text: 'A <b>project note</b> <code>draws_on</code> the notes you already have, so writing starts from what you know instead of a blank page.',
  },
];
