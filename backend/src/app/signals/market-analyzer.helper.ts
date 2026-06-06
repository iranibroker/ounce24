import { OuncePriceCandle } from '@ounce24/types';

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
  rsi5m: number;
  rsi15m: number;
  rsi1h: number;
  atr5m: number;
  keySupports: number[];
  keyResistances: number[];
  semanticText: string;
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

  const candles1h = aggregateTo1h(candles5m);
  const closes1h = candles1h.map((c) => c.close);
  const rsi1h = calculateRSI(closes1h, 14);
  const sma20_1h = calculateSMA(closes1h, 20);
  const sma50_1h = calculateSMA(closes1h, 50);

  let trend1h: 'Bullish' | 'Bearish' | 'Consolidating' = 'Consolidating';
  if (currentPrice > sma20_1h && currentPrice > sma50_1h && sma20_1h > sma50_1h) {
    trend1h = 'Bullish';
  } else if (currentPrice < sma20_1h && currentPrice < sma50_1h && sma20_1h < sma50_1h) {
    trend1h = 'Bearish';
  }

  const candles4h = aggregateTo4h(candles5m);
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

  let semanticText = `CURRENT GOLD PRICE: $${currentPrice.toFixed(2)}\n\n`;

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

  semanticText += `[Key Technical Indicators]\n`;
  semanticText += `- 5-minute Volatility (ATR 14): $${atr5m.toFixed(2)}\n`;
  semanticText += `- 5m RSI (14): ${rsi5m.toFixed(2)}\n`;
  semanticText += `- 15m RSI (14): ${rsi15m.toFixed(2)}\n`;
  semanticText += `- 1h RSI (14): ${rsi1h.toFixed(2)}\n\n`;

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
    rsi5m,
    rsi15m,
    rsi1h,
    atr5m,
    keySupports,
    keyResistances,
    semanticText,
  };
}
