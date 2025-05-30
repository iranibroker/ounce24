import { PlatformLocation } from '@angular/common';
import { Directive, HostListener } from '@angular/core';

@Directive({
  standalone: true,
  selector: '[goBack]',
})
export class GoBackDirective {
  constructor(private location: PlatformLocation) {}

  @HostListener('click', ['$event']) onClick($event: any): void {
    this.location.back();
  }
}
