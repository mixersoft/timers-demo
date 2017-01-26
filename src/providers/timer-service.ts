import { Injectable } from '@angular/core';
import { Observable, Observer, Subject, Subscription } from "rxjs";
import { TimerObservable } from "rxjs/observable/TimerObservable";

/*
  Generated class for the TimerService provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/

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
    const self = this;
    this.id = id;
    if (opt.duration) this.duration = opt.duration * 1000;
    if (opt.label) this.label = opt.label;
    if (opt.sound) this.sound = opt.sound;

    this._subject = new Subject<any>();

  }

  /**
   * set timer and alert callback
   * @param value number, timer duration in seconds
   */
  set(value: number, onAlert?: (timer:Timer)=>void ) : Timer {
    if (this._isComplete) return this;
    // reset timer if value is not provided
    if (value == undefined) value = this.duration/1000;
    this.duration = value * 1000;
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
  check() : number {
    if (this.isRunning()){
      const remaining = this.expires - Date.now();
      return Math.round( remaining / 1000);
    }
    const value = this.remaining || this.duration;
    return Math.round(value/1000);
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
   * and release all timer resources 
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
   * @param value number, duration for timer in seconds
   * @param id string (optional), unique id of timer, defaults to Unixtime
   */
  set(value:number, id?:string) : Timer {
    const _getUniqueId = ()=>{
      id = `${Date.now()}`;
      if (this._data.hasOwnProperty(id)) {
        let i = 1;
        while (this._data.hasOwnProperty(`${id}.${i}`)){
          i++;
        }
        id = `${id}.${i}`;
      }
      return id;
    }

    const found = this.get(id);
    if(found===null) { 
      console.warn(`WARNING: this timer has been destroyed, id=${id}`);
      return;
    }
    if(found) return found.set(value);

    id = id ||  _getUniqueId();

    const myTimer = new Timer(id, {
      duration: value
    })
    const mySub = myTimer.subscribe({
      next: (o)=>this.tickIfTimerRunning(1000),
      complete: ()=>{
        mySub.unsubscribe();
        this._data[myTimer.id] = null;
      }
    })
    return this._data[myTimer.id] = myTimer
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

