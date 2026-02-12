import { User } from './user';

export enum SignalType {
  Buy = 'BUY',
  Sell = 'SELL',
}

export enum SignalStatus {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Closed = 'CLOSED',
  Canceled = 'CANCELED',
}

export enum SignalSource {
  Web = 'WEB',
  Telegram = 'TELEGRAM',
}

export const SignalStatusText = {
  [SignalStatus.Pending]: '⛳️ Pending',
  [SignalStatus.Active]: '▶️ Active',
  [SignalStatus.Closed]: '🎯 Closed',
  [SignalStatus.Canceled]: '🚫 Canceled',
};

export const SignalTypeText = {
  [SignalType.Buy]: '🔵 Buy',
  [SignalType.Sell]: '🔴 Sell',
};

export class Signal {
  _id: any;
  id: string;

  type: SignalType;

  status: SignalStatus;

  source: SignalSource;

  entryPrice: number;

  maxPrice: number;

  minPrice: number;

  messageId?: number;

  publishable?: boolean;

  riskFree?: boolean;

  telegramBot?: string;

  createdOuncePrice: number;

  closedOuncePrice?: number;

  owner: User;

  instantEntry: boolean;

  createdAt?: Date;

  activeAt?: Date;

  closedAt?: Date;

  deletedAt?: Date;

  //virtual props
  isSell: boolean;
  profit: number;
  loss: number;
  pip: number | null;
  riskReward: number;
  score: number;
  gem?: number;

  static activeTrigger(signal: Signal, ouncePrice: number) {
    if (
      signal.entryPrice === signal.createdOuncePrice &&
      signal.createdOuncePrice !== ouncePrice
    )
      return true;
    const min = Math.min(signal.createdOuncePrice, ouncePrice);
    const max = Math.max(signal.createdOuncePrice, ouncePrice);
    return signal.entryPrice > min && signal.entryPrice < max;
  }

  static closeTrigger(signal: Signal, ouncePrice: number) {
    if (signal.riskFree) {
      if (
        (signal.isSell && ouncePrice >= signal.entryPrice) ||
        (!signal.isSell && ouncePrice <= signal.entryPrice)
      )
        return true;
    }
    return ouncePrice > signal.maxPrice || ouncePrice < signal.minPrice;
  }

  static getActivePip(signal: Signal, ouncePrice: number) {
    const isSell = signal.type === SignalType.Sell;
    const diff = isSell
      ? signal.entryPrice - ouncePrice
      : ouncePrice - signal.entryPrice;
    return Number((diff * 10).toFixed(3));
  }

  static getPipString(signal: Signal, ouncePrice?: number) {
    const diff = ouncePrice
      ? Signal.getActivePip(signal, ouncePrice)
      : signal.pip;
    return `${diff < 0 ? '🟥' : '🟩'} ${diff} pip ${diff < 0 ? 'loss' : 'profit'}`;
  }

  static filterWinSignals(signals: Signal[]) {
    return signals.filter(
      (signal) =>
        signal.status === SignalStatus.Closed &&
        Signal.getActivePip(signal, signal.closedOuncePrice) >= 0,
    );
  }

  static isManualClose(signal: Signal) {
    return (
      signal.closedOuncePrice > signal.minPrice &&
      signal.closedOuncePrice < signal.maxPrice
    );
  }

  static getStatsText(owner: User, showGem = false) {
    let text = `Signals: ${owner.totalSignals}
Win rate: ${owner.winRate?.toFixed(0)}%
Avg risk-reward: ${owner.avgRiskReward?.toFixed(1)}
\n⭐️ Score: \n${owner.score?.toFixed(1)}
    `;

    if (showGem) text += `\n💎 Gems: ${owner.gem}`;

    return text;
  }

  static getMessage(
    signal: Signal,
    options?: {
      showId?: boolean;
      ouncePrice?: number;
      signals?: Signal[];
      skipOwner?: boolean;
    },
  ) {
    let text = `Signal
${SignalTypeText[signal.type]}
Entry price: ${signal.entryPrice}

❌ Stop loss: ${signal.loss}
✅ Take profit: ${signal.profit}

Risk-reward: ${signal.riskReward.toFixed(1)}\n`;

    if (signal.status === SignalStatus.Closed)
      text += `⭐️ Score:\n${signal.score.toFixed(1)}\n`;

    text += `\nStatus: ${SignalStatusText[signal.status]}\n`;

    if (signal.riskFree) text += `🚧 Risk free\n`;

    if (signal.status === SignalStatus.Closed && signal.closedOuncePrice) {
      text += `Close price: ${signal.closedOuncePrice}`;
    }

    if (options?.ouncePrice && signal.status === SignalStatus.Active) {
      text += '\n' + Signal.getPipString(signal, options?.ouncePrice);
    } else if (
      signal.status === SignalStatus.Closed &&
      signal.closedOuncePrice
    ) {
      text += '\n' + Signal.getPipString(signal);
    }

    if (signal.owner && !options?.skipOwner) {
      text += `\n\n👤 ${signal.owner.tag}`;
      text += `\n` + Signal.getStatsText(signal.owner);
    }

    if (options?.showId) text += `\n\n\n^^${signal.id}`;

    return text;
  }
}
