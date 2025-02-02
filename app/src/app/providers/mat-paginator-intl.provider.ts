import { MatPaginatorIntl } from '@angular/material/paginator';
import { Injectable, Provider } from '@angular/core';

@Injectable()
export class PaginatorIntl extends MatPaginatorIntl {
  constructor() {
    super();
    this.getAndInitTranslations();
  }

  getAndInitTranslations() {
    this.itemsPerPageLabel = 'تعداد آیتم در هر صفحه';
    this.nextPageLabel = 'صفحه بعد';
    this.previousPageLabel = 'صفحه قبل';
    this.lastPageLabel = 'آخرین صفحه';
    this.firstPageLabel = 'اولین صفحه';
    this.changes.next();
  }

  override getRangeLabel = (page: number, pageSize: number, length: number) => {
    return `صفحه ${page + 1} از ${Math.floor(length / pageSize) + 1}`;
  };
}

export const paginatorIntlProvider: () => Provider = () => ({
  provide: MatPaginatorIntl,
  useClass: PaginatorIntl,
});
