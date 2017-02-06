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
  protected onAlert: (timer:Timer)=>void;                // callback when timer.remaining==0
  protected duration: number = 0;   // original duration, in seconds
  protected remaining: number;      // remaining time after pause
  protected expires: number;        // Unixtime for timer expiration
  protected done: boolean;          // user responds to timer expiration
  protected _isComplete: Boolean = false;
  protected _subject: Subject<any>;

  private _alarm: Subscription;
  

  constructor(id: string, opt:optTimer = {}) {
    this.id = id;
    this._subject = new Subject<any>();
    const validKeys = {
        duration: ['duration', 'd','days','h','hours','m','minutes','s','seconds'],
        attrs: ['onAlert', 'label', 'sound']
    };
    const duration = _.pick(opt, validKeys.duration);
    this['duration'] = parseDurationMS(duration);
    const options = _.pick(opt, validKeys.attrs);
    _.each( options, (v,k)=>{
        this[k] = v;
    });
  }


  /**
   * set timer and alert callback
   * @param value number, timer duration in seconds
   */
  set(opt: Duration | number, onAlert?: (timer:Timer)=>void ) : Timer {
    if (this._isComplete) return this;

    if (opt){
      this.duration = parseDurationMS(opt);
    }

    this.remaining = null;
    this.expires = null;
    this.done = false;
    if (onAlert) this.onAlert = onAlert;

    this._subject.next({
      action: TimerAction.Set,
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
      action: TimerAction.Start,
      value: this.remaining,
      timer: this
    } );

    //  add a separate alarm to fire when timer reaches 0
    this._alarm = Observable.timer(this.remaining).subscribe( ()=>{
      this._subject.next( {
        action: TimerAction.Done,
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
  toJSON() : TimerAttributes {
    const remaining = this.check(true);
    return {
      id: this.id,
      label: this.label,
      // asMilliseconds
      duration: this.duration,
      // asMilliseconds
      remaining: remaining,
      humanize: this.humanize(remaining),
      // as Unixtime
      expires: this.expires,
      $instance: this
    }
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
      action: TimerAction.Stop,
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
    return this.done;
  }

}

