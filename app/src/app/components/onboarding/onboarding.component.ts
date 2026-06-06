import { Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgIconComponent } from '@ng-icons/core';
import { LanguageService } from '../../services/language.service';

interface Slide {
  title: string;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, TranslateModule, NgIconComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent {
  @Output() completed = new EventEmitter<void>();

  private languageService = inject(LanguageService);
  private translateService = inject(TranslateService);

  activeSlide = signal<number>(0);
  slides = signal<Slide[]>([]);

  constructor() {
    // Fetch slides from translations dynamically to support language changes
    this.translateService.get('introTour.slides').subscribe((translatedSlides: Slide[]) => {
      if (Array.isArray(translatedSlides)) {
        this.slides.set(translatedSlides);
      }
    });

    // Also update if language changes
    this.translateService.onLangChange.subscribe(() => {
      this.translateService.get('introTour.slides').subscribe((translatedSlides: Slide[]) => {
        if (Array.isArray(translatedSlides)) {
          this.slides.set(translatedSlides);
        }
      });
    });
  }

  get isRTL(): boolean {
    return this.languageService.isRTL();
  }

  nextSlide(): void {
    if (this.activeSlide() < this.slides().length - 1) {
      this.activeSlide.update(prev => prev + 1);
    } else {
      this.finish();
    }
  }

  prevSlide(): void {
    if (this.activeSlide() > 0) {
      this.activeSlide.update(prev => prev - 1);
    }
  }

  setSlide(index: number): void {
    if (index >= 0 && index < this.slides().length) {
      this.activeSlide.set(index);
    }
  }

  parseDescription(desc: string): { intro: string; items: string[] } {
    if (!desc) return { intro: '', items: [] };
    const lines = desc.split('\n');
    const intro = lines[0];
    const items = lines.slice(1).map(line => line.replace(/^[•\-\*]\s*/, '').trim());
    return { intro, items };
  }

  finish(): void {
    this.completed.emit();
  }
}
