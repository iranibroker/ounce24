import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
interface CredentialRequestOptions {
  otp: any;
  signal: any;
}

@Directive({
  selector: '[webOtp]',
  standalone: true,
})
export class WebOtpDirective implements OnInit, OnDestroy {
  // Controller to abort the subscription if required.
  @Output() newOtp = new EventEmitter<string>();
  private ac = new AbortController();
  private timer: any;
  constructor(private el: ElementRef) {}

  @Input() timeout?: number;

  ngOnInit(): void {
    const options: CredentialRequestOptions = {
      otp: { transport: ['sms'] },
      signal: this.ac.signal,
    };
    navigator.credentials
      .get(options)
      .then((otp: any) => {
        this.el.nativeElement.value = otp.code;
        this.newOtp.emit(otp.code);
      })
      .catch((err) => {
        // console.log(err);
      });
    if (this.timeout) {
      this.timer = setTimeout(() => {
        this.ac.abort();
      }, this.timeout);
    }
  }
  ngOnDestroy(): void {
    this.ac.abort();
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }
}
