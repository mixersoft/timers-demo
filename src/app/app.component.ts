// /// <reference path="../../node_modules/angular-svg-round-progressbar/dist/round-progress.d.ts" />

import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';
import { RoundProgressModule, RoundProgressConfig } from 'angular-svg-round-progressbar';

import { TabsPage } from '../pages/tabs/tabs';


@Component({
  templateUrl: 'app.html'
  , providers: [RoundProgressConfig]
})
export class MyApp {
  rootPage = TabsPage;

  constructor(
    platform: Platform
    // , private _roundProgressConfig: RoundProgressConfig
  ) {
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
