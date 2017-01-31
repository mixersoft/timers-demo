import { Injectable } from '@angular/core';
import { Observable, Subject, Subscription } from "rxjs";

import * as moment from 'moment';
import * as _ from 'lodash';

/*
  Generated class for the TimerService provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/

export interface duration {
  d?: number,
  days?: number,
  h?: number,
  hours?: number,
  m?: number,
  minutes?: number,
  s?: number,
  seconds?: number,
  duration?: number   // in seconds
}

export class Timer {
  id: string;
  label: string;
  sound: string;
  protected onAlert: (timer:Timer)=>void;                // callback when timer.remaining==0
  protected duration: number = 0;   // original duration, in seconds
  protected remaining: number;      // remaining time after pause
  protected expires: number;        // Unixtime for timer expiration
  protected done: boolean;          // user responds to timer expiration

  private _subject: Subject<any>;
  private _alarm: Subscription;
  private _isComplete: Boolean = false;

  constructor(id: string, opt:any = {}) {
    this.id = id;
    this.duration = this._parseDurationMS(opt);
    if (opt.onAlert) this.setAlert(opt.onAlert);
    if (opt.label) this.label = opt.label;
    if (opt.sound) this.sound = opt.sound;

    this._subject = new Subject<any>();

  }


  /**
   * set timer and alert callback
   * @param value number, timer duration in seconds
   */
  set(opt: duration | number, onAlert?: (timer:Timer)=>void ) : Timer {
    if (this._isComplete) return this;

    if (opt){
      this.duration = this._parseDurationMS(opt);
    }

    this.remaining = null;
    this.expires = null;
    this.done = false;
    if (onAlert) this.onAlert = onAlert;

    this._subject.next({
      action: 'set',
      value: this.duration,
      timer: this
    });

    return this;
  }

  getDuration():number {
    return this.duration
  }

  /**
   * set alert callback which is called when timer reaches 0
   */
  setAlert( onAlert: (timer:Timer)=>void ){
    this.onAlert = onAlert;
  }

  start() : Timer {
    if (this._isComplete) return this;
    if (this.done)  return this;
    if (this.isRunning()) return this;
    if (this.remaining && this.remaining < 0) return this;

    if (!this.remaining) this.remaining = this.duration
    this.expires = Date.now() + this.remaining;

    this._subject.next(  {
      action: 'start',
      value: this.remaining,
      timer: this
    } );

    //  add a separate alarm to fire when timer reaches 0
    this._alarm = Observable.timer(this.remaining).subscribe( ()=>{
      this._subject.next( {
        action: 'alert',
        value: this.check(),
        timer: this
      } );
      this._alarm.unsubscribe();
      if (this.onAlert) this.onAlert(this);
    });

    this.remaining = null;
    this.done = false;
    return this;
  }

  /**
   * check time remaining in seconds
   */
  check(asString: boolean = false) : number {
    let remaining: number = this.remaining || this.duration;
    if (this.isRunning()){
      remaining = this.expires - Date.now();
    }
    return Math.round(remaining/1000);
  }

  checkAsString() : String {
    let remaining = this.check();
    const isNegative = remaining < 0;
    if (isNegative) remaining *= -1;
    let duration = moment.duration(remaining, 'seconds');
    let [h,m,s] = ['hours', 'minutes','seconds'].map( (k)=>duration[k]());
    let padded = [];
    if (h) padded.push(h);
    if (padded.length || m) {
      if (padded.length && m < 10) padded.push('0'+m);
      else padded.push(m);
    }

    if (padded.length && s < 10) padded.push('0'+s);
    else padded.push(s);
    
    return (isNegative ? '-' : '') + padded.join(':');
  }

  /**
   * pause timer
   */
  pause(toggle: boolean = false) : number {
    if (this._isComplete) return;
    if (this.isRunning() == false){
       if (toggle)  return this.start().check();
       return this.remaining;
    }
    this.remaining = this.expires - Date.now();
    this.expires = null;

    if (this._alarm){
      this._alarm.unsubscribe();
      this._alarm = null;
    } 

    this._subject.next({
      action: 'pause',
      value: this.remaining,
      timer: this
    } );

    return Math.round(this.remaining/1000);
  }

  /**
   * acknowledge timer alert, stops countdown past 0
   */
  stop() : number {
    this.done = true;
    this.remaining = this.expires - Date.now();
    this.expires = null;

    if (this._alarm){
      this._alarm.unsubscribe();
      this._alarm = null;
    } 
    this._subject.next( {
      action: 'stop',
      value: this.remaining,
      timer: this
    } );

    return Math.round(this.remaining/1000);
  }

  /**
   * send Observable complete() to all subscribers,
   * and give subscribers an opportunity to release all timer resources 
   */
  complete() {
    this._isComplete = true;
    if (!this.isDone()) this.stop();
    this._subject.complete();
  }

  /**
   * chain timer to start immediately after another timer reaches 0,
   * i.e. notification with action=='alert'
   */
  chain(timer0:Timer) {
    const chainSubscription = timer0.subscribe({
      next: (o)=>{
        if (o.action=='alert') {
          setTimeout(()=>this.start());
          chainSubscription.unsubscribe();
          // console.log("start chained timer, id=", this.id);
        }
      },
      complete: ()=>{ 
        chainSubscription.unsubscribe();
      }
    });
    return chainSubscription;
  }

  /**
   * subscribe to timer notifications
   *  action: [set, start, pause, alert, stop]
   */
  subscribe(observer: any){
    const subscription = this._subject.subscribe(observer);
    return subscription;
  }

  isRunning():boolean {
    return !!this.expires;
  }

  isDone(): boolean {
    return this.done;
  }



  private _parseDurationMS(opt: duration | number) : number{
    if (typeof opt == 'number') opt = {'duration': opt};
    if (opt.duration) 
      return opt.duration * 1000;
    else
      return moment.duration(opt);
  }

}






@Injectable()
export class TimerService {
  private _data: {[key:string] : Timer} = {}
  private _tickIntervalHandler: any;

  constructor( ) {
    console.log('Hello TimerService Provider');
  }

  get(id:string) : Timer {
    const found = id && this._data[id];
    return found;
  }

  /**
   * create/set timer
   * @param opt duration | number, duration for timer in seconds
   * @param id string (optional), unique id of timer, defaults to Unixtime
   */
  set(opt: duration | number, id?:string) : Timer {
    if (typeof opt == 'number') opt = {'duration': opt};
    const _getUniqueId = ()=>{
      id = `${Date.now()}`;
      if (this._data.hasOwnProperty(id)) {
        let keys = _.filter( Object.keys(this._data), (k)=>_.startsWith(k, id))
        id = `${id}.${keys.length}`;
      }
      return id;
    }

    const found = this.get(id);
    if(found===null) { 
      console.warn(`WARNING: this timer has been destroyed, id=${id}`);
      return;
    }
    if(found) return found.set(opt);

    id = id ||  _getUniqueId();

    const myTimer = new Timer(id, opt)
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

}

