import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { AuthService } from '../services/auth.service';
import { User } from '@ounce24/types';

@Directive({
  selector: 'img[appAvatar]',
  standalone: true,
})
export class AvatarDirective implements OnInit {
  appAvatar = input<User | undefined>();
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

    const user = this.appAvatar() || this.authService.userQuery.data();
    // Use telegram avatar URL when available (from Telegram login)
    if (user?.avatar && user.avatar.startsWith('http')) {
      img.src = user.avatar;
      return;
    }

    let src = `https://api.dicebear.com/9.x/bottts-neutral/${this.type() || 'svg'}`;
    if (user) {
      src += `?seed=${user.id}`;
      if (user.avatar) src += `&${user.avatar || user.id}`;
    }
    if (this.color()) {
      src =
        src.replace(/&backgroundColor=[^&]*/, '') +
        `&backgroundColor=${this.color()}`;
    }
    if (this.mouth()) {
      src = src.replace(/&mouth=[^&]*/, '') + `&mouth=${this.mouth()}`;
    }
    if (this.eye()) {
      src = src.replace(/&eyes=[^&]*/, '') + `&eyes=${this.eye()}`;
    }
    if (this.size()) {
      src = src.replace(/&size=[^&]*/, '') + `&size=${this.size()}`;
    }

    img.src = src;
  }
}
