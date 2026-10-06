import { BUILTIN_PREFIXES, type PropertyKind } from '../schema/schema.js';

export const RDF = BUILTIN_PREFIXES.rdf!;
export const XSD = BUILTIN_PREFIXES.xsd!;
export const SH = BUILTIN_PREFIXES.sh!;
export const TGS = BUILTIN_PREFIXES.tgs!;

/** Datatype written for each property kind; `link` uses `sh:nodeKind sh:IRI` instead. */
export const KIND_DATATYPE: Record<Exclude<PropertyKind, 'link'>, string> = {
  text: `${XSD}string`,
  list: `${XSD}string`,
  number: `${XSD}decimal`,
  boolean: `${XSD}boolean`,
  date: `${XSD}date`,
  datetime: `${XSD}dateTime`,
};

/** Kind read back from a datatype; anything else becomes text and is reported. */
export const DATATYPE_KIND: Record<string, PropertyKind> = {
  [`${XSD}string`]: 'text',
  [`${RDF}langString`]: 'text',
  [`${XSD}normalizedString`]: 'text',
  [`${XSD}token`]: 'text',
  [`${XSD}decimal`]: 'number',
  [`${XSD}integer`]: 'number',
  [`${XSD}int`]: 'number',
  [`${XSD}long`]: 'number',
  [`${XSD}short`]: 'number',
  [`${XSD}double`]: 'number',
  [`${XSD}float`]: 'number',
  [`${XSD}nonNegativeInteger`]: 'number',
  [`${XSD}positiveInteger`]: 'number',
  [`${XSD}boolean`]: 'boolean',
  [`${XSD}date`]: 'date',
  [`${XSD}dateTime`]: 'datetime',
  [`${XSD}anyURI`]: 'link',
};

/** Local name of an IRI: the part after the last `#`, `/` or `:`, percent-decoded. */
export function localName(iri: string): string {
  const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'), iri.lastIndexOf(':'));
  const raw = iri.slice(i + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
