"use client";

import { FormEvent, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  Clock3,
  Cpu,
  Eye,
  FileSearch,
  FileText,
  Gauge,
  ImageIcon,
  Layers3,
  Loader2,
  Network,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  TimerReset,
  TriangleAlert,
  Wand2,
  Zap,
  type LucideIcon
} from "lucide-react";

import { isStaticSite, searchInBrowser } from "@/lib/search-client";

type StemmerName = "none" | "porter" | "snowball" | "lancaster" | "manual";
type RegexMode = "" | "match" | "search" | "findall";
type ZoneName = "all" | "title" | "description" | "notes" | "location" | "date";
type Group = "All" | "Lexical" | "Semantic" | "Ranking" | "Interface";

type SearchHit = {
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

type SearchResponse = {
  hits: SearchHit[];
  correctedQuery: string;
  expandedTerms: string[];
  autocomplete: string[];
  missingKnowledge: string[];
  stats: { documents: number; vocabulary: number; mode: string };
};

type SearchRequest = {
  query: string;
  regexMode?: Exclude<RegexMode, "">;
  stemmer: StemmerName;
  zone: ZoneName;
  enableSemantics: boolean;
  enableCosine: boolean;
  enableSpellCorrect: boolean;
  enablePos: boolean;
  enableContext: boolean;
  limit: number;
};

type Preset = Partial<SearchRequest> & { label: string; subtitle: string; query: string };

const presets: Preset[] = [
  { label: "Landmark Boolean", subtitle: "A and B retrieval", query: "Plaza and Armas", enableSemantics: true, enableCosine: true, enableContext: true },
  { label: "Regex Sweep", subtitle: "findall over titles", query: "[a-zA-Z]*", regexMode: "findall", zone: "title", enableCosine: false },
  { label: "Exact Phrase", subtitle: "quoted phrase lookup", query: "\"Plaza Hotel\"", enableCosine: true },
  { label: "Near Terms", subtitle: "A /k B proximity", query: "Palm /2 Tree", stemmer: "porter", enableCosine: true },
  { label: "Wildcard Lens", subtitle: "middle wildcard", query: "com*s", stemmer: "snowball" },
  { label: "Polysemy Probe", subtitle: "semantic sense hints", query: "Java", enableSemantics: true, enablePos: true, enableContext: true },
  { label: "Medical Knowledge", subtitle: "MeSH-style expansion", query: "ADHD", enableSemantics: true, enablePos: true, enableSpellCorrect: true }
];


const suggestionGroups: Array<{ title: string; hint: string; items: Preset[] }> = [
  {
    title: "Dataset Landmarks",
    hint: "Real places and objects that appear often in CLEF captions.",
    items: [
      { label: "Golden Gate Bridge", subtitle: "landmark photos", query: "Golden Gate Bridge", enableCosine: true, stemmer: "porter" },
      { label: "Plaza de Armas", subtitle: "city squares", query: "Plaza and Armas", enableCosine: true, enableSemantics: true },
      { label: "Plaza Hotel", subtitle: "exact phrase", query: "\"Plaza Hotel\"", enableCosine: true },
      { label: "Church in Cusco", subtitle: "title/notes match", query: "Church Cusco", enableCosine: true, enableContext: true }
    ]
  },
  {
    title: "Nature and Travel",
    hint: "Good visual queries for the image collection.",
    items: [
      { label: "Palm Trees", subtitle: "proximity query", query: "Palm /2 Tree", stemmer: "porter", enableCosine: true },
      { label: "Beach", subtitle: "ranked retrieval", query: "Beach", enableCosine: true, zone: "all" },
      { label: "Mountain", subtitle: "landscape captions", query: "Mountain", enableCosine: true, enableContext: true },
      { label: "Market", subtitle: "travel scenes", query: "Market", enableCosine: true, enableContext: true }
    ]
  },
  {
    title: "Operators to Present",
    hint: "Operator examples for advanced searches.",
    items: [
      { label: "Regex Titles", subtitle: "findall", query: "[a-zA-Z]*", regexMode: "findall", zone: "title", enableCosine: false },
      { label: "Wildcard", subtitle: "com*s", query: "com*s", stemmer: "snowball" },
      { label: "Boolean NOT", subtitle: "hotel without beach", query: "Hotel and not Beach", enableCosine: true },
      { label: "Zone Title", subtitle: "hotel in title", query: "Hotel", zone: "title", enableCosine: true }
    ]
  },
  {
    title: "Semantic Probes",
    hint: "Queries that demonstrate expansion and polysemy.",
    items: [
      { label: "Java", subtitle: "polysemy", query: "Java", enableSemantics: true, enablePos: true, enableContext: true, enableCosine: true },
      { label: "Auto", subtitle: "synonyms/hypernyms", query: "Auto", enableSemantics: true, enableContext: true },
      { label: "Programming Languages", subtitle: "semantic phrase", query: "Programming Languages", enableSemantics: true, enablePos: true, enableCosine: true },
      { label: "ADHD", subtitle: "MeSH-style", query: "ADHD", enableSemantics: true, enablePos: true, enableSpellCorrect: true }
    ]
  }
];

const starterSuggestions = suggestionGroups.flatMap((group) => group.items).slice(0, 8);
const groups: Group[] = ["All", "Lexical", "Semantic", "Ranking", "Interface"];

const features: Array<{ id: string; group: Exclude<Group, "All">; name: string; pro: string; text: string; icon: LucideIcon }> = [
  { id: "01", group: "Lexical", name: "Regular Expression Matching", pro: "Regular Expression Matching", text: "match, search, and findall over the chosen zone.", icon: Terminal },
  { id: "02", group: "Lexical", name: "Stem-based Matching", pro: "Stem-based Matching", text: "Porter, Snowball, Lancaster, manual, or raw terms.", icon: Cpu },
  { id: "03", group: "Lexical", name: "Boolean Matching", pro: "Boolean Matching", text: "A and B, A or B, and A and not B filtering.", icon: Network },
  { id: "04", group: "Lexical", name: "Exact Matching", pro: "Exact Matching", text: "Quoted expressions retrieved as exact phrases.", icon: FileText },
  { id: "05", group: "Lexical", name: "Proximity Matching", pro: "Proximity Matching", text: "A /k B windows where k is between 1 and 10.", icon: TimerReset },
  { id: "06", group: "Lexical", name: "Wildcard Matching", pro: "Wildcard Matching", text: "Leading, trailing, and middle wildcard patterns.", icon: Zap },
  { id: "07", group: "Interface", name: "Zone-based Matching", pro: "Zone-based Matching", text: "Title, description, notes, location, date, or all zones.", icon: SlidersHorizontal },
  { id: "08", group: "Semantic", name: "Semantics-based Matching", pro: "Semantics-based Matching", text: "WordNet, MeSH, and YAGO-style relation expansion.", icon: BrainCircuit },
  { id: "09", group: "Ranking", name: "Cosine-based Matching", pro: "Cosine-based Matching", text: "tf.idf evidence used to rank candidate annotations.", icon: BarChart3 },
  { id: "10", group: "Interface", name: "Spell-corrected Match", pro: "Spell-corrected Match", text: "Likely spelling mistakes corrected before retrieval.", icon: ShieldCheck },
  { id: "11", group: "Semantic", name: "POS-based Matching", pro: "POS-based Matching", text: "POS hints guide semantic enrichment.", icon: Activity },
  { id: "12", group: "Semantic", name: "Context-aware Query Expansion", pro: "Context-aware Query Expansion", text: "Context and co-occurrence suggest expansion terms.", icon: Sparkles },
  { id: "13", group: "Semantic", name: "Missing Background Knowledge Handler", pro: "Missing Background Knowledge Handler", text: "Corpus co-occurrence suggests missing ontology entities.", icon: TriangleAlert },
  { id: "14", group: "Interface", name: "Query Auto-completion Module", pro: "Query Auto-completion Module", text: "Up to five next-term suggestions from the collection.", icon: Wand2 }
];

const pipeline = ["Parse query", "Normalize zones", "Expand knowledge", "Score tf.idf", "Rank images"];

export default function Home() {
  const [query, setQuery] = useState("Plaza and Armas");
  const [regexMode, setRegexMode] = useState<RegexMode>("");
  const [stemmer, setStemmer] = useState<StemmerName>("none");
  const [zone, setZone] = useState<ZoneName>("all");
  const [enableSemantics, setEnableSemantics] = useState(true);
  const [enableCosine, setEnableCosine] = useState(true);
  const [enableSpellCorrect, setEnableSpellCorrect] = useState(true);
  const [enablePos, setEnablePos] = useState(false);
  const [enableContext, setEnableContext] = useState(true);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeGroup, setActiveGroup] = useState<Group>("All");

  const activeModules = useMemo(
    () =>
      [
        regexMode ? "Regular Expression Matching" : "",
        stemmer !== "none" ? "Stem-based Matching" : "",
        /\b(and|or|not)\b/i.test(query) ? "Boolean Matching" : "",
        query.trim().startsWith("\"") ? "Exact Matching" : "",
        /\/([1-9]|10)/.test(query) ? "Proximity Matching" : "",
        query.includes("*") ? "Wildcard Matching" : "",
        zone !== "all" ? "Zone-based Matching" : "",
        enableSemantics ? "Semantics-based Matching" : "",
        enableCosine ? "Cosine-based Matching" : "",
        enableSpellCorrect ? "Spell-corrected Match" : "",
        enablePos ? "POS-based Matching" : "",
        enableContext ? "Context-aware Query Expansion" : "",
        "Missing Background Knowledge Handler",
        "Query Auto-completion Module"
      ].filter(Boolean),
    [enableContext, enableCosine, enablePos, enableSemantics, enableSpellCorrect, query, regexMode, stemmer, zone]
  );

  const visibleFeatures = activeGroup === "All" ? features : features.filter((item) => item.group === activeGroup);

  const payload = (): SearchRequest => ({
    query,
    ...(regexMode ? { regexMode: regexMode as Exclude<RegexMode, ""> } : {}),
    stemmer,
    zone,
    enableSemantics,
    enableCosine,
    enableSpellCorrect,
    enablePos,
    enableContext,
    limit: 24
  });

  async function runSearch(event?: FormEvent, overrides: Partial<SearchRequest> = {}) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const request = { ...payload(), ...overrides };
      let result: SearchResponse;
      if (isStaticSite) {
        // Static GitHub Pages version: the engine runs in the browser.
        result = await searchInBrowser(request);
      } else {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request)
        });
        if (!response.ok) throw new Error("The search API returned an error.");
        result = (await response.json()) as SearchResponse;
      }
      setData(result);
      window.requestAnimationFrame(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset: Preset) {
    const nextStemmer = preset.stemmer ?? stemmer;
    const nextZone = preset.zone ?? "all";
    const nextRegex = preset.regexMode ?? "";
    const nextSemantics = preset.enableSemantics ?? enableSemantics;
    const nextCosine = preset.enableCosine ?? enableCosine;
    const nextSpell = preset.enableSpellCorrect ?? enableSpellCorrect;
    const nextPos = preset.enablePos ?? enablePos;
    const nextContext = preset.enableContext ?? enableContext;

    setQuery(preset.query);
    setRegexMode(nextRegex);
    setStemmer(nextStemmer);
    setZone(nextZone);
    setEnableSemantics(nextSemantics);
    setEnableCosine(nextCosine);
    setEnableSpellCorrect(nextSpell);
    setEnablePos(nextPos);
    setEnableContext(nextContext);

    void runSearch(undefined, {
      query: preset.query,
      regexMode: preset.regexMode,
      stemmer: nextStemmer,
      zone: nextZone,
      enableSemantics: nextSemantics,
      enableCosine: nextCosine,
      enableSpellCorrect: nextSpell,
      enablePos: nextPos,
      enableContext: nextContext,
      limit: 24
    });
  }

  function appendTerm(term: string) {
    setQuery(`${query.trim()} ${term}`.trim());
  }
  return (
    <main className="studio-shell min-h-screen overflow-hidden text-[#f8f4ea]">
      <div className="studio-grid" aria-hidden="true" />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#101315]/90 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <a href="#search-lab" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f05d3b] text-white shadow-[0_8px_30px_rgba(240,93,59,0.35)]">
              <BrainCircuit size={20} />
            </span>
            <span>
              <span className="block text-sm font-black tracking-wide">SemanticLens</span>
              <span className="block text-xs text-[#c7d2cc]">CLEF Retrieval Studio</span>
            </span>
          </a>
          <div className="hidden items-center gap-2 text-sm text-[#d8ded8] md:flex">
            <a className="rounded-md px-3 py-2 transition hover:bg-white/10" href="#search-lab">Search Lab</a>
            <a className="rounded-md px-3 py-2 transition hover:bg-white/10" href="#capabilities">Capabilities</a>
            <a className="rounded-md px-3 py-2 transition hover:bg-white/10" href="#results">Results</a>

          </div>
          <button
            type="button"
            onClick={() => applyPreset(presets[0])}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#f8f4ea] px-4 text-sm font-black text-[#101315] transition hover:bg-white"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <FileSearch size={16} />}
            Run Demo
          </button>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-8 px-5 pb-8 pt-8 lg:grid-cols-[1fr_450px] lg:px-8 lg:pb-12 lg:pt-12">
        <div className="relative z-10 flex min-h-[520px] flex-col justify-between">
          <div>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#f7c66a]/30 bg-[#f7c66a]/10 px-3 py-1 text-sm font-bold text-[#ffe7a8]">
              <BadgeCheck size={16} />
              CLEF image retrieval workspace
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="max-w-4xl text-5xl font-black leading-[0.94] tracking-normal text-[#fffaf0] md:text-7xl">
              Semantic image search with visible NLP intelligence.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-6 max-w-2xl text-lg leading-8 text-[#d6ded5]">
              Search CLEF iaprtc12 annotations through lexical matching, ontology-style expansion, tf.idf ranking, spelling repair, query completion, and context-aware suggestions.
            </motion.p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Metric icon={FileText} label="Collection" value={data?.stats.documents.toLocaleString() ?? "20,000"} detail="annotations" />
            <Metric icon={Layers3} label="Vocabulary" value={data?.stats.vocabulary.toLocaleString() ?? "indexed"} detail="terms" />
            <Metric icon={Gauge} label="Mode" value={data?.stats.mode ?? "ready"} detail="detected live" />
          </div>
        </div>

        <motion.aside initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="relative z-10 overflow-hidden rounded-lg border border-white/15 bg-[#181d1f]/85 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="signal-sweep" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#7ddac8]">Live Pipeline</p>
                <h2 className="mt-1 text-2xl font-black">Retrieval Flow Monitor</h2>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#7ddac8]/12 text-[#7ddac8]"><Activity size={21} /></span>
            </div>
            <div className="mt-6 space-y-3">
              {pipeline.map((stage, index) => (
                <motion.div key={stage} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + index * 0.08 }} className="grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-white/[0.045] px-3 py-3">
                  <span className="pipeline-dot flex h-8 w-8 items-center justify-center rounded-md bg-[#f05d3b] text-sm font-black text-white">{index + 1}</span>
                  <span className="font-bold text-[#f8f4ea]">{stage}</span>
                  <span className="text-xs font-black uppercase tracking-wide text-[#f7c66a]">online</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 rounded-md border border-white/10 bg-[#0f1213] p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-bold text-[#d8ded8]">Active modules</span>
                <span className="text-[#7ddac8]">{activeModules.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeModules.slice(0, 8).map((module) => (
                  <span key={module} className="rounded-md bg-[#f8f4ea] px-2.5 py-1.5 text-xs font-black text-[#111315]">{module}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.aside>
      </section>

      <section id="search-lab" className="relative z-10 border-y border-[#151815] bg-[#f8f4ea] text-[#151815]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
          <form onSubmit={runSearch} className="rounded-lg border border-[#d8d0bd] bg-white p-5 shadow-[0_20px_60px_rgba(35,31,22,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ece4d4] pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f05d3b]">Search Lab</p>
                <h2 className="mt-1 text-3xl font-black">Interactive Query Console</h2>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-[#151815] px-3 py-2 text-sm font-black text-[#f8f4ea]"><Clock3 size={16} /> real-time controls</div>
            </div>
            <label className="mt-5 block text-sm font-bold text-[#4d504a]">Query input</label>
            <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-14 rounded-md border border-[#cfc6b4] bg-[#fffdf7] px-4 text-lg font-bold outline-none transition focus:border-[#f05d3b]" placeholder="Choose a suggestion below, or try Golden Gate Bridge" />
              <button type="submit" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-[#f05d3b] px-6 font-black text-white shadow-[0_12px_28px_rgba(240,93,59,0.28)] transition hover:bg-[#d94f32]">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                Execute Search
              </button>
            </div>
            <section className="mt-5 rounded-lg border border-[#eadfca] bg-[#fff9ec] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f05d3b]">Starter Queries</p>
                  <h3 className="mt-1 text-lg font-black text-[#151815]">Click a real CLEF topic or search example</h3>
                </div>
                <span className="rounded-md bg-[#151815] px-2.5 py-1.5 text-xs font-black text-[#f8f4ea]">no guessing needed</span>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {starterSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.label}-${suggestion.query}`}
                    type="button"
                    onClick={() => applyPreset(suggestion)}
                    className="min-w-[170px] rounded-md border border-[#d8d0bd] bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#f05d3b] hover:shadow-[0_10px_24px_rgba(35,31,22,0.10)]"
                  >
                    <span className="block text-sm font-black text-[#151815]">{suggestion.label}</span>
                    <span className="mt-1 block text-xs font-bold text-[#6d7068]">{suggestion.subtitle}</span>
                  </button>
                ))}
              </div>
            </section>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Select label="Regex Function" value={regexMode} onChange={(value) => setRegexMode(value as RegexMode)} options={["", "match", "search", "findall"]} />
              <Select label="Stemmer" value={stemmer} onChange={(value) => setStemmer(value as StemmerName)} options={["none", "porter", "snowball", "lancaster", "manual"]} />
              <Select label="Search Zone" value={zone} onChange={(value) => setZone(value as ZoneName)} options={["all", "title", "description", "notes", "location", "date"]} />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Toggle label="Semantics-based Matching" checked={enableSemantics} onChange={setEnableSemantics} />
              <Toggle label="Cosine-based Matching" checked={enableCosine} onChange={setEnableCosine} />
              <Toggle label="Spell-corrected Match" checked={enableSpellCorrect} onChange={setEnableSpellCorrect} />
              <Toggle label="POS-based Matching" checked={enablePos} onChange={setEnablePos} />
              <Toggle label="Context-aware Expansion" checked={enableContext} onChange={setEnableContext} />
            </div>
          </form>

          <aside className="rounded-lg border border-[#d8d0bd] bg-[#151815] p-5 text-[#f8f4ea] shadow-[0_20px_60px_rgba(35,31,22,0.20)]">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#7ddac8]">Query Library</p><h3 className="mt-1 text-xl font-black">Dataset-aware suggestions</h3></div>
              <Sparkles className="text-[#f7c66a]" size={22} />
            </div>
            <div className="mt-4 max-h-[620px] space-y-4 overflow-y-auto pr-1">
              {suggestionGroups.map((group) => (
                <section key={group.title} className="rounded-md border border-white/10 bg-white/[0.035] p-3">
                  <div className="mb-2">
                    <h4 className="font-black text-[#f8f4ea]">{group.title}</h4>
                    <p className="mt-0.5 text-xs leading-5 text-[#bfc8c0]">{group.hint}</p>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((preset) => (
                      <button key={`${group.title}-${preset.label}`} type="button" onClick={() => applyPreset(preset)} className="group grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-[#0f1213] px-3 py-2.5 text-left transition hover:border-[#7ddac8]/60 hover:bg-[#7ddac8]/10">
                        <span><span className="block text-sm font-black">{preset.label}</span><span className="mt-0.5 block text-xs text-[#bfc8c0]">{preset.subtitle}</span></span>
                        <ArrowUpRight className="text-[#f7c66a] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={17} />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section id="capabilities" className="relative z-10 bg-[#efe7d6] px-5 py-8 text-[#151815] lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#315d55]">Capability Map</p>
              <h2 className="mt-2 text-4xl font-black">Search capabilities</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <button key={group} type="button" onClick={() => setActiveGroup(group)} className={`rounded-md border px-3 py-2 text-sm font-black transition ${activeGroup === group ? "border-[#151815] bg-[#151815] text-[#f8f4ea]" : "border-[#cfc6b4] bg-white text-[#4d504a] hover:border-[#f05d3b]"}`}>{group}</button>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {visibleFeatures.map((feature) => (
                <motion.article layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} whileHover={{ y: -4 }} key={feature.id} className="rounded-lg border border-[#d8d0bd] bg-white p-4 shadow-[0_16px_40px_rgba(35,31,22,0.08)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-md bg-[#151815] px-2 py-1 text-xs font-black text-[#f8f4ea]">{feature.id}</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#7ddac8]/16 text-[#315d55]"><feature.icon size={19} /></span>
                  </div>
                  <h3 className="mt-4 text-lg font-black">{feature.pro}</h3>
                  <p className="mt-1 text-sm font-black text-[#f05d3b]">{feature.name}</p>
                  <p className="mt-3 min-h-16 text-sm leading-6 text-[#55584f]">{feature.text}</p>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <section id="results" className="relative z-10 bg-[#f8f4ea] px-5 py-8 text-[#151815] lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <InfoPanel icon={Wand2} title="Corrected Query" value={data?.correctedQuery || query} />
            <InfoPanel icon={Sparkles} title="Expanded Terms" value={data?.expandedTerms.join(", ") || "Run a search to see ontology and context terms."} />
            <InfoPanel icon={BrainCircuit} title="Auto-completion" value={data?.autocomplete.join(", ") || "Corpus suggestions appear here."}>
              {data?.autocomplete.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.autocomplete.map((term) => (
                    <button key={term} type="button" onClick={() => appendTerm(term)} className="rounded-md bg-[#151815] px-2.5 py-1.5 text-xs font-black text-[#f8f4ea] transition hover:bg-[#315d55]">+ {term}</button>
                  ))}
                </div>
              ) : null}
            </InfoPanel>
            {data?.missingKnowledge.length ? (
              <section className="rounded-lg border border-[#efc36a] bg-[#fff5d8] p-4">
                <div className="flex items-center gap-2 font-black text-[#7a4b00]"><TriangleAlert size={18} /> Missing Background Knowledge Handler</div>
                <div className="mt-3 space-y-2">
                  {data.missingKnowledge.map((item) => <p key={item} className="rounded-md bg-white/70 px-3 py-2 text-sm leading-6 text-[#5a3a00]">{item}</p>)}
                </div>
              </section>
            ) : null}
          </aside>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f05d3b]">Ranked Output</p>
                <h2 className="mt-1 text-3xl font-black">Retrieved annotation results</h2>
              </div>
              <span className="rounded-md border border-[#d8d0bd] bg-white px-3 py-2 text-sm font-black text-[#4d504a]">{data ? `${data.hits.length} visible matches` : "waiting for search"}</span>
            </div>
            {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div> : null}
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-lg border border-[#d8d0bd] bg-white" />)}</div>
            ) : data ? (
              data.hits.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.hits.map((hit, index) => <ResultCard key={hit.id} hit={hit} index={index} />)}</div> : <EmptyState title="No strict matches found" detail="Try one of the suggested CLEF topics, enable semantic expansion, or switch the search zone back to all." />
            ) : (
              <EmptyState title="Choose a suggested query" detail="Use Starter Queries or the Query Library. They are built from real CLEF annotation topics and advanced search examples." />
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="rounded-lg border border-white/12 bg-white/[0.065] p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-[0.18em] text-[#bfc8c0]">{label}</span><Icon className="text-[#7ddac8]" size={18} /></div>
      <div className="mt-2 text-2xl font-black text-[#fffaf0]">{value}</div>
      <div className="mt-1 text-sm text-[#d6ded5]">{detail}</div>
    </motion.div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block text-sm font-bold text-[#4d504a]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-[#cfc6b4] bg-[#fffdf7] px-3 font-bold outline-none transition focus:border-[#f05d3b]">
        {options.map((option) => <option key={option || "off"} value={option}>{option || "off"}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 text-left text-sm font-black transition ${checked ? "border-[#315d55] bg-[#dff7ef] text-[#173d36]" : "border-[#d8d0bd] bg-[#fffdf7] text-[#5f625a] hover:border-[#f05d3b]"}`}>
      <span>{label}</span>
      <span className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? "bg-[#315d55]" : "bg-[#c9c1b0]"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-4" : ""}`} /></span>
    </button>
  );
}

function InfoPanel({ icon: Icon, title, value, children }: { icon: LucideIcon; title: string; value: string; children?: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#d8d0bd] bg-white p-4 shadow-[0_12px_28px_rgba(35,31,22,0.07)]">
      <div className="flex items-center gap-2 text-sm font-black text-[#315d55]"><Icon size={18} />{title}</div>
      <p className="mt-3 min-h-12 text-sm leading-6 text-[#4d504a]">{value}</p>
      {children}
    </section>
  );
}

function ResultCard({ hit, index }: { hit: SearchHit; index: number }) {
  const [showImage, setShowImage] = useState(Boolean(hit.image));
  const scoreWidth = `${Math.min(100, Math.max(6, hit.score))}%`;
  const sourceLabel = hit.imageSource === "dataset" ? "Dataset image" : "Internet fallback - not from dataset";
  return (
    <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} whileHover={{ y: -5 }} className="overflow-hidden rounded-lg border border-[#d8d0bd] bg-white shadow-[0_18px_45px_rgba(35,31,22,0.10)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#161a1a]">
        {showImage && hit.image ? <Image src={hit.image} alt={hit.title} width={640} height={480} unoptimized className="h-full w-full object-cover transition duration-500 hover:scale-105" onError={() => setShowImage(false)} /> : <div className="annotation-preview absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-[#f8f4ea]"><ImageIcon size={36} /><span className="max-w-[220px] text-sm font-bold">CLEF annotation preview</span><span className="rounded-md bg-white/10 px-2 py-1 text-xs text-[#d6ded5]">{hit.id}</span></div>}
        <div className="absolute left-3 top-3 rounded-md bg-[#151815]/85 px-2.5 py-1.5 text-xs font-black text-[#f8f4ea] backdrop-blur">rank {index + 1}</div>
        <div className={`absolute right-3 top-3 rounded-md px-2.5 py-1.5 text-xs font-black backdrop-blur ${hit.imageSource === "dataset" ? "bg-[#dff7ef]/90 text-[#173d36]" : "bg-[#f7c66a]/92 text-[#3f2c00]"}`}>{sourceLabel}</div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-black leading-6 text-[#151815]">{hit.title}</h3><span className="rounded-md bg-[#dff7ef] px-2 py-1 text-sm font-black text-[#173d36]">{hit.score}</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eee6d6]"><div className="h-full rounded-full bg-[#f05d3b]" style={{ width: scoreWidth }} /></div>
        <p className="mt-3 min-h-16 text-sm leading-6 text-[#55584f]">{hit.snippet || "No description text in this annotation."}</p>
        <div className="mt-3 flex flex-wrap gap-2">{hit.reasons.map((reason) => <span key={reason} className="rounded-md border border-[#d8d0bd] bg-[#fffdf7] px-2 py-1 text-xs font-bold text-[#4d504a]">{reason}</span>)}</div>
        <div className="mt-4 space-y-2 border-t border-[#ece4d4] pt-3 text-xs font-bold text-[#72756d]">
          <div className="flex items-center justify-between gap-3"><span>{hit.location || "Unknown location"}</span><span>{hit.date || "Undated"}</span></div>
          <div className={hit.imageSource === "dataset" ? "text-[#315d55]" : "text-[#8a5b00]"}>{hit.imageCredit}</div>
        </div>
      </div>
    </motion.article>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#cfc6b4] bg-white p-10 text-center shadow-[0_12px_28px_rgba(35,31,22,0.06)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-[#dff7ef] text-[#173d36]"><Eye size={26} /></div>
      <h3 className="mt-4 text-2xl font-black text-[#151815]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#5f625a]">{detail}</p>
    </div>
  );
}
