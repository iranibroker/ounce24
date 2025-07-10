import { Pipe, PipeTransform } from '@angular/core';
import { User } from '@ounce24/types';

@Pipe({
  name: 'fullname',
})
export class FullnamePipe implements PipeTransform {
  transform(value?: User, ...args: unknown[]): string {
    return User.getFullName(value);
  }
}
