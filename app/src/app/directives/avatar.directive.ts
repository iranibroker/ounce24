import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { AuthService } from '../services/auth.service';

@Directive({
  selector: 'img[appAvatar]',
  standalone: true,
})
export class AvatarDirective implements OnInit {
  appAvatar = input<string | undefined>();
  color = input<string | undefined>();
  mouth = input<string | undefined>();
  eye = input<string | undefined>();
  type = input<string | undefined>();
  size = input<number | undefined>();
  private authService = inject(AuthService);

  constructor(private el: ElementRef<HTMLImageElement>) {
    effect(() => {
      const user = this.authService.userQuery.data();
      this.setImageSource();
    });
  }

  ngOnInit() {
    this.setImageSource();
  }

  private setImageSource() {
    const img = this.el.nativeElement;
    let src = `https://api.dicebear.com/9.x/bottts-neutral/${this.type() || 'svg'}?seed=${this.appAvatar() || this.authService.userQuery.data()?.id}`;
    if (this.color()) {
      src += `&backgroundColor=${this.color()}`;
    }
    if (this.mouth()) {
      src += `&mouth=${this.mouth()}`;
    }
    if (this.eye()) {
      src += `&eyes=${this.eye()}`;
    }
    if (this.size()) {
      src += `&size=${this.size()}`;
    }
    img.src = src;
  }
}
