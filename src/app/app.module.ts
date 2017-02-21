import { NgModule, ErrorHandler } from '@angular/core';
import { Http } from '@angular/http';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { Storage } from '@ionic/storage';
import { RoundProgressModule } from 'angular-svg-round-progressbar';

import { MyApp } from './app.component';
import { AboutPage } from '../pages/about/about';
import { ContactPage } from '../pages/contact/contact';
import { HomePage } from '../pages/home/home';
import { TabsPage } from '../pages/tabs/tabs';

import { Settings, provideSettings } from '../providers/settings';
import { TimerService, TimerSnapshotPipe } from '../providers/timer-service';
import { WindowRefService } from '../providers/window-ref-service';

import { TranslateModule, TranslateLoader, TranslateStaticLoader } from 'ng2-translate/ng2-translate';

// The translate loader needs to know where to load i18n files
// in Ionic's static asset pipeline.
export function createTranslateLoader(http: Http) {
  return new TranslateStaticLoader(http, './assets/i18n', '.json');
}

/**
 * The Pages array lists all of the pages we want to use in our app.
 * We then take these pages and inject them into our NgModule so Angular
 * can find them. As you add and remove pages, make sure to keep this list up to date.
 */
const pages = [
  AboutPage,
  ContactPage,
  HomePage,
  TabsPage,
];

const pipes = [
  TimerSnapshotPipe
];

export function declarations() {
  let declarations : Array<any> = [MyApp];
  declarations = declarations.concat(pages, pipes);
  return declarations;
}

export function entryComponents() {
  const entry : Array<any> = [MyApp];
  return entry.concat(pages);
}

export function providers() {
  return [
    Storage,

    TimerService,

    WindowRefService,

    { provide: Settings, useFactory: provideSettings, deps: [ Storage, WindowRefService ] },
    // Keep this to enable Ionic's runtime error handling during development
    { provide: ErrorHandler, useClass: IonicErrorHandler }

  ];
}


@NgModule({
  declarations: declarations(),
  imports: [
    IonicModule.forRoot(MyApp)
    , RoundProgressModule
    , TranslateModule.forRoot({
      provide: TranslateLoader,
      useFactory: (createTranslateLoader),
      deps: [Http]
    })
  ],
  bootstrap: [IonicApp],
  entryComponents: entryComponents(),
  providers: providers()
})
export class AppModule {}
