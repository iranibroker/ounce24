import { Directive, ElementRef, Input } from '@angular/core';

@Directive({
  standalone: true,
  selector: '[autoFocus]',
})
export class AutoFocusDirective {
  @Input() autoFocus: number | undefined; // Default delay is 0ms if not provided
  private timeout: any;

  constructor(private el: ElementRef<HTMLInputElement>) {}

  ngOnInit(): void {
    this.timeout = setTimeout(() => {
      this.el.nativeElement.focus();
    }, this.autoFocus != undefined ? this.autoFocus : 300);
  }

  ngOnDestroy(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }
}
