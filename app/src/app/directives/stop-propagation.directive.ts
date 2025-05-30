import { Directive, HostListener } from '@angular/core';

@Directive({
  standalone: true,
  selector: '[stopPropagation]',
})
export class StopPropagationDirective {
  @HostListener('click', ['$event']) onClick($event: any): void {
    $event.stopPropagation();
  }
}
