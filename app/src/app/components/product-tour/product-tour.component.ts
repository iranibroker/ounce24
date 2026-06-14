import { Component, Output, EventEmitter, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../services/language.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { saxArrowLeftOutline } from '@ng-icons/iconsax/outline';

interface TourStep {
  elementId: string;
  route: string;
  translationKey: string;
}

@Component({
  selector: 'app-product-tour',
  standalone: true,
  imports: [CommonModule, TranslateModule, NgIcon],
  providers: [provideIcons({ saxArrowLeftOutline })],
  templateUrl: './product-tour.component.html',
  styleUrl: './product-tour.component.scss'
})
export class ProductTourComponent implements OnInit, OnDestroy {
  @Output() completed = new EventEmitter<void>();

  private router = inject(Router);
  private languageService = inject(LanguageService);

  activeStep = signal<number>(0);
  spotlightStyle = signal<{ [key: string]: string }>({});
  popoverStyle = signal<{ [key: string]: string }>({});
  
  steps: TourStep[] = [
    { elementId: 'tour-tab-signals', route: '/signals', translationKey: 'productTour.steps.signals' },
    { elementId: 'tour-tab-market', route: '/market', translationKey: 'productTour.steps.market' },
    { elementId: 'tour-tab-leaderboard', route: '/leaderboard', translationKey: 'productTour.steps.leaderboard' }
  ];

  private resizeListener: any = null;

  get isRTL(): boolean {
    return this.languageService.isRTL();
  }

  ngOnInit() {
    this.goToStep(0);

    // Update spotlight position on window resize
    if (typeof window !== 'undefined') {
      this.resizeListener = () => this.updateSpotlight();
      window.addEventListener('resize', this.resizeListener);
    }
  }

  ngOnDestroy() {
    if (this.resizeListener && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  async goToStep(stepIndex: number) {
    if (stepIndex >= 0 && stepIndex < this.steps.length) {
      this.activeStep.set(stepIndex);
      const step = this.steps[stepIndex];
      
      // 1. Navigate to the page if we're not already there
      if (this.router.url !== step.route) {
        await this.router.navigateByUrl(step.route);
      }

      // 2. Wait for route rendering & DOM rendering
      setTimeout(() => {
        this.updateSpotlight();
      }, 300);
    }
  }

  updateSpotlight() {
    const step = this.steps[this.activeStep()];
    const element = document.getElementById(step.elementId);
    
    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 6;
      
      // Calculate spotlight dimensions
      const top = rect.top - padding;
      const left = rect.left - padding;
      const width = rect.width + padding * 2;
      const height = rect.height + padding * 2;

      this.spotlightStyle.set({
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        opacity: '1'
      });

      // Calculate popover position (above the bottom tab bar)
      // Popover should be centered above the tab
      const popoverWidth = Math.min(320, window.innerWidth - 32);
      const popoverLeft = rect.left + rect.width / 2 - popoverWidth / 2;
      const popoverBottom = window.innerHeight - rect.top + 12; // 12px gap above spotlight

      this.popoverStyle.set({
        bottom: `${popoverBottom}px`,
        left: `${Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, popoverLeft))}px`,
        width: `${popoverWidth}px`,
        opacity: '1'
      });
    } else {
      // Hide if element not found
      this.spotlightStyle.set({ opacity: '0' });
      this.popoverStyle.set({ opacity: '0' });
    }
  }

  next(): void {
    if (this.activeStep() < this.steps.length - 1) {
      this.goToStep(this.activeStep() + 1);
    } else {
      this.finish();
    }
  }

  prev(): void {
    if (this.activeStep() > 0) {
      this.goToStep(this.activeStep() - 1);
    }
  }

  finish(): void {
    this.completed.emit();
  }
}
