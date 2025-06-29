import { Component } from '@angular/core';
import { ShellComponent } from './shell/shell.component';
import { LanguageService } from './services/language.service';

@Component({
  imports: [ShellComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'app';

  constructor(private languageService: LanguageService) {
    // Language service will handle initialization
    // This ensures RTL is set correctly on app startup
  }
}
