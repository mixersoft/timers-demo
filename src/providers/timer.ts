import { Observable, Subject, Subscription } from "rxjs";
import * as _ from 'lodash';
import * as moment from 'moment';

import { 
  optTimer, Duration, 
  parseDurationMS,
  TimerAction, TimerEvent, TimerAttributes, TimerInterface
} from './timer-service';


export class Timer implements TimerInterface {
  id: string;
  label: string;
  sound: string;
  snapshot: TimerAttributes;
  protected onDone: (timer:Timer)=>void;       // (optional) callback when timer.remaining==0
  protected duration: number = 0;       // original duration, in seconds
  protected remaining: number;          // remaining time after pause
  protected expires: number;            // Unixtime for timer expiration
  protected _isDone: boolean;           // user responds to timer expiration
  protected _isComplete: Boolean = false; // true on timer.complete(), this._subject.complete() is notified
  protected _subject: Subject<TimerEvent>;  // use this.subscribe() to get TimerEvents from Subject

  private _alarm: Subscription;         // subscription for actual TimerAction.Done notifcation
  

  constructor(id: string, opt:optTimer = {}) {
    this.id = id;
    this._subject = new Subject<TimerEvent>();
    const validKeys = {
        duration: ['duration', 'd','days','h','hours','m','minutes','s','seconds'],
        attrs: ['onDone', 'label', 'sound', 'remaining']
    };
    const duration = _.pick(opt, validKeys.duration);
    this['duration'] = parseDurationMS(duration);
    const options = _.pick(opt, validKeys.attrs);
    _.each( options, (v,k)=>{
        this[k] = v;
    });
    this.snapshot = this.toJSON();  // initialize snapshot
  }


  /**
   * set timer and alert callback
   * @param value number, timer duration in seconds
   */
  set(opt: Duration | number, onDone?: (timer:Timer)=>void ) : Timer {
    if (this._isComplete) return this;

    if (opt){
      this.duration = Math.max(parseDurationMS(opt), 0);
    }

    this.remaining = null;
    this.expires = null;
    this._isDone = false;
    if (onDone) this.onDone = onDone;

    // debounce
    this._subject.next({
      action: TimerAction.Set,
      value: this.duration,
      id: this.id
    });

    return this;
  }

  getDuration():number {
    return this.duration
  }

  /**
   * set callback, called when Timer.remaining == 0
   * @param {[key:string]: (timer:Timer)=>void}, key=[onDone]
   */
  setCallbacks( callbacks: {[key:string]: (timer:Timer)=>void} ){
    this.onDone = callbacks['onDone'] || undefined;
  }

  start(force:boolean=false) : Timer {
    if (this._isComplete) return this;
    if (this._isDone)  return this;
    if (this.isRunning()) return this;
    if (!force && this.remaining && this.remaining < 0) return this;

    if (!this.remaining) this.remaining = this.duration
    this.expires = Date.now() + this.remaining;

    this._subject.next(  {
      action: TimerAction.Start,
      value: this.remaining,
      id: this.id
    } );

    //  add a separate alarm to fire when timer reaches 0
    this._alarm = Observable.timer(this.remaining).subscribe( ()=>{
      this._subject.next( {
        action: TimerAction.Done,
        value: this.check(),
        id: this.id
      } );
      this._alarm.unsubscribe();
      if (this.onDone) this.onDone(this);
    });

    this.remaining = null;
    this._isDone = false;
    return this;
  }

  /**
   * check time remaining in seconds
   */
  check(asMS = false) : number {
    let remaining: number = this.remaining || this.duration;
    if (this.isRunning()){
      remaining = this.expires - Date.now();
    }
    if (asMS) return remaining;
    return Math.floor(remaining/1000);
  }


  /**
   * convert Timer remaining time or a millisecond value to
   * a padded string in the format "-hh:mm:ss"
   */
  humanize(millisecond?: number) : string {
    // as seconds
    let remaining = millisecond ? millisecond/1000 : this.check();
    const isNegative = remaining < 0;
    if (isNegative) remaining *= -1;
    let dur = moment.duration(remaining, 'seconds');
    let [h,m,s] = ['hours', 'minutes','seconds'].map( (k)=>dur[k]());
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
   * create a snapshot of the timer
   */
  toJSON(asMS=false) : TimerAttributes {
    const remaining = this.check(asMS);
    // console.log(this.id, this.duration, remaining)
    return {
      className: (<any>this).constructor.name,
      id: this.id,
      label: this.label,
      // asMilliseconds
      duration: asMS ? this.duration : Math.floor(this.duration/1000),
      // asMilliseconds
      remaining: remaining,
      humanize: this.humanize(asMS ? remaining : this.check(true) ),
      // as Unixtime
      expires: this.expires
    }
  }


  /**
   * capture snapshot of Timer for View rendering, in seconds
   */
  snap(precision: number = 0): TimerAttributes {
    const asMS = precision > 0;
    const snapshot = this.toJSON(asMS);
    switch(precision){
      case 2:
        snapshot.duration = Math.floor(snapshot.duration/10)/100;
        snapshot.remaining = Math.floor(snapshot.remaining/10)/100;
        break;
      case 1:
        snapshot.duration = Math.floor(snapshot.duration/100)/10;
        snapshot.remaining = Math.floor(snapshot.remaining/100)/10;
        break;
    }
    Object.assign( this.snapshot, snapshot);
    // if (snapshot.remaining > 100) console.log(`snapshot.remaining=${snapshot.remaining}`);
    return this.snapshot;

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
      action: TimerAction.Pause,
      value: this.remaining,
      id: this.id
    } );

    return Math.round(this.remaining/1000);
  }

  /**
   * acknowledge timer alert, stops countdown past 0
   */
  stop() : number {
    this._isDone = true;
    this.remaining = this.expires - Date.now();
    this.expires = null;

    if (this._alarm){
      this._alarm.unsubscribe();
      this._alarm = null;
    } 
    this._subject.next( {
      action: TimerAction.Stop,
      value: this.remaining,
      id: this.id
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
   * i.e. notification with action==TimerAction.Done
   */
  chain(timer0:Timer) {
    const chainSubscription = timer0.subscribe({
      next: (o)=>{
        if (o.action==TimerAction.Done) {
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
    return this._isDone;
  }

}

