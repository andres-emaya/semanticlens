// Retrieval engine. It has no file-system access, so the same code runs on the
// server (API route) and in the browser (static GitHub Pages version).
// Annotations are loaded from public/data/iaprtc12-eng.json (see scripts/build-data.mjs).

export type AnnotationRecord = {
  id: string;
  title: string;
  description: string;
  notes: string;
  location: string;
  date: string;
  image: string;
};

/** Returns true when the dataset image (e.g. "/iaprtc12/images/00/25.jpg") is available locally. */
export type DatasetImageCheck = (imageUrl: string) => boolean;

export type StemmerName = "none" | "porter" | "snowball" | "lancaster" | "manual";
export type RegexMode = "match" | "search" | "findall";
export type ZoneName = "all" | "title" | "description" | "notes" | "location" | "date";

export type SearchOptions = {
  query: string;
  regexMode?: RegexMode;
  stemmer?: StemmerName;
  zone?: ZoneName;
  enableSemantics?: boolean;
  enableCosine?: boolean;
  enableSpellCorrect?: boolean;
  enablePos?: boolean;
  enableContext?: boolean;
  limit?: number;
};

export type SearchHit = {
  id: string;
  title: string;
  description: string;
  notes: string;
  location: string;
  date: string;
  image: string;
  imageSource: "dataset" | "internet";
  imageCredit: string;
  score: number;
  reasons: string[];
  snippet: string;
};

export type SearchResponse = {
  hits: SearchHit[];
  correctedQuery: string;
  expandedTerms: string[];
  autocomplete: string[];
  missingKnowledge: string[];
  stats: {
    documents: number;
    vocabulary: number;
    mode: string;
  };
};

type Doc = {
  id: string;
  title: string;
  description: string;
  notes: string;
  location: string;
  date: string;
  image: string;
  zones: Record<ZoneName, string>;
  tokens: string[];
  positions: Map<string, number[]>;
  termFreq: Map<string, number>;
};

export type Index = {
  docs: Doc[];
  vocabulary: Set<string>;
  postings: Map<string, Set<number>>;
  docFreq: Map<string, number>;
  cooc: Map<string, Map<string, number>>;
};

const SEMANTIC_RESOURCES: Record<string, Record<string, string[]>> = {
  auto: {
    synonym: ["car", "automobile", "vehicle"],
    hypernym: ["transport"],
    meronym: ["engine", "wheel", "door"]
  },
  java: {
    synonym: ["coffee", "programming", "indonesia"],
    hypernym: ["language", "island", "beverage"],
    hyponym: ["javascript", "espresso"],
    meronym: ["class", "method", "bean"]
  },
  "programming languages": {
    synonym: ["code", "software", "programming"],
    hypernym: ["computer science"],
    hyponym: ["java", "python", "javascript"]
  },
  adhd: {
    synonym: ["attention deficit hyperactivity disorder"],
    hypernym: ["neurodevelopmental disorder"],
    hyponym: ["inattentive adhd", "hyperactive adhd"],
    related: ["attention", "impulsivity", "therapy"]
  },
  hotel: {
    synonym: ["accommodation", "hostel", "inn"],
    hypernym: ["building"],
    meronym: ["room", "lobby", "balcony"]
  },
  palm: {
    synonym: ["palm tree", "arecaceae"],
    hypernym: ["tree", "plant"],
    meronym: ["frond", "trunk"]
  },
  plaza: {
    synonym: ["square", "marketplace"],
    hypernym: ["public space"]
  }
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "de",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with"
]);

export function searchCollection(
  options: SearchOptions,
  index: Index,
  hasDatasetImage?: DatasetImageCheck
): SearchResponse {
  const rawQuery = options.query.trim();
  const correctedQuery = options.enableSpellCorrect ? correctQuery(rawQuery, index) : rawQuery;
  const query = correctedQuery || rawQuery;
  const zone = options.zone ?? "all";
  const stemmer = options.stemmer ?? "none";
  const limit = options.limit ?? 24;

  const expandedTerms = buildExpansion(query, index, {
    semantics: Boolean(options.enableSemantics),
    pos: Boolean(options.enablePos),
    context: Boolean(options.enableContext)
  });
  const baseTerms = normalize(query).filter((term) => !STOP_WORDS.has(term)).map((term) => stem(term, stemmer));
  const expandedQueryTerms = expandedTerms.map((term) => stem(term, stemmer));
  const queryTerms = unique([...baseTerms, ...expandedQueryTerms]);

  const mode = detectMode(query, options.regexMode);
  const candidateScores = new Map<number, { score: number; reasons: string[] }>();

  index.docs.forEach((doc, docIndex) => {
    const text = zoneText(doc, zone);
    const normalizedText = text.toLowerCase();
    const stemmedTokens = tokenize(text).map((token) => stem(token, stemmer));
    const reasons: string[] = [];
    let score = 0;
    let booleanRejected = false;

    if (options.regexMode) {
      const regexHit = regexMatch(text, query, options.regexMode);
      if (regexHit.count > 0) {
        score += regexHit.count * 4;
        reasons.push(`Regular Expression Matching (${options.regexMode})`);
      }
    }

    if (isExactQuery(query)) {
      const phrase = query.slice(1, -1).toLowerCase();
      if (normalizedText.includes(phrase)) {
        score += 30;
        reasons.push("Exact Matching (bi-word phrase)");
      }
    }

    const proximity = parseProximity(query);
    if (proximity && proximityMatch(doc, proximity.a, proximity.b, proximity.k, stemmer)) {
      score += 26;
      reasons.push(`Proximity Matching (/${proximity.k})`);
    }

    if (hasWildcard(query)) {
      const pattern = wildcardToRegExp(query);
      const hits = stemmedTokens.filter((token) => pattern.test(token));
      if (hits.length > 0) {
        score += hits.length * 8;
        reasons.push("Wildcard Matching");
      }
    }

    const booleanQuery = isBooleanQuery(query);
    if (booleanQuery) {
      const ok = evaluateBoolean(query, stemmedTokens);
      if (ok) {
        score += 24;
        reasons.push("Boolean Matching");
      } else {
        booleanRejected = true;
      }
    }

    const baseHits = baseTerms.filter((term) => stemmedTokens.includes(term));
    const expansionHits = expandedQueryTerms.filter((term) => stemmedTokens.includes(term));
    const termHits = unique([...baseHits, ...expansionHits]);
    if (baseHits.length > 0) {
      score += baseHits.length * (stemmer === "none" ? 14 : 17);
      if (baseHits.length === baseTerms.length && baseTerms.length > 1) score += 18;
      reasons.push(stemmer === "none" ? "Term Matching" : `Stem-based Matching (${stemmer})`);
    }
    if (expansionHits.length > 0) {
      score += expansionHits.length * 3;
    }

    if (options.enableCosine) {
      const cosine = cosineScore(queryTerms, doc, index, stemmer);
      if (cosine > 0) {
        score += cosine * 60;
        reasons.push("Cosine-based Matching (tf.idf)");
      }
    }

    if ((options.enableSemantics || options.enablePos || options.enableContext) && termHits.length > 0) {
      score += Math.min(18, termHits.length * 3);
      reasons.push(options.enablePos ? "POS-based Semantic Expansion" : "Semantics-based Matching");
    }

    if (score > 0 && !booleanRejected) {
      candidateScores.set(docIndex, { score, reasons: unique(reasons) });
    }
  });

  const missingKnowledge = findMissingKnowledge(query, expandedTerms, index);

  const hits = dedupeHits(
    [...candidateScores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .map(([docIndex, scored]) =>
        toHit(index.docs[docIndex], scored.score, scored.reasons, zone, hasDatasetImage)
      )
  ).slice(0, limit);

  return {
    hits,
    correctedQuery,
    expandedTerms,
    autocomplete: autocomplete(query, index),
    missingKnowledge,
    stats: {
      documents: index.docs.length,
      vocabulary: index.vocabulary.size,
      mode
    }
  };
}

export function buildIndex(records: AnnotationRecord[]): Index {
  const docs = records.map(createDoc);
  const vocabulary = new Set<string>();
  const postings = new Map<string, Set<number>>();
  const docFreq = new Map<string, number>();
  const cooc = new Map<string, Map<string, number>>();

  docs.forEach((doc, docIndex) => {
    const seen = new Set<string>();
    doc.tokens.forEach((token) => {
      vocabulary.add(token);
      seen.add(token);
      if (!postings.has(token)) postings.set(token, new Set());
      postings.get(token)?.add(docIndex);
    });
    seen.forEach((token) => docFreq.set(token, (docFreq.get(token) ?? 0) + 1));

    const compact = [...seen].slice(0, 40);
    compact.forEach((a) => {
      if (!cooc.has(a)) cooc.set(a, new Map());
      compact.forEach((b) => {
        if (a !== b) cooc.get(a)?.set(b, (cooc.get(a)?.get(b) ?? 0) + 1);
      });
    });
  });

  return { docs, vocabulary, postings, docFreq, cooc };
}

function createDoc(record: AnnotationRecord): Doc {
  const { id, title, description, notes, location, date, image } = record;
  const all = `${title} ${description} ${notes} ${location} ${date}`;
  const tokens = normalize(all);
  const positions = new Map<string, number[]>();
  const termFreq = new Map<string, number>();
  tokens.forEach((token, index) => {
    if (!positions.has(token)) positions.set(token, []);
    positions.get(token)?.push(index);
    termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
  });
  return {
    id,
    title,
    description,
    notes,
    location,
    date,
    image,
    zones: { all, title, description, notes, location, date },
    tokens,
    positions,
    termFreq
  };
}

function normalize(text: string): string[] {
  return tokenize(text).map((token) => token.toLowerCase());
}

function tokenize(text: string): string[] {
  // \p{L} keeps accented letters, so place names like "Iguaçu" or "Máncora" stay one word.
  return text.match(/\p{L}[\p{L}'-]*/gu) ?? [];
}

function zoneText(doc: Doc, zone: ZoneName): string {
  return doc.zones[zone] || doc.zones.all;
}

function stem(term: string, stemmer: StemmerName): string {
  const word = term.toLowerCase();
  if (stemmer === "none") return word;
  if (stemmer === "lancaster") return word.replace(/(ational|fulness|iveness|ation|ment|ing|ies|ed|s)$/i, "");
  if (stemmer === "manual") return word.replace(/(ing|ed|es|s)$/i, "").replace(/(ies)$/i, "y");
  return word
    .replace(/sses$/i, "ss")
    .replace(/ies$/i, "i")
    .replace(/(ational)$/i, "ate")
    .replace(/(fulness|iveness)$/i, "ful")
    .replace(/(ization|ation)$/i, "ize")
    .replace(/(ing|edly|ed|ly|s)$/i, "");
}

function regexMatch(text: string, query: string, mode: RegexMode) {
  try {
    const regex = new RegExp(query, mode === "findall" ? "gi" : "i");
    if (mode === "match") return { count: regex.exec(text)?.index === 0 ? 1 : 0 };
    if (mode === "search") return { count: regex.test(text) ? 1 : 0 };
    return { count: text.match(regex)?.length ?? 0 };
  } catch {
    return { count: 0 };
  }
}

function isExactQuery(query: string) {
  return /^".+"$/.test(query.trim());
}

function parseProximity(query: string) {
  const match = query.match(/^\s*([\p{L}'-]+)\s*\/([1-9]|10)\s*([\p{L}'-]+)\s*$/u);
  if (!match) return null;
  return { a: match[1].toLowerCase(), k: Number(match[2]), b: match[3].toLowerCase() };
}

function proximityMatch(doc: Doc, a: string, b: string, k: number, stemmer: StemmerName) {
  const left = stem(a, stemmer);
  const right = stem(b, stemmer);
  const positions = new Map<string, number[]>();
  doc.tokens.map((token) => stem(token, stemmer)).forEach((token, index) => {
    if (!positions.has(token)) positions.set(token, []);
    positions.get(token)?.push(index);
  });
  return (positions.get(left) ?? []).some((p1) =>
    (positions.get(right) ?? []).some((p2) => Math.abs(p1 - p2) <= k + 1)
  );
}

function hasWildcard(query: string) {
  return query.includes("*") && !query.includes(" ");
}

function wildcardToRegExp(query: string) {
  const escaped = query.toLowerCase().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function isBooleanQuery(query: string) {
  return /\b(and|or|not)\b/i.test(query);
}

function evaluateBoolean(query: string, tokens: string[]) {
  const terms = new Set(tokens.map((token) => token.toLowerCase()));
  const parts = query.toLowerCase().split(/\s+/);
  const valueOf = (term: string) => terms.has(term);
  if (parts.length === 3 && parts[1] === "and") return valueOf(parts[0]) && valueOf(parts[2]);
  if (parts.length === 3 && parts[1] === "or") return valueOf(parts[0]) || valueOf(parts[2]);
  if (parts.length === 4 && parts[1] === "and" && parts[2] === "not") {
    return valueOf(parts[0]) && !valueOf(parts[3]);
  }
  return parts.some((part) => valueOf(part));
}

function cosineScore(queryTerms: string[], doc: Doc, index: Index, stemmer: StemmerName) {
  const docTerms = new Map<string, number>();
  doc.tokens.map((token) => stem(token, stemmer)).forEach((token) => docTerms.set(token, (docTerms.get(token) ?? 0) + 1));
  const qtf = new Map<string, number>();
  queryTerms.forEach((term) => qtf.set(term, (qtf.get(term) ?? 0) + 1));
  let dot = 0;
  let qNorm = 0;
  let dNorm = 0;
  qtf.forEach((tf, term) => {
    const idf = Math.log((index.docs.length + 1) / ((index.docFreq.get(term) ?? 0) + 1)) + 1;
    const qWeight = tf * idf;
    const dWeight = (docTerms.get(term) ?? 0) * idf;
    dot += qWeight * dWeight;
    qNorm += qWeight * qWeight;
  });
  docTerms.forEach((tf, term) => {
    const idf = Math.log((index.docs.length + 1) / ((index.docFreq.get(term) ?? 0) + 1)) + 1;
    dNorm += (tf * idf) ** 2;
  });
  return qNorm && dNorm ? dot / (Math.sqrt(qNorm) * Math.sqrt(dNorm)) : 0;
}

function correctQuery(query: string, index: Index) {
  return query
    .split(/\s+/)
    .map((part) => {
      const clean = part.toLowerCase().replace(/[^\p{L}]/gu, "");
      if (!clean || index.vocabulary.has(clean) || SEMANTIC_RESOURCES[clean]) return part;
      const best = [...index.vocabulary].slice(0, 12000).reduce(
        (winner, term) => {
          const distance = levenshtein(clean, term);
          return distance < winner.distance ? { term, distance } : winner;
        },
        { term: clean, distance: 4 }
      );
      return best.distance <= 2 ? best.term : part;
    })
    .join(" ");
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function buildExpansion(
  query: string,
  index: Index,
  modes: { semantics: boolean; pos: boolean; context: boolean }
) {
  const terms = normalize(query);
  const expanded = new Set<string>();
  if (modes.semantics || modes.pos) {
    [...terms, query.toLowerCase()].forEach((term) => {
      const entry = SEMANTIC_RESOURCES[term];
      if (!entry) return;
      Object.values(entry).flat().forEach((value) => normalize(value).forEach((token) => expanded.add(token)));
    });
  }
  if (modes.pos) {
    terms.forEach((term) => guessPosExpansions(term).forEach((value) => expanded.add(value)));
  }
  if (modes.context) {
    terms.flatMap((term) => topCooccurring(term, index, 5)).forEach((term) => expanded.add(term));
  }
  terms.forEach((term) => expanded.delete(term));
  return [...expanded].filter((term) => !STOP_WORDS.has(term) && term.length > 1).slice(0, 20);
}

function guessPosExpansions(term: string) {
  if (term.endsWith("ing")) return [term.replace(/ing$/, "")];
  if (term.endsWith("ion")) return [term.replace(/ion$/, "e")];
  if (term.endsWith("s") && term.length > 4) return [term.replace(/s$/, "")];
  return [];
}

function topCooccurring(term: string, index: Index, count: number) {
  return [...(index.cooc.get(term)?.entries() ?? [])]
    .filter(([value]) => !STOP_WORDS.has(value) && value.length > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([value]) => value);
}

function findMissingKnowledge(query: string, expandedTerms: string[], index: Index) {
  return normalize(query)
    .filter((term) => !STOP_WORDS.has(term) && !SEMANTIC_RESOURCES[term] && !expandedTerms.includes(term))
    .filter((term) => index.vocabulary.has(term))
    .slice(0, 5)
    .map((term) => {
      const suggestions = topCooccurring(term, index, 3).join(", ") || "no strong corpus neighbors";
      return `${term}: missing in ontology; suggest enrichment with ${suggestions} (corpus-estimated NGD/co-occurrence).`;
    });
}

function autocomplete(query: string, index: Index) {
  const terms = normalize(query);
  const last = terms.at(-1);
  if (!last) return ["hotel", "palm", "plaza", "market", "mountain"];
  return topCooccurring(last, index, 5);
}

function detectMode(query: string, regexMode?: RegexMode) {
  if (regexMode) return `Regex ${regexMode}`;
  if (isExactQuery(query)) return "Exact phrase";
  if (parseProximity(query)) return "Proximity";
  if (hasWildcard(query)) return "Wildcard";
  if (isBooleanQuery(query)) return "Boolean";
  return "Ranked retrieval";
}

function toHit(
  doc: Doc,
  score: number,
  reasons: string[],
  zone: ZoneName,
  hasDatasetImage?: DatasetImageCheck
): SearchHit {
  const image = resolveImage(doc, hasDatasetImage);
  return {
    id: doc.id,
    title: doc.title || "Untitled image annotation",
    description: doc.description,
    notes: doc.notes,
    location: doc.location,
    date: doc.date,
    ...image,
    score: Number(score.toFixed(2)),
    reasons,
    snippet: zoneText(doc, zone).slice(0, 220) || doc.title
  };
}

function resolveImage(doc: Doc, hasDatasetImage?: DatasetImageCheck) {
  const datasetUrl = doc.image ? `/iaprtc12/${doc.image}` : "";

  if (datasetUrl && hasDatasetImage?.(datasetUrl)) {
    return {
      image: datasetUrl,
      imageSource: "dataset" as const,
      imageCredit: "CLEF iaprtc12 dataset image"
    };
  }

  return {
    image: internetImageFor(doc),
    imageSource: "internet" as const,
    imageCredit: "Internet fallback image - not from the dataset"
  };
}

function internetImageFor(doc: Doc) {
  const text = `${doc.title} ${doc.description} ${doc.notes} ${doc.location}`.toLowerCase();
  const images = {
    city: "https://images.unsplash.com/photo-1518005020951-eccb494ad742",
    coffee: "https://images.unsplash.com/photo-1509042239860-f550ce710b93",
    programming: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4",
    medical: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d",
    tropical: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
    landscape: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    bridge: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29",
    hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945",
    compass: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
    animal: "https://images.unsplash.com/photo-1517849845537-4d257902454a"
  };

  if (/golden gate|bridge/.test(text)) return `${images.bridge}?auto=format&fit=crop&w=900&q=80`;
  if (/hotel|room|accommodation|hostel|inn/.test(text)) return `${images.hotel}?auto=format&fit=crop&w=900&q=80`;
  if (/compass|map|navigation|direction/.test(text)) return `${images.compass}?auto=format&fit=crop&w=900&q=80`;
  if (/horse|animal|bird|dog|cat/.test(text)) return `${images.animal}?auto=format&fit=crop&w=900&q=80`;
  if (/java|programming|language|class|code/.test(text)) return `${images.programming}?auto=format&fit=crop&w=900&q=80`;
  if (/adhd|medical|therapy|disorder/.test(text)) return `${images.medical}?auto=format&fit=crop&w=900&q=80`;
  if (/coffee|farm|bean/.test(text)) return `${images.coffee}?auto=format&fit=crop&w=900&q=80`;
  if (/palm|beach|island|tree/.test(text)) return `${images.tropical}?auto=format&fit=crop&w=900&q=80`;
  if (/plaza|city|hotel|church|street|square|cuzco|lima|arequipa/.test(text)) return `${images.city}?auto=format&fit=crop&w=900&q=80`;
  return `${images.landscape}?auto=format&fit=crop&w=900&q=80`;
}

function dedupeHits(hits: SearchHit[]) {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.title}|${hit.location}|${hit.date}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}
