import { OuncePriceCandle, TradingStyle } from '@ounce24/types';

export interface SMCOrderBlock {
  type: 'Bullish' | 'Bearish';
  top: number;
  bottom: number;
  mitigated: boolean;
  timeframe: '15m' | '1h';
}

export interface SMCFairValueGap {
  type: 'Bullish' | 'Bearish';
  top: number;
  bottom: number;
  mitigated: boolean;
  timeframe: '15m' | '1h';
}

export interface SMCMarketStructure {
  type: 'BOS' | 'CHoCH';
  direction: 'Bullish' | 'Bearish';
  price: number;
  timeframe: '15m' | '1h';
}

export interface DailyStats {
  pdh: number;
  pdl: number;
  adr14: number;
}

export interface MarketStateSummary {
  currentPrice: number;
  trend5m: 'Bullish' | 'Bearish' | 'Consolidating';
  sma20_5m: number;
  sma50_5m: number;
  trend15m: 'Bullish' | 'Bearish' | 'Consolidating';
  sma20_15m: number;
  sma50_15m: number;
  trend1h: 'Bullish' | 'Bearish' | 'Consolidating';
  sma20_1h: number;
  sma50_1h: number;
  trend4h: 'Bullish' | 'Bearish' | 'Consolidating';
  sma20_4h: number;
  sma50_4h: number;
  rsi5m: number;
  rsi15m: number;
  rsi1h: number;
  rsi4h: number;
  atr5m: number;
  atr1h: number;
  atr4h: number;
  keySupports: number[];
  keyResistances: number[];
  semanticText: string;
  smcOrderBlocks: SMCOrderBlock[];
  smcFVGs: SMCFairValueGap[];
  marketStructure: SMCMarketStructure[];
  tradingSession?: string;
  isVolatile?: boolean;
  pdh?: number;
  pdl?: number;
  adr14?: number;
}


export function detectTradingStyle(targetDistance: number, atr1h: number): TradingStyle {
  const vol = atr1h && atr1h > 0 ? atr1h : 4.0;
  if (targetDistance <= 1.5 * vol) {
    return TradingStyle.Scalp;
  } else if (targetDistance <= 5.0 * vol) {
    return TradingStyle.Day;
  } else {
    return TradingStyle.Swing;
  }
}

export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;
  const sum = closes.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

export function calculateATR(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < period + 1) return 1.5;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr);
  }
  const sum = trs.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

export function aggregateTo15m(candles5m: OuncePriceCandle[]): { timestamp: Date; open: number; high: number; low: number; close: number }[] {
  const candles15m: { timestamp: Date; open: number; high: number; low: number; close: number }[] = [];
  const groups: { [key: string]: OuncePriceCandle[] } = {};

  for (const candle of candles5m) {
    const date = new Date(candle.timestamp);
    const minutes = date.getMinutes();
    const alignedMinutes = Math.floor(minutes / 15) * 15;
    date.setMinutes(alignedMinutes, 0, 0);
    const key = date.getTime().toString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(candle);
  }

  for (const key of Object.keys(groups).sort()) {
    const group = groups[key];
    const sortedGroup = [...group].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const timestamp = new Date(Number(key));
    const open = sortedGroup[0].open;
    const close = sortedGroup[sortedGroup.length - 1].close;
    const high = Math.max(...sortedGroup.map(c => c.high));
    const low = Math.min(...sortedGroup.map(c => c.low));

    candles15m.push({ timestamp, open, high, low, close });
  }
  return candles15m;
}

export function aggregateTo1h(candles5m: OuncePriceCandle[]): { timestamp: Date; open: number; high: number; low: number; close: number }[] {
  const candles1h: { timestamp: Date; open: number; high: number; low: number; close: number }[] = [];
  const groups: { [key: string]: OuncePriceCandle[] } = {};

  for (const candle of candles5m) {
    const date = new Date(candle.timestamp);
    date.setMinutes(0, 0, 0);
    const key = date.getTime().toString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(candle);
  }

  for (const key of Object.keys(groups).sort()) {
    const group = groups[key];
    const sortedGroup = [...group].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const timestamp = new Date(Number(key));
    const open = sortedGroup[0].open;
    const close = sortedGroup[sortedGroup.length - 1].close;
    const high = Math.max(...sortedGroup.map(c => c.high));
    const low = Math.min(...sortedGroup.map(c => c.low));

    candles1h.push({ timestamp, open, high, low, close });
  }
  return candles1h;
}

export function aggregateTo4h(candles5m: OuncePriceCandle[]): { timestamp: Date; open: number; high: number; low: number; close: number }[] {
  const candles4h: { timestamp: Date; open: number; high: number; low: number; close: number }[] = [];
  const groups: { [key: string]: OuncePriceCandle[] } = {};

  for (const candle of candles5m) {
    const date = new Date(candle.timestamp);
    const hour = date.getUTCHours();
    const alignedHour = Math.floor(hour / 4) * 4;
    date.setUTCHours(alignedHour, 0, 0, 0);
    const key = date.getTime().toString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(candle);
  }

  for (const key of Object.keys(groups).sort()) {
    const group = groups[key];
    const sortedGroup = [...group].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const timestamp = new Date(Number(key));
    const open = sortedGroup[0].open;
    const close = sortedGroup[sortedGroup.length - 1].close;
    const high = Math.max(...sortedGroup.map(c => c.high));
    const low = Math.min(...sortedGroup.map(c => c.low));

    candles4h.push({ timestamp, open, high, low, close });
  }
  return candles4h;
}

export function findSupportResistance(
  candles: { high: number; low: number; close: number }[],
  leftStrength = 4,
  rightStrength = 4,
  clusterTolerance = 1.0,
): { supports: number[]; resistances: number[] } {
  const rawSupports: number[] = [];
  const rawResistances: number[] = [];

  for (let i = leftStrength; i < candles.length - rightStrength; i++) {
    const current = candles[i];
    let isSupport = true;
    let isResistance = true;

    for (let j = i - leftStrength; j <= i + rightStrength; j++) {
      if (j === i) continue;
      if (candles[j].low < current.low) isSupport = false;
      if (candles[j].high > current.high) isResistance = false;
    }

    if (isSupport) rawSupports.push(Number(current.low.toFixed(2)));
    if (isResistance) rawResistances.push(Number(current.high.toFixed(2)));
  }

  const cluster = (levels: number[]) => {
    const result: number[] = [];
    const sorted = [...levels].sort((a, b) => a - b);
    for (const val of sorted) {
      if (result.length === 0) {
        result.push(val);
      } else {
        const last = result[result.length - 1];
        if (val - last > clusterTolerance) {
          result.push(val);
        } else {
          result[result.length - 1] = Number(((last + val) / 2).toFixed(2));
        }
      }
    }
    return result;
  };

  return {
    supports: cluster(rawSupports),
    resistances: cluster(rawResistances),
  };
}

export function analyzeMarketState(
  currentPrice: number,
  candles5m: OuncePriceCandle[],
  dailyStats?: DailyStats,
): MarketStateSummary {
  const closes5m = candles5m.map((c) => c.close);
  const rsi5m = calculateRSI(closes5m, 14);
  const atr5m = calculateATR(candles5m, 14);
  const sma20_5m = calculateSMA(closes5m, 20);
  const sma50_5m = calculateSMA(closes5m, 50);

  let trend5m: 'Bullish' | 'Bearish' | 'Consolidating' = 'Consolidating';
  if (currentPrice > sma20_5m && currentPrice > sma50_5m && sma20_5m > sma50_5m) {
    trend5m = 'Bullish';
  } else if (currentPrice < sma20_5m && currentPrice < sma50_5m && sma20_5m < sma50_5m) {
    trend5m = 'Bearish';
  }

  const candles15m = aggregateTo15m(candles5m);
  const closes15m = candles15m.map((c) => c.close);
  const rsi15m = calculateRSI(closes15m, 14);
  const sma20_15m = calculateSMA(closes15m, 20);
  const sma50_15m = calculateSMA(closes15m, 50);

  let trend15m: 'Bullish' | 'Bearish' | 'Consolidating' = 'Consolidating';
  if (currentPrice > sma20_15m && currentPrice > sma50_15m && sma20_15m > sma50_15m) {
    trend15m = 'Bullish';
  } else if (currentPrice < sma20_15m && currentPrice < sma50_15m && sma20_15m < sma50_15m) {
    trend15m = 'Bearish';
  }

  // Volatility evaluation: 15m ATR > 1.5 * baseline ATR
  const trs15m: number[] = [];
  for (let i = 1; i < candles15m.length; i++) {
    const h = candles15m[i].high;
    const l = candles15m[i].low;
    const pc = candles15m[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs15m.push(tr);
  }
  const currentAtr15m = trs15m.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const baselineAtr15m = trs15m.reduce((a, b) => a + b, 0) / (trs15m.length || 1);
  const isVolatile = currentAtr15m > 1.5 * baselineAtr15m;

  // Trading Session detection
  const date = new Date();
  const hour = date.getUTCHours();
  let tradingSession = 'Asian';
  if (hour >= 13 && hour <= 16) {
    tradingSession = 'London-NY Overlap';
  } else if (hour >= 8 && hour < 13) {
    tradingSession = 'London';
  } else if (hour > 16 && hour < 21) {
    tradingSession = 'New York';
  }

  const candles1h = aggregateTo1h(candles5m);
  const closes1h = candles1h.map((c) => c.close);
  const rsi1h = calculateRSI(closes1h, 14);
  const atr1h = calculateATR(candles1h, 14);
  const sma20_1h = calculateSMA(closes1h, 20);
  const sma50_1h = calculateSMA(closes1h, 50);

  let trend1h: 'Bullish' | 'Bearish' | 'Consolidating' = 'Consolidating';
  if (currentPrice > sma20_1h && currentPrice > sma50_1h && sma20_1h > sma50_1h) {
    trend1h = 'Bullish';
  } else if (currentPrice < sma20_1h && currentPrice < sma50_1h && sma20_1h < sma50_1h) {
    trend1h = 'Bearish';
  }

  const candles4h = aggregateTo4h(candles5m);
  const closes4h = candles4h.map((c) => c.close);
  const rsi4h = calculateRSI(closes4h, 14);
  const atr4h = calculateATR(candles4h, 14);
  const sma20_4h = calculateSMA(closes4h, 20);
  const sma50_4h = calculateSMA(closes4h, 50);

  let trend4h: 'Bullish' | 'Bearish' | 'Consolidating' = 'Consolidating';
  if (currentPrice > sma20_4h && currentPrice > sma50_4h && sma20_4h > sma50_4h) {
    trend4h = 'Bullish';
  } else if (currentPrice < sma20_4h && currentPrice < sma50_4h && sma20_4h < sma50_4h) {
    trend4h = 'Bearish';
  }

  const sr15m = findSupportResistance(candles15m, 4, 4, 0.8);
  const sr1h = findSupportResistance(candles1h, 3, 3, 1.5);
  const sr4h = findSupportResistance(candles4h, 2, 2, 2.5);

  const keySupports15m = sr15m.supports
    .filter((v) => v < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const keyResistances15m = sr15m.resistances
    .filter((v) => v > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, 3);

  const keySupports1h4h = [...new Set([...sr1h.supports, ...sr4h.supports])]
    .filter((v) => v < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const keyResistances1h4h = [...new Set([...sr1h.resistances, ...sr4h.resistances])]
    .filter((v) => v > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, 3);

  const keySupports = [...new Set([...keySupports15m, ...keySupports1h4h])]
    .sort((a, b) => b - a)
    .slice(0, 3);
  const keyResistances = [...new Set([...keyResistances15m, ...keyResistances1h4h])]
    .sort((a, b) => a - b)
    .slice(0, 3);

  let semanticText = `CURRENT GOLD PRICE: $${currentPrice.toFixed(2)}\n`;
  semanticText += `TRADING SESSION: ${tradingSession.toUpperCase()}\n`;
  semanticText += `MARKET VOLATILITY STATE: ${isVolatile ? 'HIGH VOLATILITY (Use deep limit orders only)' : 'NORMAL VOLATILITY'}\n`;
  if (dailyStats) {
    semanticText += `PREVIOUS DAY HIGH (PDH): $${dailyStats.pdh.toFixed(2)}\n`;
    semanticText += `PREVIOUS DAY LOW (PDL): $${dailyStats.pdl.toFixed(2)}\n`;
    semanticText += `AVERAGE DAILY RANGE (ADR 14): $${dailyStats.adr14.toFixed(2)}\n`;
  }
  semanticText += `\n`;

  semanticText += `[Trend & Moving Averages (5-minute timeframe - Short-Term)]\n`;
  semanticText += `- 5m Trend: ${trend5m.toUpperCase()}\n`;
  semanticText += `- 5m SMA20: $${sma20_5m.toFixed(2)} (Price is $${Math.abs(currentPrice - sma20_5m).toFixed(2)} ${currentPrice > sma20_5m ? 'above' : 'below'} SMA20)\n`;
  semanticText += `- 5m SMA50: $${sma50_5m.toFixed(2)} (Price is $${Math.abs(currentPrice - sma50_5m).toFixed(2)} ${currentPrice > sma50_5m ? 'above' : 'below'} SMA50)\n\n`;

  semanticText += `[Trend & Moving Averages (15-minute timeframe - Short-Term)]\n`;
  semanticText += `- 15m Trend: ${trend15m.toUpperCase()}\n`;
  semanticText += `- 15m SMA20: $${sma20_15m.toFixed(2)} (Price is $${Math.abs(currentPrice - sma20_15m).toFixed(2)} ${currentPrice > sma20_15m ? 'above' : 'below'} SMA20)\n`;
  semanticText += `- 15m SMA50: $${sma50_15m.toFixed(2)} (Price is $${Math.abs(currentPrice - sma50_15m).toFixed(2)} ${currentPrice > sma50_15m ? 'above' : 'below'} SMA50)\n\n`;

  semanticText += `[Trend & Moving Averages (1-hour timeframe - Medium-Term)]\n`;
  semanticText += `- 1h Trend: ${trend1h.toUpperCase()}\n`;
  semanticText += `- 1h SMA20: $${sma20_1h.toFixed(2)} (Price is $${Math.abs(currentPrice - sma20_1h).toFixed(2)} ${currentPrice > sma20_1h ? 'above' : 'below'} SMA20)\n`;
  semanticText += `- 1h SMA50: $${sma50_1h.toFixed(2)} (Price is $${Math.abs(currentPrice - sma50_1h).toFixed(2)} ${currentPrice > sma50_1h ? 'above' : 'below'} SMA50)\n\n`;

  semanticText += `[Trend & Moving Averages (4-hour timeframe - Long-Term)]\n`;
  semanticText += `- 4h Trend: ${trend4h.toUpperCase()}\n`;
  semanticText += `- 4h SMA20: $${sma20_4h.toFixed(2)} (Price is $${Math.abs(currentPrice - sma20_4h).toFixed(2)} ${currentPrice > sma20_4h ? 'above' : 'below'} SMA20)\n`;
  semanticText += `- 4h SMA50: $${sma50_4h.toFixed(2)} (Price is $${Math.abs(currentPrice - sma50_4h).toFixed(2)} ${currentPrice > sma50_4h ? 'above' : 'below'} SMA50)\n\n`;

  semanticText += `[Key Technical Indicators]\n`;
  semanticText += `- 5-minute Volatility (ATR 14): $${atr5m.toFixed(2)}\n`;
  semanticText += `- 1-hour Volatility (ATR 14): $${atr1h.toFixed(2)}\n`;
  semanticText += `- 4-hour Volatility (ATR 14): $${atr4h.toFixed(2)}\n`;
  semanticText += `- 5m RSI (14): ${rsi5m.toFixed(2)}\n`;
  semanticText += `- 15m RSI (14): ${rsi15m.toFixed(2)}\n`;
  semanticText += `- 1h RSI (14): ${rsi1h.toFixed(2)}\n`;
  semanticText += `- 4h RSI (14): ${rsi4h.toFixed(2)}\n\n`;

  semanticText += `[Key Horizontal Support & Resistance Levels (Calculated by System)]\n`;
  semanticText += `* Short-Term (15m timeframe):\n`;
  if (keySupports15m.length > 0) {
    semanticText += `  - Support Levels (below price): ${keySupports15m.map((v) => `$${v.toFixed(2)}`).join(', ')}\n`;
  } else {
    semanticText += `  - Support Levels (below price): None identified in recent data.\n`;
  }
  if (keyResistances15m.length > 0) {
    semanticText += `  - Resistance Levels (above price): ${keyResistances15m.map((v) => `$${v.toFixed(2)}`).join(', ')}\n`;
  } else {
    semanticText += `  - Resistance Levels (above price): None identified in recent data.\n`;
  }

  semanticText += `* Medium/Long-Term (1h & 4h timeframes):\n`;
  if (keySupports1h4h.length > 0) {
    semanticText += `  - Support Levels (below price): ${keySupports1h4h.map((v) => `$${v.toFixed(2)}`).join(', ')}\n`;
  } else {
    semanticText += `  - Support Levels (below price): None identified in recent data.\n`;
  }
  if (keyResistances1h4h.length > 0) {
    semanticText += `  - Resistance Levels (above price): ${keyResistances1h4h.map((v) => `$${v.toFixed(2)}`).join(', ')}\n`;
  } else {
    semanticText += `  - Resistance Levels (above price): None identified in recent data.\n`;
  }

  const smcOrderBlocks = [
    ...findOrderBlocks(candles15m, '15m'),
    ...findOrderBlocks(candles1h, '1h'),
  ];

  const smcFVGs = [
    ...findFVGs(candles15m, '15m'),
    ...findFVGs(candles1h, '1h'),
  ];

  const marketStructure = [
    ...findMarketStructure(candles15m, '15m'),
    ...findMarketStructure(candles1h, '1h'),
  ];

  // Add SMC data to semanticText
  if (smcOrderBlocks.length > 0) {
    semanticText += `\n[SMC Order Blocks]\n`;
    for (const ob of smcOrderBlocks) {
      semanticText += `- ${ob.timeframe} ${ob.type} OB: $${ob.bottom.toFixed(2)} - $${ob.top.toFixed(2)}${ob.mitigated ? ' (mitigated)' : ' (fresh)'}\n`;
    }
  }

  if (smcFVGs.length > 0) {
    semanticText += `\n[SMC Fair Value Gaps (unfilled)]\n`;
    for (const fvg of smcFVGs) {
      semanticText += `- ${fvg.timeframe} ${fvg.type} FVG: $${fvg.bottom.toFixed(2)} - $${fvg.top.toFixed(2)}\n`;
    }
  }

  if (marketStructure.length > 0) {
    semanticText += `\n[Market Structure]\n`;
    for (const ms of marketStructure) {
      semanticText += `- ${ms.timeframe} ${ms.type} ${ms.direction} at $${ms.price.toFixed(2)}\n`;
    }
  }

  return {
    currentPrice,
    trend5m,
    sma20_5m,
    sma50_5m,
    trend15m,
    sma20_15m,
    sma50_15m,
    trend1h,
    sma20_1h,
    sma50_1h,
    trend4h,
    sma20_4h,
    sma50_4h,
    rsi5m,
    rsi15m,
    rsi1h,
    rsi4h,
    atr5m,
    atr1h,
    atr4h,
    keySupports,
    keyResistances,
    semanticText,
    smcOrderBlocks,
    smcFVGs,
    marketStructure,
    tradingSession,
    isVolatile,
    pdh: dailyStats?.pdh,
    pdl: dailyStats?.pdl,
    adr14: dailyStats?.adr14,
  };
}

// SMC Detection Helpers

function calculateATRForCandles(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < period + 1) return 1.5;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr);
  }
  const sum = trs.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function findOrderBlocks(
  candles: { open: number; high: number; low: number; close: number }[],
  timeframe: '15m' | '1h',
): SMCOrderBlock[] {
  const atr = calculateATRForCandles(candles, 14);
  const obs: SMCOrderBlock[] = [];
  const startIdx = Math.max(1, candles.length - 40);

  for (let i = startIdx; i < candles.length - 1; i++) {
    const prevCandle = candles[i - 1];
    const currentCandle = candles[i];
    const bodySize = Math.abs(currentCandle.close - currentCandle.open);

    // Bullish OB
    if (prevCandle.close < prevCandle.open && currentCandle.close > currentCandle.open && bodySize > 0.8 * atr) {
      const top = prevCandle.high;
      const bottom = prevCandle.low;

      let mitigated = false;
      let invalidated = false;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].low <= top) {
          mitigated = true;
        }
        if (candles[j].close < bottom) {
          invalidated = true;
          break;
        }
      }

      if (!invalidated) {
        obs.push({
          type: 'Bullish',
          top: Number(top.toFixed(2)),
          bottom: Number(bottom.toFixed(2)),
          mitigated,
          timeframe,
        });
      }
    }

    // Bearish OB
    if (prevCandle.close > prevCandle.open && currentCandle.close < currentCandle.open && bodySize > 0.8 * atr) {
      const top = prevCandle.high;
      const bottom = prevCandle.low;

      let mitigated = false;
      let invalidated = false;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].high >= bottom) {
          mitigated = true;
        }
        if (candles[j].close > top) {
          invalidated = true;
          break;
        }
      }

      if (!invalidated) {
        obs.push({
          type: 'Bearish',
          top: Number(top.toFixed(2)),
          bottom: Number(bottom.toFixed(2)),
          mitigated,
          timeframe,
        });
      }
    }
  }

  const bullishOBs = obs.filter((ob) => ob.type === 'Bullish').slice(-2);
  const bearishOBs = obs.filter((ob) => ob.type === 'Bearish').slice(-2);
  return [...bullishOBs, ...bearishOBs];
}

function findFVGs(
  candles: { open: number; high: number; low: number; close: number }[],
  timeframe: '15m' | '1h',
): SMCFairValueGap[] {
  const fvgs: SMCFairValueGap[] = [];
  const startIdx = Math.max(2, candles.length - 40);

  for (let i = startIdx; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const curr = candles[i];

    // Bullish FVG
    if (curr.low > prev2.high) {
      const top = curr.low;
      const bottom = prev2.high;

      let mitigated = false;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].low <= bottom) {
          mitigated = true;
          break;
        }
      }

      fvgs.push({
        type: 'Bullish',
        top: Number(top.toFixed(2)),
        bottom: Number(bottom.toFixed(2)),
        mitigated,
        timeframe,
      });
    }

    // Bearish FVG
    if (curr.high < prev2.low) {
      const top = prev2.low;
      const bottom = curr.high;

      let mitigated = false;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].high >= top) {
          mitigated = true;
          break;
        }
      }

      fvgs.push({
        type: 'Bearish',
        top: Number(top.toFixed(2)),
        bottom: Number(bottom.toFixed(2)),
        mitigated,
        timeframe,
      });
    }
  }

  return fvgs.filter((f) => !f.mitigated).slice(-2);
}

function findMarketStructure(
  candles: { open: number; high: number; low: number; close: number }[],
  timeframe: '15m' | '1h',
): SMCMarketStructure[] {
  const structures: SMCMarketStructure[] = [];
  const len = candles.length;
  if (len < 10) return [];

  const swingHighs: { idx: number; price: number }[] = [];
  const swingLows: { idx: number; price: number }[] = [];

  for (let i = 2; i < len - 2; i++) {
    const c = candles[i];
    if (
      c.high > candles[i - 1].high &&
      c.high > candles[i - 2].high &&
      c.high > candles[i + 1].high &&
      c.high > candles[i + 2].high
    ) {
      swingHighs.push({ idx: i, price: c.high });
    }

    if (
      c.low < candles[i - 1].low &&
      c.low < candles[i - 2].low &&
      c.low < candles[i + 1].low &&
      c.low < candles[i + 2].low
    ) {
      swingLows.push({ idx: i, price: c.low });
    }
  }

  const lastClose = candles[len - 1].close;

  if (swingHighs.length > 0) {
    const lastSwingHigh = swingHighs[swingHighs.length - 1];
    if (lastClose > lastSwingHigh.price) {
      structures.push({
        type: 'BOS',
        direction: 'Bullish',
        price: Number(lastSwingHigh.price.toFixed(2)),
        timeframe,
      });
    }
  }

  if (swingLows.length > 0) {
    const lastSwingLow = swingLows[swingLows.length - 1];
    if (lastClose < lastSwingLow.price) {
      structures.push({
        type: 'BOS',
        direction: 'Bearish',
        price: Number(lastSwingLow.price.toFixed(2)),
        timeframe,
      });
    }
  }

  return structures.slice(-1);
}

// ----------------------------------------------------
// ADDED HELPER METHODS FOR AI MARKET DATA PAYLOAD
// ----------------------------------------------------

export function calculateEMA(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  let ema = closes[0];
  const k = 2 / (period + 1);
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

export function calculateMACD(closes: number[]): { macdLine: number; signalLine: number; histogram: number } {
  let ema12 = closes[0] || 0;
  let ema26 = closes[0] || 0;
  const k12 = 2 / 13;
  const k26 = 2 / 27;
  
  const macdLines: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    ema12 = closes[i] * k12 + ema12 * (1 - k12);
    ema26 = closes[i] * k26 + ema26 * (1 - k26);
    macdLines.push(ema12 - ema26);
  }
  
  let signalLine = macdLines[0] || 0;
  const k9 = 2 / 10;
  for (let i = 0; i < macdLines.length; i++) {
    signalLine = macdLines[i] * k9 + signalLine * (1 - k9);
  }
  
  const currentMacd = macdLines[macdLines.length - 1] || 0;
  const histogram = currentMacd - signalLine;
  
  return {
    macdLine: Number(currentMacd.toFixed(2)),
    signalLine: Number(signalLine.toFixed(2)),
    histogram: Number(histogram.toFixed(2))
  };
}

export function calculateBollingerBands(closes: number[], period = 20, multiplier = 2) {
  const sma = calculateSMA(closes, period);
  const slice = closes.slice(-period);
  const sumSqDiff = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0);
  const stdDev = Math.sqrt(sumSqDiff / (period || 1));
  const upper = sma + multiplier * stdDev;
  const lower = sma - multiplier * stdDev;
  return {
    upper: Number(upper.toFixed(2)),
    middle: Number(sma.toFixed(2)),
    lower: Number(lower.toFixed(2))
  };
}

export function detectCandlePattern(open: number, high: number, low: number, close: number): string {
  const body = Math.abs(close - open);
  const upperWick = high - Math.max(open, close);
  const lowerWick = Math.min(open, close) - low;
  const totalRange = high - low;
  if (totalRange === 0) return 'NEUTRAL';
  
  const isBullish = close >= open;
  if (lowerWick >= 2 * body && upperWick <= 0.5 * lowerWick) {
    return 'BULLISH_PINBAR_REJECTION';
  }
  if (upperWick >= 2 * body && lowerWick <= 0.5 * upperWick) {
    return 'BEARISH_PINBAR_REJECTION';
  }
  if (body >= 0.6 * totalRange) {
    return isBullish ? 'BULLISH_MOMENTUM_CANDLE' : 'BEARISH_MOMENTUM_CANDLE';
  }
  return isBullish ? 'BULLISH_NEUTRAL' : 'BEARISH_NEUTRAL';
}

export function calculateDailyTPOProfile(candles5m: OuncePriceCandle[], currentPrice: number) {
  const last288 = candles5m.slice(-288);
  if (last288.length === 0) {
    return {
      poc: currentPrice,
      vah: currentPrice,
      val: currentPrice,
      position: 'ABOVE_POC'
    };
  }
  
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const c of last288) {
    if (c.low < globalMin) globalMin = c.low;
    if (c.high > globalMax) globalMax = c.high;
  }
  
  const binSize = 1.0;
  const bins: Record<number, number> = {};
  
  for (const c of last288) {
    const startBin = Math.floor(c.low / binSize) * binSize;
    const endBin = Math.floor(c.high / binSize) * binSize;
    for (let price = startBin; price <= endBin; price += binSize) {
      bins[price] = (bins[price] || 0) + 1;
    }
  }
  
  let maxCount = 0;
  let poc = currentPrice;
  const sortedPrices = Object.keys(bins).map(Number).sort((a, b) => a - b);
  for (const p of sortedPrices) {
    if (bins[p] > maxCount) {
      maxCount = bins[p];
      poc = p + binSize / 2;
    }
  }
  
  const totalCount = Object.values(bins).reduce((a, b) => a + b, 0);
  const targetCount = totalCount * 0.70;
  
  let currentCount = bins[Math.floor(poc / binSize) * binSize] || 0;
  let lowIdx = sortedPrices.indexOf(Math.floor(poc / binSize) * binSize);
  let highIdx = lowIdx;
  
  while (currentCount < targetCount && (lowIdx > 0 || highIdx < sortedPrices.length - 1)) {
    const lowCount = lowIdx > 0 ? bins[sortedPrices[lowIdx - 1]] : 0;
    const highCount = highIdx < sortedPrices.length - 1 ? bins[sortedPrices[highIdx + 1]] : 0;
    
    if (lowCount >= highCount && lowIdx > 0) {
      lowIdx--;
      currentCount += lowCount;
    } else if (highIdx < sortedPrices.length - 1) {
      highIdx++;
      currentCount += highCount;
    } else if (lowIdx > 0) {
      lowIdx--;
      currentCount += lowCount;
    } else {
      break;
    }
  }
  
  const val = sortedPrices[lowIdx] !== undefined ? sortedPrices[lowIdx] : poc;
  const vah = sortedPrices[highIdx] !== undefined ? sortedPrices[highIdx] + binSize : poc;
  
  return {
    poc: Number(poc.toFixed(2)),
    vah: Number(vah.toFixed(2)),
    val: Number(val.toFixed(2)),
    position: currentPrice >= poc ? 'ABOVE_POC' : 'BELOW_POC'
  };
}

export function buildMarketContextJson(
  currentPrice: number,
  candles5m: OuncePriceCandle[],
  dailyAgg: any[],
  dxyPriceAndChange: { price: number; changePercent: number } | null,
  us10yPriceAndChange: { price: number; changePercent: number } | null,
  newsCheck: { near: boolean; eventName?: string; timeDiffMinutes?: number },
  isMarketOpen: boolean
): any {
  const candles1h = aggregateTo1h(candles5m);
  const closes1h = candles1h.map(c => c.close);
  
  // 1. Asset Info & Market Context
  const now = new Date();
  const utcHour = now.getUTCHours();
  let activeSession = 'Asian';
  if (utcHour >= 13 && utcHour <= 16) {
    activeSession = 'London_NY_Overlap';
  } else if (utcHour >= 8 && utcHour < 13) {
    activeSession = 'London';
  } else if (utcHour > 16 && utcHour < 21) {
    activeSession = 'New_York';
  }
  
  const isVolatile = newsCheck.near || (calculateATR(candles15m(candles5m), 14) > 1.5 * calculateATR(candles15m(candles5m), 14)); // simple proxy
  const spread = newsCheck.near ? 0.25 : 0.15;
  const minutesToHourlyClose = 60 - now.getUTCMinutes();
  
  const nyDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const targetNy = new Date(nyDate);
  targetNy.setHours(17, 0, 0, 0);
  if (nyDate.getHours() >= 17) {
    targetNy.setDate(targetNy.getDate() + 1);
  }
  const minutesToDailyClose = Math.round((targetNy.getTime() - nyDate.getTime()) / (60 * 1000));
  
  // 2. Volatility & Risk Metrics
  const atr1h = calculateATR(candles1h, 14);
  const adr14 = dailyAgg.length > 0 
    ? (dailyAgg.map(d => d.high - d.low).reduce((a, b) => a + b, 0) / dailyAgg.length) 
    : 28.5;

  // 3. Price Action Candles (1H)
  const lastClosedRaw = candles1h[candles1h.length - 2];
  const prevClosedRaw = candles1h[candles1h.length - 3];
  
  const getCandleDetails = (c: any) => {
    if (!c) return null;
    const body = Math.abs(c.close - c.open);
    const upper = c.high - Math.max(c.open, c.close);
    const lower = Math.min(c.open, c.close) - c.low;
    return {
      open: Number(c.open.toFixed(2)),
      high: Number(c.high.toFixed(2)),
      low: Number(c.low.toFixed(2)),
      close: Number(c.close.toFixed(2)),
      body_size_usd: Number(body.toFixed(2)),
      upper_wick_usd: Number(upper.toFixed(2)),
      lower_wick_usd: Number(lower.toFixed(2)),
      pattern_detected: detectCandlePattern(c.open, c.high, c.low, c.close)
    };
  };

  // 4. Market Structure Swings (1H)
  const len = candles1h.length;
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 2; i < len - 2; i++) {
    const c = candles1h[i];
    if (
      c.high > candles1h[i - 1].high &&
      c.high > candles1h[i - 2].high &&
      c.high > candles1h[i + 1].high &&
      c.high > candles1h[i + 2].high
    ) {
      swingHighs.push(c.high);
    }
    if (
      c.low < candles1h[i - 1].low &&
      c.low < candles1h[i - 2].low &&
      c.low < candles1h[i + 1].low &&
      c.low < candles1h[i + 2].low
    ) {
      swingLows.push(c.low);
    }
  }
  const sh1 = swingHighs[swingHighs.length - 1] || currentPrice;
  const sh2 = swingHighs[swingHighs.length - 2] || sh1;
  const sl1 = swingLows[swingLows.length - 1] || currentPrice;
  const sl2 = swingLows[swingLows.length - 2] || sl1;
  
  let structureTrend = 'CONSOLIDATING';
  if (sh1 > sh2 && sl1 > sl2) {
    structureTrend = 'BULLISH_HIGHER_HIGHS_AND_HIGHER_LOWS';
  } else if (sh1 < sh2 && sl1 < sl2) {
    structureTrend = 'BEARISH_LOWER_HIGHS_AND_LOWER_LOWS';
  }

  // 5. Key Levels Precalculated
  const prevDay = dailyAgg[0] || { high: currentPrice, low: currentPrice, close: currentPrice };
  const H = prevDay.high;
  const L = prevDay.low;
  const C = prevDay.close;
  const PP = (H + L + C) / 3;
  const R1 = (2 * PP) - L;
  const S1 = (2 * PP) - H;

  const minSwing = Math.min(sh1, sl1);
  const maxSwing = Math.max(sh1, sl1);
  const swingDiff = maxSwing - minSwing;
  const isBullishSwings = structureTrend.includes('BULLISH');
  const fib382 = isBullishSwings ? maxSwing - 0.382 * swingDiff : minSwing + 0.382 * swingDiff;
  const fib500 = minSwing + 0.5 * swingDiff;
  const fib618 = isBullishSwings ? maxSwing - 0.618 * swingDiff : minSwing + 0.618 * swingDiff;

  // Helper for 15m candles reference inside volatile check
  function candles15m(c5m: OuncePriceCandle[]) {
    return aggregateTo15m(c5m);
  }

  // 6. Moving Averages
  const ema20 = calculateEMA(closes1h, 20);
  const sma50 = calculateSMA(closes1h, 50);
  const sma200 = calculateSMA(closes1h, 200);

  // Oscillators
  const rsiCurrent = calculateRSI(closes1h, 14);
  const rsiPrev = calculateRSI(closes1h.slice(0, -1), 14);
  const rsiRising = rsiCurrent > rsiPrev;
  let rsiStatus = 'NEUTRAL';
  if (rsiCurrent >= 70) {
    rsiStatus = rsiRising ? 'OVERBOUGHT_RISING' : 'OVERBOUGHT_FALLING';
  } else if (rsiCurrent <= 30) {
    rsiStatus = rsiRising ? 'OVERSOLD_RISING' : 'OVERSOLD_FALLING';
  } else {
    rsiStatus = rsiRising ? 'RISING_IN_NEUTRAL_ZONE' : 'FALLING_IN_NEUTRAL_ZONE';
  }

  const macdVal = calculateMACD(closes1h);
  const prevMacdVal = calculateMACD(closes1h.slice(0, -1));
  let macdStatus = 'NEUTRAL';
  if (macdVal.macdLine > macdVal.signalLine && prevMacdVal.macdLine <= prevMacdVal.signalLine) {
    macdStatus = 'BULLISH_CROSSOVER_ACTIVE';
  } else if (macdVal.macdLine < macdVal.signalLine && prevMacdVal.macdLine >= prevMacdVal.signalLine) {
    macdStatus = 'BEARISH_CROSSOVER_ACTIVE';
  } else if (macdVal.macdLine > macdVal.signalLine) {
    macdStatus = macdVal.histogram > prevMacdVal.histogram ? 'BULLISH_MOMENTUM_EXPANDING' : 'BULLISH_MOMENTUM_CONTRACTING';
  } else {
    macdStatus = macdVal.histogram < prevMacdVal.histogram ? 'BEARISH_MOMENTUM_EXPANDING' : 'BEARISH_MOMENTUM_CONTRACTING';
  }

  const bbVal = calculateBollingerBands(closes1h, 20, 2);
  let bbPosition = 'BETWEEN_MIDDLE_AND_LOWER_BAND';
  if (currentPrice > bbVal.upper) {
    bbPosition = 'ABOVE_UPPER_BAND';
  } else if (currentPrice < bbVal.lower) {
    bbPosition = 'BELOW_LOWER_BAND';
  } else if (currentPrice >= bbVal.middle) {
    bbPosition = 'BETWEEN_MIDDLE_AND_UPPER_BAND';
  }

  // 7. SMC
  const ob1h = findOrderBlocks(candles1h, '1h');
  const fvg1h = findFVGs(candles1h, '1h');

  const supplyAbove = ob1h.filter(ob => ob.type === 'Bearish' && !ob.mitigated && ob.bottom > currentPrice).sort((a,b) => a.bottom - b.bottom)[0];
  const demandBelow = ob1h.filter(ob => ob.type === 'Bullish' && !ob.mitigated && ob.top < currentPrice).sort((a,b) => b.top - a.top)[0];
  const fvgAbove = fvg1h.filter(f => f.type === 'Bearish' && !f.mitigated && f.bottom > currentPrice).sort((a,b) => a.bottom - b.bottom)[0];
  const fvgBelow = fvg1h.filter(f => f.type === 'Bullish' && !f.mitigated && f.top < currentPrice).sort((a,b) => b.top - a.top)[0];

  // 8. TPO Volume Profile
  const tpo = calculateDailyTPOProfile(candles5m, currentPrice);

  return {
    asset_info: {
      symbol: 'XAUUSD',
      current_price: Number(currentPrice.toFixed(2)),
      market_context: {
        active_session: activeSession,
        is_market_open: isMarketOpen,
        market_status: isMarketOpen ? 'OPEN' : 'CLOSED',
        spread_usd: spread,
        minutes_to_hourly_close: minutesToHourlyClose,
        minutes_to_daily_close: minutesToDailyClose,
        minutes_to_high_impact_news: newsCheck.near ? newsCheck.timeDiffMinutes : 999,
        upcoming_news_event: newsCheck.near ? `RED_USD_${newsCheck.eventName?.replace(/\s+/g, '_')}` : 'NONE'
      }
    },
    volatility_and_risk_metrics: {
      hourly_ATR_usd: Number(atr1h.toFixed(2)),
      daily_ATR_usd: Number(adr14.toFixed(2))
    },
    price_action_candles_1H: {
      last_closed_candle: getCandleDetails(lastClosedRaw),
      previous_closed_candle: getCandleDetails(prevClosedRaw)
    },
    market_structure_swings_1H: {
      structure_trend: structureTrend,
      last_swing_high: { price: Number(sh1.toFixed(2)), distance_usd_from_current: Number((sh1 - currentPrice).toFixed(2)) },
      last_swing_low: { price: Number(sl1.toFixed(2)), distance_usd_from_current: Number((sl1 - currentPrice).toFixed(2)) },
      previous_swing_high: { price: Number(sh2.toFixed(2)), distance_usd_from_current: Number((sh2 - currentPrice).toFixed(2)) },
      previous_swing_low: { price: Number(sl2.toFixed(2)), distance_usd_from_current: Number((sl2 - currentPrice).toFixed(2)) }
    },
    key_levels_precalculated: {
      daily_pivot_points: {
        R1: { price: Number(R1.toFixed(2)), distance_usd: Number((R1 - currentPrice).toFixed(2)) },
        PP: { price: Number(PP.toFixed(2)), distance_usd: Number((PP - currentPrice).toFixed(2)) },
        S1: { price: Number(S1.toFixed(2)), distance_usd: Number((S1 - currentPrice).toFixed(2)) }
      },
      fibonacci_retracement_last_swing: {
        '0.382': { price: Number(fib382.toFixed(2)), distance_usd: Number((fib382 - currentPrice).toFixed(2)) },
        '0.500': { price: Number(fib500.toFixed(2)), distance_usd: Number((fib500 - currentPrice).toFixed(2)) },
        '0.618': { price: Number(fib618.toFixed(2)), distance_usd: Number((fib618 - currentPrice).toFixed(2)) }
      }
    },
    technical_indicators_1H: {
      moving_averages: {
        EMA_20: { price: Number(ema20.toFixed(2)), distance_usd: Number((ema20 - currentPrice).toFixed(2)), position_relative_to_current_price: currentPrice >= ema20 ? 'BELOW_PRICE' : 'ABOVE_PRICE' },
        SMA_50: { price: Number(sma50.toFixed(2)), distance_usd: Number((sma50 - currentPrice).toFixed(2)), position_relative_to_current_price: currentPrice >= sma50 ? 'BELOW_PRICE' : 'ABOVE_PRICE' },
        SMA_200: { price: Number(sma200.toFixed(2)), distance_usd: Number((sma200 - currentPrice).toFixed(2)), position_relative_to_current_price: currentPrice >= sma200 ? 'BELOW_PRICE' : 'ABOVE_PRICE' }
      },
      oscillators: {
        RSI_14: {
          current_value: Number(rsiCurrent.toFixed(2)),
          previous_candle_value: Number(rsiPrev.toFixed(2)),
          rsi_status: rsiStatus
        },
        MACD: {
          macd_line: macdVal.macdLine,
          signal_line: macdVal.signalLine,
          histogram_value: macdVal.histogram,
          macd_status: macdStatus
        }
      },
      bollinger_bands_20_2: {
        upper_band: { price: bbVal.upper, distance_usd: Number((bbVal.upper - currentPrice).toFixed(2)) },
        middle_band: { price: bbVal.middle, distance_usd: Number((bbVal.middle - currentPrice).toFixed(2)) },
        lower_band: { price: bbVal.lower, distance_usd: Number((bbVal.lower - currentPrice).toFixed(2)) },
        price_position: bbPosition
      }
    },
    smart_money_concepts_SMC_1H: {
      fair_value_gaps_FVG: {
        closest_unmitigated_above: fvgAbove ? { bottom_edge: fvgAbove.bottom, top_edge: fvgAbove.top, distance_to_closest_edge_usd: Number((fvgAbove.bottom - currentPrice).toFixed(2)) } : null,
        closest_unmitigated_below: fvgBelow ? { top_edge: fvgBelow.top, bottom_edge: fvgBelow.bottom, distance_to_closest_edge_usd: Number((fvgBelow.top - currentPrice).toFixed(2)) } : null
      },
      order_blocks: {
        closest_supply_above: supplyAbove ? { price: supplyAbove.bottom, distance_usd: Number((supplyAbove.bottom - currentPrice).toFixed(2)) } : null,
        closest_demand_below: demandBelow ? { price: demandBelow.top, distance_usd: Number((demandBelow.top - currentPrice).toFixed(2)) } : null
      }
    },
    volume_profile_daily: {
      Point_of_Control_POC: { price: tpo.poc, distance_usd: Number((tpo.poc - currentPrice).toFixed(2)), price_position: tpo.position },
      Value_Area_High_VAH: { price: tpo.vah, distance_usd: Number((tpo.vah - currentPrice).toFixed(2)) },
      Value_Area_Low_VAL: { price: tpo.val, distance_usd: Number((tpo.val - currentPrice).toFixed(2)) }
    },
    macro_proxies: {
      US_Dollar_Index_DXY: dxyPriceAndChange ? { price: dxyPriceAndChange.price, daily_change_percent: dxyPriceAndChange.changePercent } : { daily_change_percent: 0 },
      US_10Y_Treasury_Yield: us10yPriceAndChange ? { price: us10yPriceAndChange.price, daily_change_percent: us10yPriceAndChange.changePercent } : { daily_change_percent: 0 }
    }
  };
}
