import { Inject, Injectable, OpaqueToken } from '@angular/core';
import { Storage } from '@ionic/storage';

import { WindowRefService } from './window-ref-service';
 

export function provideSettings(
  storage: Storage
  , windowRef: WindowRefService
) {
  /**
   * The Settings provider takes a set of default settings for your app.
   *
   * You can add new settings options at any time. Once the settings are saved,
   * these values will not overwrite the saved values (this can be done manually if desired).
   */

  let window = windowRef.nativeWindow;
  Settings.DEBUG = /debug=true/i.test(window.location.search);

  return new Settings(storage, {
    // default key: value pairs
    RESTORE_EXPIRED_TIMERS: true,
    RESTORE_EXPIRED_TIMER_LIMIT: 5*60*1000
  });
}

/**
 * A simple settings/config class for storing key/value pairs with persistence.
 */
@Injectable()
export class Settings {
  private SETTINGS_KEY: string = '_settings';
  static DEBUG: boolean = false;

  settings: any;

  _defaults: any;
  _readyPromise: Promise<any>;

  constructor(
    public storage: Storage, 
    defaults: any
  ) {
    this._defaults = defaults;
  }

  load() {
    return this.storage.get(this.SETTINGS_KEY).then((value) => {
      if(value) {
        this.settings = value;
        console.log("settings.load(), defaults", this._defaults)
        return this._mergeDefaults(this._defaults);
      } else {
        return this.setAll(this._defaults).then((val) => {
          this.settings = val;
        })
      }
    });
  }

  _mergeDefaults(defaults: any) {
    for(let k in defaults) {
      if(!(k in this.settings)) {
        this.settings[k] = defaults[k];
      }
    }
    return this.setAll(this.settings);
  }

  merge(settings: any) {
    for(let k in settings) {
      this.settings[k] = settings[k];
    }
    return this.save();
  }

  setValue(key: string, value: any) {
    this.settings[key] = value;
    return this.storage.set(this.SETTINGS_KEY, this.settings);
  }

  setAll(value: any) {
    return this.storage.set(this.SETTINGS_KEY, value);
  }

  getValue(key: string) {
    return this.storage.get(this.SETTINGS_KEY)
    .then(settings => {
        if (!settings) 
            return this.load().then( ()=> {
                return this.settings[key];
            });
        return settings[key];
    });
  }

  save() {
    return this.setAll(this.settings);
  }

  get allSettings() {
    return this.settings;
  }
}
