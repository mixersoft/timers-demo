import { Injectable } from '@angular/core';
import { Observable, Subject, Subscription } from "rxjs";
import { Timer } from './timer'
import { CookTimer } from './cook-timer'
import * as _ from 'lodash';
import * as moment from 'moment';

export { 
  Timer, CookTimer 
};

/*
  Generated class for the TimerService provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/

export interface duration {
  duration?: number;   // in seconds
  d?: number;
  days?: number;
  h?: number;
  hours?: number;
  m?: number;
  minutes?: number;
  s?: number;
  seconds?: number;
  // [propName: string]: any;
}

// CookTimer interval specification
export interface checkInterval {
  frequency?: number;       
  duration?: duration;
  // [propName: string]: any;
}

export interface optTimer {
  id?: string;
  label?: string;
  sound?: string;
  onAlert?: (timer: Timer)=>void;
  duration?: duration;
}

export interface optCookTimer extends optTimer {
  checkInterval?: checkInterval;
  onBeep?: (timer: Timer)=>void;
}

export function parseDurationMS(opt: duration | number) : number {
  if (typeof opt == 'number') opt = {'duration': opt};
  if (opt.duration) 
    return opt.duration * 1000;
  else
    return moment.duration(opt).asMilliseconds();
}

const TimerClasses = {
  'Timer': Timer,
  'CookTimer': CookTimer
}

@Injectable()
export class TimerService {
  private _data: {[key:string] : Timer} = {}
  private _tickIntervalHandler: any;

  constructor( ) {
    console.log('Hello TimerService Provider');
  }

  get(id:string | {id:string} ) : Timer {
    let key: string = this._parseId(id);
    const found = key && this._data[key];
    return found;
  }

  create(className: string       , opt: any) : Timer {
    let found : Timer = this.get(opt);
    if (found===null) { 
      console.warn(`WARNING: this timer has been destroyed, id=${opt.id}`);
      return;
    } else if (found) {
      opt['id'] = this._getUniqueId(found.id);
    }
     if (!opt['id']) opt['id'] = this._getUniqueId();

    if (!TimerClasses[className])
      console.warn(`WARNING: className invalid, className=${className}`);

    const myTimer = new TimerClasses[className](opt.id, opt);
    const mySub = myTimer.subscribe({
      next: (o)=>this.tickIfTimerRunning(1000),
      complete: ()=>{
        mySub.unsubscribe();
        this._data[myTimer.id] = null;
      }
    })
    return this._data[myTimer.id] = myTimer;

  }

  /**
   * create/set Timer
   * @param opt duration | number, duration for timer in seconds
   * @param id string (optional), unique id of timer, defaults to Unixtime
   */
  setTimer(value: duration | number , id?:string) : Timer {
    let found : Timer = this.get(id);
    if (found===null) { 
      console.warn(`WARNING: this timer has been destroyed, id=${id}`);
      return;
    }
    let duration: duration;
    if (typeof value == 'number') 
      duration = {'duration': value};
    else 
      duration = value;      // interface duration

    if (found && duration) 
      return found.set(duration);
    
    // NOT found, create new Timer
    // decode id and append index if duplicate
    id = this._getUniqueId(id);

    const myTimer = new Timer(id, duration);
    const mySub = myTimer.subscribe({
      next: (o)=>this.tickIfTimerRunning(1000),
      complete: ()=>{
        mySub.unsubscribe();
        this._data[myTimer.id] = null;
      }
    })
    return this._data[myTimer.id] = myTimer;
  }


  /**
   * update display every [interval] MS if any timer is running
   * called on every action by child timers
   */
  protected tickIfTimerRunning(interval:number = 1000){
    const isRunning = Object.keys(this._data).find( (k)=>{
      return this._data[k] && this._data[k].isRunning()
    })
    if (isRunning && !this._tickIntervalHandler) {
      this._tickIntervalHandler = setInterval( ()=>{
          // run digest loop
          return;
          
          // const display = {};
          // Object.keys(this._data).forEach( k=>{
          //   const t = this._data[k];
          //   display[t.id] = t.check()
          // })
          // console.log("tick",display)
        }
        , interval
      )
    } else if (!isRunning && this._tickIntervalHandler){
      clearInterval(this._tickIntervalHandler);
      this._tickIntervalHandler = null;
    }  
  }

  private _parseId (id: string | {id?:string}) : string {
    let key: string;
    if (typeof id == 'string')
      key = id;
    else if (typeof id == 'object' && id.hasOwnProperty('id')) 
      key = id['id'];
    return key;
  }

  private _getUniqueId (id?: string) : string {
    let key: string = this._parseId(id);
    if (!key)
      key = `${Date.now()}`;

    if (this._data.hasOwnProperty(key)) {
      // append index to duplicate id
      let keys = _.filter( Object.keys(this._data), (k)=>_.startsWith(k, key))
      key = `${key}.${keys.length}`;
    }
    return key;
  }

}

