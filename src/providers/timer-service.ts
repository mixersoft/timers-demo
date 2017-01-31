import { Injectable } from '@angular/core';
import { Observable, Subject, Subscription } from "rxjs";
import { Timer } from './timer'
import * as _ from 'lodash';
import * as moment from 'moment';

export { Timer };

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

