// lib/scrape/parsers/index.ts
// Parser registry — barrel file that exports all parsers and a lookup function.

import { Parser } from '../types';
import { hackernewsParser } from './hackernews';
import { githubTrendingParser } from './github-trending';
import { producthuntParser } from './producthunt';
import { betalistParser } from './betalist';
import { saashubParser } from './saashub';
import { devtoParser } from './devto';
import { redditParser } from './reddit';

const parsers: Record<string, Parser> = {
  hackernews: hackernewsParser,
  'github-trending': githubTrendingParser,
  producthunt: producthuntParser,
  betalist: betalistParser,
  saashub: saashubParser,
  devto: devtoParser,
  reddit: redditParser,
};

export function getParser(strategy: string): Parser | undefined {
  return parsers[strategy];
}

export type { Parser } from '../types';
