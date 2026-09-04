/**
 * Content Moderation Policy Engine for Spot World
 * 
 * Strict prohibition of:
 * 1. Cryptocurrency, Web3 tokens, memecoins, and speculative trading schemes
 * 2. Gambling, betting, casinos, lotteries, and games of chance (Haram)
 * 3. Alcohol, liquor, alcoholic drinks, recreational drugs, tobacco, and vaping
 * 4. NSFW, adult entertainment, dating apps, erotic content, and escort services
 * 5. Scams, phishing, malware, hate speech, and violent material
 */

export interface AdPolicyValidationInput {
  headline?: string | null;
  subtext?: string | null;
  brandName?: string | null;
  targetUrl?: string | null;
  bannerImageUrl?: string | null;
}

export interface AdPolicyValidationResult {
  isValid: boolean;
  reason?: string;
  category?: 'crypto' | 'gambling' | 'alcohol_drugs' | 'adult_nsfw' | 'scam_violence';
  violatingTerm?: string;
}

// ── 1. Crypto & Speculative Tokens ──────────────────────────────────────────
export const PROHIBITED_CRYPTO_TERMS = [
  'crypto', 'cryptocurrency', 'bitcoin', 'btc', 'ethereum', 'eth',
  'solana', 'sol', 'memecoin', 'meme coin', 'airdrop', 'nft', 'nfts',
  'pump.fun', 'raydium', 'dexscreener', 'binance', 'coinbase', 'bybit',
  'uniswap', 'pancakeswap', 'metamask', 'presale', 'pre-sale', 'tokenomics',
  'yield farming', 'defi', 'web3 token', 'altcoin', 'altcoins', 'doge',
  'dogecoin', 'shiba inu', 'pepe coin', 'rugpull', 'smart contract token',
  'blockchain wallet', 'crypto exchange', 'crypto trading', 'crypto signal',
  'crypto signals', 'crypto bot', 'crypto bots', 'dao token',
];

// ── 2. Gambling, Betting & Casinos (Haram) ──────────────────────────────────
export const PROHIBITED_GAMBLING_TERMS = [
  'casino', 'casinos', 'gambling', 'gamble', 'betting', 'sportsbook',
  'sports betting', '1xbet', 'stake.com', 'roobet', 'rollbit', 'bovada',
  'bet365', 'betway', 'draftkings', 'fanduel', 'poker', 'texas holdem',
  'blackjack', 'baccarat', 'roulette', 'slots', 'slot machine', 'slot machines',
  'jackpot', 'jackpots', 'lottery', 'lotto', 'binary options', 'forex signal',
  'forex signals', 'high yield investment', 'hyip', 'usury', 'poker room',
  'online casino', 'crypto casino', 'wager', 'wagering', 'dice game',
  'crash game', 'crash games', 'aviator game',
];

// ── 3. Alcohol, Drinks, Drugs & Tobacco ─────────────────────────────────────
export const PROHIBITED_ALCOHOL_DRUG_TERMS = [
  'alcohol', 'alcoholic', 'beer', 'beers', 'wine', 'wines', 'vodka',
  'whiskey', 'whisky', 'rum', 'gin', 'liquor', 'spirits', 'tequila',
  'brandy', 'champagne', 'cocktail', 'cocktails', 'brewery', 'distillery',
  'bar lounge', 'pub', 'liquor store', 'cannabis', 'weed', 'marijuana',
  'cbd', 'thc', 'delta 8', 'delta 9', 'vape', 'vaping', 'e-cig', 'e-cigarette',
  'tobacco', 'cigarette', 'cigarettes', 'cigar', 'cigars', 'hookah', 'shisha',
  'smoke shop', 'headshop', 'dispensary', 'drugs', 'narcotics', 'psychedelic',
  'magic mushrooms', 'psilocybin', 'kratom', 'pork product', 'pork products',
];

// ── 4. NSFW, Adult & Dating Content ────────────────────────────────────────
export const PROHIBITED_ADULT_NSFW_TERMS = [
  'porn', 'porno', 'pornography', 'xxx', 'nsfw', 'adult site', 'adult content',
  'onlyfans', 'fansly', 'camgirl', 'camgirls', 'webcam girl', 'chaturbate',
  'stripclub', 'strip club', 'stripper', 'strippers', 'escort', 'escorts',
  'escort service', 'dating site', 'dating app', 'hookup', 'hookups',
  'tinder', 'bumble', 'grindr', 'seekingarrangement', 'sugardaddy', 'sugar daddy',
  'sugar baby', 'sex', 'sexy', 'erotic', 'erotica', 'fetish', 'hentai',
  'nude', 'nudes', 'naked', 'milf', 'playboy', 'boobs', 'tits',
  'brothel', 'swingers', 'adult dating',
];

// ── 5. Prohibited Domain Keywords & TLDs ────────────────────────────────────
export const PROHIBITED_DOMAIN_PATTERNS = [
  // Crypto domains
  'pump.fun', 'dexscreener.com', 'raydium.io', 'binance.com', 'coinbase.com',
  'bybit.com', 'uniswap.org', 'pancakeswap.finance', 'opensea.io', 'magiceden.io',
  // Gambling domains
  'stake.com', 'roobet.com', 'rollbit.com', '1xbet.com', 'bet365.com',
  'bovada.lv', 'betway.com', 'draftkings.com', 'fanduel.com',
  // Adult domains
  'onlyfans.com', 'fansly.com', 'chaturbate.com', 'pornhub.com', 'xvideos.com',
  'xnxx.com', 'stripchat.com', 'camsoda.com', 'tinder.com', 'bumble.com',
];

export const PROHIBITED_TLDS = [
  '.xxx', '.porn', '.adult', '.sex', '.sexy', '.casino', '.bet',
  '.poker', '.gambling', '.crypto', '.dao', '.eth', '.sol',
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes text to defeat simple leetspeak and spaced obfuscation
 * e.g., "c.a.s.i.n.o" -> "casino", "p0rn" -> "porn", "c-r-y-p-t-o" -> "crypto"
 */
function normalizeContent(text: string): string {
  let s = text.toLowerCase();
  s = s.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  s = s.replace(/[@]/g, 'a')
       .replace(/[$]/g, 's')
       .replace(/[!|1]/g, 'i')
       .replace(/[0]/g, 'o')
       .replace(/[3]/g, 'e')
       .replace(/[5]/g, 's')
       .replace(/[+]/g, 't')
       .replace(/[*_~`]/g, '');
  return s;
}

/**
 * Matches a list of forbidden keywords against raw and normalized text.
 */
function checkTermMatch(text: string, termList: string[]): string | null {
  if (!text) return null;
  const rawLower = text.toLowerCase();
  const normalized = normalizeContent(text);

  for (const term of termList) {
    const termLower = term.toLowerCase();

    // 1. Direct word boundary match
    const boundaryRe = new RegExp(`\\b${escapeRegex(termLower)}\\b`, 'i');
    if (boundaryRe.test(rawLower) || boundaryRe.test(normalized)) {
      return term;
    }

    // 2. Exact phrase or continuous match if term has multiple words or length >= 5
    if (termLower.includes(' ') || termLower.length >= 5) {
      if (rawLower.includes(termLower) || normalized.includes(termLower)) {
        return term;
      }
    }

    // 3. Spaced-out / dotted bypass check (e.g. "p.o.r.n", "c r y p t o")
    if (termLower.length >= 3) {
      const spaced = termLower.split('').map(escapeRegex).join('[\\s._-]*');
      const spacedRe = new RegExp(`\\b${spaced}\\b`, 'i');
      if (spacedRe.test(rawLower) || spacedRe.test(normalized)) {
        return term;
      }
    }
  }
  return null;
}

/**
 * Validates a destination URL against forbidden domains, subdomains, and TLDs.
 */
function checkDomainMatch(urlStr: string): { matches: boolean; reason?: string } {
  if (!urlStr) return { matches: false };
  try {
    const parsed = new URL(urlStr.includes('://') ? urlStr : `https://${urlStr}`);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const full = `${host}${pathname}`;

    // Check prohibited TLDs
    for (const tld of PROHIBITED_TLDS) {
      if (host.endsWith(tld)) {
        return { matches: true, reason: `Forbidden top-level domain (${tld})` };
      }
    }

    // Check blacklisted hostnames
    for (const domain of PROHIBITED_DOMAIN_PATTERNS) {
      if (host === domain || host.endsWith(`.${domain}`) || full.includes(domain)) {
        return { matches: true, reason: `Prohibited platform or destination (${domain})` };
      }
    }

    // Check if hostname contains restricted keywords
    const hostKeyword =
      checkTermMatch(host, PROHIBITED_CRYPTO_TERMS) ||
      checkTermMatch(host, PROHIBITED_GAMBLING_TERMS) ||
      checkTermMatch(host, PROHIBITED_ALCOHOL_DRUG_TERMS) ||
      checkTermMatch(host, PROHIBITED_ADULT_NSFW_TERMS);

    if (hostKeyword) {
      return { matches: true, reason: `Prohibited domain keyword: "${hostKeyword}"` };
    }
  } catch (_) {
    // Malformed URL will be rejected by schema validator
  }
  return { matches: false };
}

/**
 * Master Ad Content Policy Validator
 * Used across the frontend (form submission guard) and backend (webhook gatekeeper).
 */
export function validateAdPolicy(input: AdPolicyValidationInput): AdPolicyValidationResult {
  const combinedText = [
    input.headline,
    input.subtext,
    input.brandName,
  ].filter(Boolean).join(' ');

  // 1. Check Crypto & Speculative Tokens
  const cryptoMatch = checkTermMatch(combinedText, PROHIBITED_CRYPTO_TERMS);
  if (cryptoMatch) {
    return {
      isValid: false,
      category: 'crypto',
      violatingTerm: cryptoMatch,
      reason: `Cryptocurrency, tokens, and Web3 speculation advertisements are strictly prohibited on SPOT (detected: "${cryptoMatch}").`,
    };
  }

  // 2. Check Gambling, Betting & Casinos (Haram)
  const gamblingMatch = checkTermMatch(combinedText, PROHIBITED_GAMBLING_TERMS);
  if (gamblingMatch) {
    return {
      isValid: false,
      category: 'gambling',
      violatingTerm: gamblingMatch,
      reason: `Gambling, betting, casino, and lottery advertisements are strictly prohibited on SPOT (detected: "${gamblingMatch}").`,
    };
  }

  // 3. Check Alcohol, Drinks, Drugs & Tobacco
  const alcoholMatch = checkTermMatch(combinedText, PROHIBITED_ALCOHOL_DRUG_TERMS);
  if (alcoholMatch) {
    return {
      isValid: false,
      category: 'alcohol_drugs',
      violatingTerm: alcoholMatch,
      reason: `Alcoholic drinks, liquor, drugs, and smoking/vaping advertisements are strictly prohibited on SPOT (detected: "${alcoholMatch}").`,
    };
  }

  // 4. Check NSFW, Adult & Dating
  const adultMatch = checkTermMatch(combinedText, PROHIBITED_ADULT_NSFW_TERMS);
  if (adultMatch) {
    return {
      isValid: false,
      category: 'adult_nsfw',
      violatingTerm: adultMatch,
      reason: `Adult, NSFW, erotic, and dating service advertisements are strictly prohibited on SPOT (detected: "${adultMatch}").`,
    };
  }

  // 5. Check Destination URL and Banner Image URL
  if (input.targetUrl) {
    const domainCheck = checkDomainMatch(input.targetUrl);
    if (domainCheck.matches) {
      return {
        isValid: false,
        category: 'adult_nsfw',
        reason: `The destination website violates SPOT content guidelines (${domainCheck.reason}). Only tech tools, SaaS, portfolios, startups & creator projects are permitted.`,
      };
    }
  }

  if (input.bannerImageUrl) {
    const domainCheck = checkDomainMatch(input.bannerImageUrl);
    if (domainCheck.matches) {
      return {
        isValid: false,
        category: 'adult_nsfw',
        reason: `The banner image link violates SPOT content guidelines (${domainCheck.reason}).`,
      };
    }
  }

  return { isValid: true };
}
