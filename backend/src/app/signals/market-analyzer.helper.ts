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
  } else if (hour >= 13 && hour < 21) {
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
