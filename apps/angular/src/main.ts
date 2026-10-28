import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app.component';

bootstrapApplication(AppComponent, { providers: [provideZonelessChangeDetection()] }).catch(error => {
  console.error(error);
  document.body.textContent = 'Eelf could not start. Check the browser console for details.';
});