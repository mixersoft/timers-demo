import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { Storage } from '@ionic/storage';
import { Observer, Observable, Subject, Subscription } from "rxjs";

import { Timer } from './timer'
import { BeepTimer } from './beep-timer'
import * as _ from 'lodash';
import * as moment from 'moment';

export { 
  Timer, BeepTimer
  // ActiveTimer
  // ConcurrentTimer
};

interface JSONSerializable {
  toJSON: ()=>any;
}

@Pipe({name: 'toJSON', pure: false})
export class ToJsonPipe implements PipeTransform {
  transform(value: JSONSerializable | Array<JSONSerializable>): any | Array<any> { 
    let unwrap = false;
    if (!Array.isArray(value)) {
      value = [value];
      unwrap = true;
    }
    const result = value.map( (o)=> o ? o.toJSON() : {} );
    return unwrap ? result[0] : result;
  }
}

/**
 * capture snapshot of Timer for quick and stable View rendering
 */
@Pipe({name: 'snapshot', pure: false})
export class TimerSnapshotPipe implements PipeTransform {
  transform(value: Timer | Array<Timer>, asMS: boolean = false): TimerAttributes | Array<TimerAttributes> | any { 
    let unwrap = false;
    if (!Array.isArray(value)) {
      value = [value];
      unwrap = true;
    }
    const result = value.map( (o)=>{
      return o ? o.snap(2)  : {};
    });
    return unwrap ? result[0] : result;
  }
}

export enum TimerAction {
  Set = 1,
  Start,
  Pause,
  Beep,
  Done,
  Stop,
  Complete
}

export interface TimerEvent {
  id: string;
  action: TimerAction;
  value: any;
}

export interface TimerAttributes {
  id: string;
  label: string;
  duration: number;
  remaining: number;
  humanize: string;
  expires: number;
  // for restoring the correct class
  className: string;
  beepInterval?: number;
}

export interface TimerInterface {
  id: string;
  snapshot?: TimerAttributes;
  set: (opt: Duration | number) => Timer;
  start: ()=>Timer;
  check: ()=>number;
  pause: ()=> number;
  stop: ()=> number;
  complete: ()=>void;
  toJSON: ()=>TimerAttributes;
  subscribe: (observer: Observer<TimerEvent>) => Subscription;
  isRunning: ()=> boolean;
  isDone: ()=> boolean;
  // TODO: not sure, use toJSON instead??
  getDuration: ()=> number;
}

export interface Duration {
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

// BeepTimer interval specification
export interface BeepInterval {
  initial?: Duration,
  frequency?: number;       
  duration?: Duration;
  // [propName: string]: any;
}

export interface optTimer {
  id?: string;
  label?: string;
  sound?: string;
  onAlert?: (timer: Timer)=>void;
  duration?: Duration;
}

export interface optBeepTimer extends optTimer {
  beepInterval?: BeepInterval;
  onBeep?: (timer: Timer)=>void;
}

export function parseDurationMS(opt: Duration | number) : number {
  if (typeof opt == 'number') opt = {'duration': opt};
  if (opt.duration) 
    return opt.duration * 1000;
  else
    return moment.duration(opt).asMilliseconds();
}

const TimerClasses = {
  'Timer': Timer,
  'BeepTimer': BeepTimer
}

@Injectable()
export class TimerService {
  private _data: {[key:string] : Timer} = {}
  private _tickIntervalHandler: any;
  private tickInterval: number = 1000;
  private onTick: ()=>void;         // setInterval() handler in ViewController
  private _TIMER_KEY = "_timer";

  constructor(public storage?: Storage ) {
    console.log('Hello TimerService Provider');
  }

  get(id:string | {id:string} ) : Timer {
    let key: string = this._parseId(id);
    const found = key && this._data[key];
    return found;
  }

  /**
   * event handler for any TimerEvent
   */
  onTimerEvent(o:TimerEvent) {
    this.tickIfTimerRunning();
    this.storeTimer(o);
  }

  /**
   * save Timer to localStorage, so we can
   * restore active timers as necessary
   */
  private storeTimer(o:TimerEvent) {
    if (!this.storage) return;
    this.storage.get(this._TIMER_KEY).then( 
      (serializedTimers)=>{
        serializedTimers = serializedTimers || {};
        // save to storage
        switch (o.action) {
          case TimerAction.Set:
          case TimerAction.Pause:
          case TimerAction.Start:
            const t = this.get(o.id);
            if (t) {
              const timerState: any = t.toJSON(true);
              serializedTimers[t.id] = timerState;
              this.storage.set(this._TIMER_KEY, serializedTimers);
            }
            break;
          case TimerAction.Stop:
          case TimerAction.Complete:
            delete serializedTimers[o.id];
            this.storage.set(this._TIMER_KEY, serializedTimers);
            break;
        }
      }
    );
  }

  /**
   * load Timers from Storage
   */
  loadTimersFromStorage() : Promise<any>{
    if (!this.storage) return Promise.reject({});
    return this.storage.get(this._TIMER_KEY).then(
      (serializedTimers)=>{
        if (_.isEmpty(serializedTimers))
          return Promise.reject(undefined);
        return serializedTimers;
      }
    )
  }

  /**
   * clear Timers from Storage
   */
  clearStorage() {
    this.storage.set(this._TIMER_KEY, undefined);
  }

  create(className: string, opt: any) : Timer {
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
      next: (o:TimerEvent)=>{
        this.onTimerEvent(o);
      },
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
  setTimer(value: Duration | number , id?:string) : Timer {
    let found : Timer = this.get(id);
    if (found===null) { 
      console.warn(`WARNING: this timer has been destroyed, id=${id}`);
      return;
    }
    let duration: Duration;
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
      next: (o:TimerEvent)=>{
        this.onTimerEvent(o);
      },
      complete: ()=>{
        mySub.unsubscribe();
        this._data[myTimer.id] = null;
      }
    })
    return this._data[myTimer.id] = myTimer;
  }


  /**
   * callback function in View to update Timer snaphsots on each tickInterval (MS)
   * @param interval, setInterval() is called with interval MS when any Timer is running
   */
  setOnTick(onTick:()=>void, interval: number = 1000){
    this.tickInterval = interval;
    this.onTick = onTick;
  }

  /**
   * start ticking if any Timer is running, 
   * calls the onTick callback function every tickInterval MS
   * cleared when no Timers are running
   */
  protected tickIfTimerRunning(){
    const isRunning = Object.keys(this._data).find( (k)=>{
      return this._data[k] && this._data[k].isRunning()
    })
    if (isRunning && !this._tickIntervalHandler) {
      this._tickIntervalHandler = setInterval( ()=>{
          this.onTick && this.onTick();
        }
        , this.tickInterval
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

