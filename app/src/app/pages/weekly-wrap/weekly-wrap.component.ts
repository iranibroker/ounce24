import { Component, inject, computed, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { lastValueFrom } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { 
  saxCloseCircleOutline,
  saxVolumeHighOutline,
  saxVolumeCrossOutline,
  saxArrowRightOutline,
  saxArrowLeftOutline,
  saxShareOutline,
  saxDocumentDownloadOutline,
  saxStarOutline,
  saxCupOutline
} from '@ng-icons/iconsax/outline';
import {
  saxDiamondsBold,
  saxCupBold
} from '@ng-icons/iconsax/bold';
import { AuthService } from '../../services/auth.service';
import { DataLoadingComponent } from '../../components/data-loading/data-loading.component';
import { SHARED } from '../../shared';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-weekly-wrap',
  standalone: true,
  imports: [
    CommonModule,
    SHARED,
    MatButtonModule,
    MatCardModule,
    MatSnackBarModule,
    NgIcon,
    DataLoadingComponent,
  ],
  providers: [
    provideIcons({
      saxCloseCircleOutline,
      saxVolumeHighOutline,
      saxVolumeCrossOutline,
      saxArrowRightOutline,
      saxArrowLeftOutline,
      saxDiamondsBold,
      saxStarOutline,
      saxCupOutline,
      saxCupBold,
      saxShareOutline,
      saxDocumentDownloadOutline,
    }),
  ],
  templateUrl: './weekly-wrap.component.html',
  styleUrls: ['./weekly-wrap.component.scss'],
})
export class WeeklyWrapComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  public readonly location = inject(Location);
  public readonly auth = inject(AuthService);
  public readonly translate = inject(TranslateService);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);

  // Weekly wrap query
  weeklyWrapQuery = injectQuery(() => {
    const user = this.auth.userQuery.data();
    const isMock = this.route.snapshot.queryParams['mock'] === 'true';
    const queryUserId = this.route.snapshot.queryParams['userId'] || user?.id || (user as any)?._id || (isMock ? 'mock-user' : undefined);
    return {
      queryKey: ['weeklyWrap', queryUserId, isMock],
      queryFn: () => {
        if (isMock) {
          return Promise.resolve({
            username: user?.name || user?.telegramUsername || 'Elite Trader',
            avatar: user?.avatar || 'assets/images/default-avatar.png',
            title: user?.title || 'Gold Master',
            platformSignals: 342,
            weekSignals: 4,
            weekWinSignals: 3,
            weekScore: 18.5,
            weekWinRate: 75.0,
            gemsEarned: 10,
            weeklyRank: 15,
            bestSignal: {
              type: 'buy',
              isSell: false,
              entryPrice: 2315.4,
              closedOuncePrice: 2368.8,
              pip: 534,
              score: 42.5,
              status: 'CLOSED',
              closedAt: new Date().toISOString(),
              owner: {
                name: 'Arash_Gold',
                avatar: 'assets/images/avatar-1.png',
                title: 'Master Scalper',
              }
            },
            marketStats: {
              open: 2305.2,
              close: 2372.5,
              high: 2385.0,
              low: 2298.1,
              change: 67.3,
              changePercent: 2.92,
            },
            topTrader: {
              name: 'Arash_Gold',
              avatar: 'assets/images/avatar-1.png',
              title: 'Master Scalper',
              weekScore: 142.0,
              weekWinRate: 85.0,
            },
            startOfTradingWeek: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            endOfTradingWeek: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }
        return lastValueFrom(
          this.http.get<any>(`/api/users/${queryUserId}/weekly-wrap`),
        );
      },
      enabled: !!queryUserId,
    };
  });

  data = computed(() => this.weeklyWrapQuery.data());

  // Story state
  activeSlide = 0;
  isPlaying = false;
  currentSlideProgress = 0;
  isMuted = true;

  // Audio object (Royalty-free lo-fi sound track for background vibes)
  audio = new Audio('https://assets.codepen.io/25868/lofi-beat.mp3');

  // Animation ticks
  private animationFrameId?: number;
  private lastTime = 0;
  private readonly progressDuration = 6000; // 6 seconds per slide

  // Compute slides dynamically
  slides = computed(() => {
    const data = this.weeklyWrapQuery.data();
    if (!data) return [];

    const list = [
      { type: 'intro' },
      { type: 'platformActivity' },
    ];

    if (data.bestSignal) {
      list.push({ type: 'bestTrade' });
    }

    list.push({ type: 'market' });
    list.push({ type: 'standing' });
    list.push({ type: 'personal' });
    list.push({ type: 'share' });

    return list;
  });

  ngOnInit() {
    // Loop audio
    this.audio.loop = true;
    this.audio.volume = 0.5;
  }

  startWrap() {
    // Play sound and unmute
    this.isMuted = false;
    this.audio.muted = false;
    this.audio.play().catch((err) => {
      console.log('Audio autoplay blocked by browser:', err);
      this.isMuted = true;
      this.audio.muted = true;
    });

    this.nextSlide();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.muted = this.isMuted;
    if (!this.isMuted) {
      this.audio.play().catch((err) => console.log('Audio error:', err));
    }
  }

  // Next / Prev triggers
  nextSlide() {
    this.pauseAutoplay();
    const slidesList = this.slides();
    if (this.activeSlide < slidesList.length - 1) {
      this.activeSlide++;
      this.currentSlideProgress = 0;
      this.startAutoplay();
    } else {
      // Hold on the final card
      this.currentSlideProgress = 100;
      this.isPlaying = false;
    }
  }

  prevSlide() {
    this.pauseAutoplay();
    if (this.activeSlide > 0) {
      this.activeSlide--;
      this.currentSlideProgress = 0;
      this.startAutoplay();
    } else {
      this.currentSlideProgress = 0;
      this.startAutoplay();
    }
  }

  // Animation frame handlers
  startAutoplay() {
    this.isPlaying = true;
    this.lastTime = performance.now();
    this.tick();
  }

  pauseAutoplay() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  resumeAutoplay() {
    // Resume only if not on the last slide
    if (this.activeSlide >= this.slides().length - 1) return;
    this.isPlaying = true;
    this.lastTime = performance.now();
    this.tick();
  }

  private tick() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.currentSlideProgress += (delta / this.progressDuration) * 100;

    if (this.currentSlideProgress >= 100) {
      this.currentSlideProgress = 0;
      this.nextSlide();
    } else {
      this.animationFrameId = requestAnimationFrame(() => this.tick());
    }
  }

  // Touch handlers for holding / pausing
  onTouchStart() {
    this.pauseAutoplay();
  }

  onTouchEnd() {
    this.resumeAutoplay();
  }

  // Visual Share Card rendering with HTML5 Canvas
  private loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  }

  private drawRoundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Visual Share Card rendering with HTML5 Canvas
  private drawSignalIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = size * 0.12;
    ctx.lineCap = 'round';
    // Center dot
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, size * 0.3, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Ring 1
    ctx.beginPath();
    ctx.arc(0, size * 0.3, size * 0.3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // Ring 2
    ctx.beginPath();
    ctx.arc(0, size * 0.3, size * 0.6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();
  }

  private drawStarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawTrophyIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    // Cup bowl
    ctx.arc(0, -size * 0.4, size * 0.35, 0, Math.PI, false);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    // Stand
    ctx.fillRect(-size * 0.06, 0, size * 0.12, size * 0.3);
    ctx.fillRect(-size * 0.2, size * 0.3, size * 0.4, size * 0.08);
    // Handles
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.arc(-size * 0.35, -size * 0.4, size * 0.18, Math.PI * 0.5, Math.PI * 1.5, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size * 0.35, -size * 0.4, size * 0.18, Math.PI * 1.5, Math.PI * 0.5, false);
    ctx.stroke();
    ctx.restore();
  }

  private async generateRecapCanvas(data: any): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');

    // 1. Background Gradient (Deep Warm Charcoal / Dark Gold vibes)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGrad.addColorStop(0, '#0a0a0c');
    bgGrad.addColorStop(0.5, '#121216');
    bgGrad.addColorStop(1, '#050507');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Glowing amber lights in the background
    const glow1 = ctx.createRadialGradient(540, 200, 100, 540, 200, 800);
    glow1.addColorStop(0, 'rgba(251, 191, 36, 0.12)');
    glow1.addColorStop(0.5, 'rgba(217, 119, 6, 0.04)');
    glow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow1;
    ctx.beginPath();
    ctx.arc(540, 200, 800, 0, Math.PI * 2);
    ctx.fill();

    const glow2 = ctx.createRadialGradient(900, 1600, 50, 900, 1600, 700);
    glow2.addColorStop(0, 'rgba(74, 222, 128, 0.08)');
    glow2.addColorStop(0.5, 'rgba(4, 120, 87, 0.02)');
    glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow2;
    ctx.beginPath();
    ctx.arc(900, 1600, 700, 0, Math.PI * 2);
    ctx.fill();

    // 2. Double Borders
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.lineWidth = 4;
    this.drawRoundedRectPath(ctx, 40, 40, 1000, 1840, 36);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.05)';
    ctx.lineWidth = 12;
    this.drawRoundedRectPath(ctx, 52, 52, 976, 1816, 30);
    ctx.stroke();

    // Corner decorative lines
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(80, 55); ctx.lineTo(55, 80); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1000, 55); ctx.lineTo(1025, 80); ctx.stroke();

    const isRtl = this.translate.currentLang === 'fa' || this.translate.currentLang === 'ar';
    ctx.direction = 'ltr'; // Using manual coordinate adjustments for layout

    // 3. Header Capsule Badge
    ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.lineWidth = 2;
    this.drawRoundedRectPath(ctx, 450, 100, 180, 48, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px Estedad, Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OUNCE24', 540, 124);

    // 4. Main Title Text
    const goldGrad = ctx.createLinearGradient(300, 0, 780, 0);
    goldGrad.addColorStop(0, '#FFE259');
    goldGrad.addColorStop(1, '#FFA751');
    ctx.fillStyle = goldGrad;
    ctx.font = 'bold 56px Estedad, Outfit, Inter, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(isRtl ? 'مرور هفتگی پلتفرم' : 'WEEKLY RECAP', 540, 230);

    // 5. Date Range Subtitle
    const startStr = new Date(data.startOfTradingWeek).toLocaleDateString(
      isRtl ? 'fa-IR' : 'en-US',
      { month: 'short', day: 'numeric' }
    );
    const endStr = new Date(data.endOfTradingWeek).toLocaleDateString(
      isRtl ? 'fa-IR' : 'en-US',
      { month: 'short', day: 'numeric' }
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '26px Estedad, Outfit, Inter, sans-serif';
    ctx.fillText(isRtl ? `هفته معاملاتی: ${startStr} تا ${endStr}` : `Trading Week: ${startStr} - ${endStr}`, 540, 285);

    // 6. User Profile Section
    const avatarX = 540;
    const avatarY = 440;
    const avatarRadius = 75;

    let avatarImg = null;
    if (data.avatar) {
      avatarImg = await this.loadImage(data.avatar);
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatarImg) {
      ctx.drawImage(
        avatarImg,
        avatarX - avatarRadius,
        avatarY - avatarRadius,
        avatarRadius * 2,
        avatarRadius * 2
      );
    } else {
      const avatarGrad = ctx.createLinearGradient(avatarX - avatarRadius, avatarY - avatarRadius, avatarX + avatarRadius, avatarY + avatarRadius);
      avatarGrad.addColorStop(0, '#FFA751');
      avatarGrad.addColorStop(1, '#FFE259');
      ctx.fillStyle = avatarGrad;
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 44px Estedad, Outfit, Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const nameStr = data.title || data.username || 'U';
      const initials = nameStr.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
      ctx.fillText(initials, avatarX, avatarY);
    }
    ctx.restore();

    // Outer avatar gold ring
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius + 3, 0, Math.PI * 2);
    ctx.stroke();

    // Username & Level Badge
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px Estedad, Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(data.username || 'Trader', 540, 560);

    ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 1;
    this.drawRoundedRectPath(ctx, 420, 580, 240, 36, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = '600 18px Estedad, Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.title || 'Gold Analyst', 540, 598);

    // 7. Render Card 1: Platform Highlights
    const drawGlassCard = (x: number, y: number, w: number, h: number, title: string) => {
      // Glass effect panel
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      this.drawRoundedRectPath(ctx, x, y, w, h, 24);
      ctx.fill();
      ctx.stroke();

      // Card header
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 24px Estedad, Outfit, Inter, sans-serif';
      ctx.textAlign = isRtl ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, isRtl ? x + w - 40 : x + 40, y + 45);

      // Card Header underline
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 30, y + 75);
      ctx.lineTo(x + w - 30, y + 75);
      ctx.stroke();
    };

    const drawCardRow = (cardX: number, cardY: number, cardW: number, rowIdx: number, label: string, value: string, iconType?: 'signal' | 'star' | 'trophy', highlightVal = true) => {
      const rowY = cardY + 115 + (rowIdx * 70);
      const textXLabel = isRtl ? cardX + cardW - 80 : cardX + 80;
      const textXVal = isRtl ? cardX + 80 : cardX + cardW - 80;
      const iconX = isRtl ? cardX + cardW - 45 : cardX + 45;

      // Draw vector icons directly on canvas
      if (iconType === 'signal') {
        this.drawSignalIcon(ctx, iconX, rowY - 15, 20);
      } else if (iconType === 'star') {
        this.drawStarIcon(ctx, iconX, rowY - 2, 5, 12, 6);
      } else if (iconType === 'trophy') {
        this.drawTrophyIcon(ctx, iconX, rowY + 5, 20);
      }

      // Draw Label
      ctx.font = '22px Estedad, Outfit, Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.textAlign = isRtl ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, textXLabel, rowY);

      // Draw Value
      ctx.font = 'bold 24px Estedad, Outfit, Inter, sans-serif';
      ctx.fillStyle = highlightVal ? '#fbbf24' : '#ffffff';
      ctx.textAlign = isRtl ? 'left' : 'right';
      ctx.fillText(value, textXVal, rowY);
    };

    // Card 1 Layout (Platform)
    const platCardY = 660;
    drawGlassCard(100, platCardY, 880, 310, isRtl ? 'نکات برجسته جامعه' : 'COMMUNITY HIGHLIGHTS');
    drawCardRow(100, platCardY, 880, 0, this.translate.instant('weeklyWrap.canvas.platformSignals'), `${data.platformSignals} SIGS`, 'signal');
    drawCardRow(100, platCardY, 880, 1, this.translate.instant('weeklyWrap.canvas.bestTrader'), data.bestSignal?.owner?.name || 'N/A', 'star', false);
    drawCardRow(100, platCardY, 880, 2, this.translate.instant('weeklyWrap.canvas.champion'), data.topTrader?.name || 'N/A', 'trophy', false);

    // Card 2 Layout (Personal Performance)
    const persCardY = 1000;
    drawGlassCard(100, persCardY, 880, 310, isRtl ? 'عملکرد هفتگی شما' : 'YOUR WEEKLY PERFORMANCE');
    drawCardRow(100, persCardY, 880, 0, this.translate.instant('weeklyWrap.canvas.yourSignals'), `${data.weekSignals} SIGS`, 'signal');
    
    // Draw score row with green or red depending on value
    const scoreVal = data.weekScore || 0;
    const scoreSign = scoreVal >= 0 ? '+' : '';
    const scoreText = `${scoreSign}${scoreVal.toFixed(1)} PTS`;
    
    const scoreRowY = persCardY + 115 + (1 * 70);
    const scoreLabelX = isRtl ? 100 + 880 - 80 : 100 + 80;
    const scoreValX = isRtl ? 100 + 80 : 100 + 880 - 80;
    const scoreIconX = isRtl ? 100 + 880 - 45 : 100 + 45;
    
    this.drawStarIcon(ctx, scoreIconX, scoreRowY - 2, 5, 12, 6);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.textAlign = isRtl ? 'right' : 'left';
    ctx.fillText(this.translate.instant('weeklyWrap.canvas.yourScore'), scoreLabelX, scoreRowY);
    
    ctx.font = 'bold 24px Estedad, Outfit, Inter, sans-serif';
    ctx.fillStyle = scoreVal >= 0 ? '#4ade80' : '#f87171';
    ctx.textAlign = isRtl ? 'left' : 'right';
    ctx.fillText(scoreText, scoreValX, scoreRowY);

    drawCardRow(100, persCardY, 880, 2, this.translate.instant('weeklyWrap.canvas.yourRank'), data.weeklyRank ? `#${data.weeklyRank}` : 'N/A', 'trophy');

    // Card 3 Layout (Gold Market Recap)
    const mktCardY = 1340;
    drawGlassCard(100, mktCardY, 880, 270, isRtl ? 'نوسانات اونس طلا' : 'GOLD MARKET PERFORMANCE');

    const openVal = data.marketStats?.open || 0;
    const closeVal = data.marketStats?.close || 0;
    const highVal = data.marketStats?.high || 0;
    const lowVal = data.marketStats?.low || 0;
    const changeVal = data.marketStats?.change || 0;
    const percentVal = data.marketStats?.changePercent || 0;

    // Market Range Text Open -> Close
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Estedad, Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const marketText = isRtl
      ? `شروع: $${openVal.toFixed(1)}  ←  پایان: $${closeVal.toFixed(1)}`
      : `Open: $${openVal.toFixed(1)}  →  Close: $${closeVal.toFixed(1)}`;
    ctx.fillText(marketText, 540, mktCardY + 115);

    // Range slider track visualization on canvas
    const trackX = 180;
    const trackY = mktCardY + 170;
    const trackW = 720;
    const trackH = 8;
    
    // Draw base track path
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.drawRoundedRectPath(ctx, trackX, trackY, trackW, trackH, 4);
    ctx.fill();

    // Draw active fill between low and high
    const rangeTotal = (highVal - lowVal) || 1;
    const fillStartPercent = Math.max(0, Math.min(1, (Math.min(openVal, closeVal) - lowVal) / rangeTotal));
    const fillEndPercent = Math.max(0, Math.min(1, (Math.max(openVal, closeVal) - lowVal) / rangeTotal));
    
    const fillX = trackX + (fillStartPercent * trackW);
    const fillW = Math.max(10, (fillEndPercent - fillStartPercent) * trackW);
    
    const goldFillGrad = ctx.createLinearGradient(fillX, 0, fillX + fillW, 0);
    goldFillGrad.addColorStop(0, '#FFE259');
    goldFillGrad.addColorStop(1, '#FFA751');
    ctx.fillStyle = goldFillGrad;
    this.drawRoundedRectPath(ctx, fillX, trackY - 2, fillW, trackH + 4, 6);
    ctx.fill();

    // High / Low Labels below bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '16px Estedad, Outfit, Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Low: $${lowVal.toFixed(1)}`, trackX, trackY + 30);
    ctx.textAlign = 'right';
    ctx.fillText(`High: $${highVal.toFixed(1)}`, trackX + trackW, trackY + 30);

    // Change badge pill
    const changeSign = changeVal >= 0 ? '+' : '';
    const badgeText = `${changeSign}${changeVal.toFixed(1)}$ (${percentVal.toFixed(2)}%)`;
    
    ctx.font = 'bold 20px Estedad, Outfit, Inter, sans-serif';
    const textWidth = ctx.measureText(badgeText).width;
    const pillW = textWidth + 30;
    const pillH = 36;
    const pillX = 540 - (pillW / 2);
    const pillY = mktCardY + 205;
    
    ctx.fillStyle = changeVal >= 0 ? 'rgba(74, 222, 128, 0.12)' : 'rgba(248, 113, 113, 0.12)';
    ctx.strokeStyle = changeVal >= 0 ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)';
    ctx.lineWidth = 1;
    this.drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = changeVal >= 0 ? '#4ade80' : '#f87171';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, 540, pillY + 18);

    // 10. Footer Website & Brand Tagline
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '24px Estedad, Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('app.ounce24.com', 540, 1720);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px Estedad, Outfit, Inter, sans-serif';
    ctx.fillText('Gold Trading & Analytics', 540, 1765);

    return canvas;
  }

  // Visual Share Card rendering with HTML5 Canvas
  async downloadCard(): Promise<void> {
    const data = this.weeklyWrapQuery.data();
    if (!data) return;

    this.snackBar.open(this.translate.instant('weeklyWrap.share.generating') || 'Generating summary card...', undefined, {
      duration: 1500,
    });

    try {
      const canvas = await this.generateRecapCanvas(data);
      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const link = document.createElement('a');
            link.download = `${data.username}_weekly_wrap.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
          }
          resolve();
        }, 'image/png');
      });
    } catch (err) {
      console.error('Error generating card for download:', err);
    }
  }

  // Generate Canvas and share the actual file using Web Share API if supported
  async shareWrap(): Promise<void> {
    const data = this.weeklyWrapQuery.data();
    if (!data) return;

    this.snackBar.open(this.translate.instant('weeklyWrap.share.generating') || 'Generating summary card...', undefined, {
      duration: 1500,
    });

    try {
      const canvas = await this.generateRecapCanvas(data);
      await new Promise<void>((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            resolve();
            return;
          }
          const file = new File([blob], `${data.username}_weekly_wrap.png`, { type: 'image/png' });
          const referralLink = `${window.location.origin}/login?ref=${data.userId || data.id || (data as any)._id}`;
          const shareText = `Check out Ounce24 Weekly Recap! Connect & copy top signals: ${referralLink}`;

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: 'Ounce24 Weekly Recap',
                text: shareText,
              });
            } catch (err) {
              console.log('Share failed:', err);
            }
          } else {
            // Fallback: download card and copy referral text
            const link = document.createElement('a');
            link.download = `${data.username}_weekly_wrap.png`;
            link.href = URL.createObjectURL(blob);
            link.click();

            this.clipboard.copy(shareText);
            this.snackBar.open(this.translate.instant('weeklyWrap.share.copied') || 'Referral link copied and card downloaded!', 'OK', {
              duration: 3000,
            });
          }
          resolve();
        }, 'image/png');
      });
    } catch (err) {
      console.error('Error sharing wrap card:', err);
    }
  }

  closeWrap() {
    this.router.navigate(['/signals']);
  }

  ngOnDestroy() {
    this.pauseAutoplay();
    this.audio.pause();
    this.audio.src = '';
  }
}
