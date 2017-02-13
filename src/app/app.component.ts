

import { Component } from '@angular/core';
import { Config, Platform } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';
import { RoundProgressConfig } from 'angular-svg-round-progressbar';
import { TranslateService } from 'ng2-translate/ng2-translate';

import { TabsPage } from '../pages/tabs/tabs';



@Component({
  templateUrl: 'app.html'
  , providers: [RoundProgressConfig]
})
export class MyApp {
  rootPage = TabsPage;

  constructor(
    platform: Platform
    , config: Config
    , translate: TranslateService,
    // , private _roundProgressConfig: RoundProgressConfig
  ) {
    // Set the default language for translation strings, and the current language.
    translate.setDefaultLang('en');
    translate.use('en');
    translate.get(['BACK_BUTTON_TEXT']).subscribe(values => {
      config.set('ios', 'backButtonText', values.BACK_BUTTON_TEXT);
    });


    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      StatusBar.styleDefault();
      Splashscreen.hide();
    });
    // _roundProgressConfig.setDefaults({
    //   rounded: true,
    //   responsive: true
    // })
  }
}
