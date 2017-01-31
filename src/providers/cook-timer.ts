import { Observable, Subject, Subscription } from "rxjs";
import { Timer } from './timer'
import * as _ from 'lodash';
import * as moment from 'moment';

import { 
    // interfaces
    optTimer, optCookTimer, duration, checkInterval,  
    // classes   
    // methods
    parseDurationMS,        
} from './timer-service';



/**
 * CookTimer
 * - adds 'beep' events to Observable
 */
export class CookTimer extends Timer {
    protected checkInterval: checkInterval;
    protected onBeep: (timer:Timer)=>void; 

    private _beep: Subscription;

    constructor(id: string, opt:optCookTimer = {}) {
        super(id, opt);
        const validKeys = ['checkInterval', 'onBeep'];
        const options = _.pick(opt, validKeys);
        _.each( options, (v,k)=>{
            this[k] = v;
        });
    }

    getBeepInterval(options:checkInterval = {}) : number {
        let interval: number;
        if (options['frequency'])
            interval = this.duration/options['frequency']
        else if (options['duration']) {
            interval = parseDurationMS(options['duration']);
        }
        if (interval && this.duration < interval) {
            console.warn('WARNING: checkpoint interval is invalid. ignoring.')
        }
        return interval;
    }

    scheduleBeep(interval?: number) {
        let remaining: number = interval || this.remaining || this.duration;
        const beepInterval = this.getBeepInterval(this.checkInterval);
        const nextCheckpoint = beepInterval - ((this.duration - remaining) % beepInterval);
        if (nextCheckpoint < remaining) {
            //  add a separate alarm to fire when timer reaches 0
            this._beep = Observable.timer(nextCheckpoint, beepInterval).subscribe( ()=>{
                this._subject.next( {
                    action: 'beep',
                    value: nextCheckpoint,
                    timer: this
                } );
                
                if (beepInterval < this.remaining) this._beep.unsubscribe();
                if (this.onBeep) this.onBeep(this);
            });
        }
    }

    start() : Timer {
        if (this._isComplete) return this;
        if (this.done)  return this;
        if (this.isRunning()) return this;
        if (this.remaining && this.remaining < 0) return this;

        this.scheduleBeep();
        return super.start();
    }

    pause(toggle: boolean = false) : number {
        if (this._beep){
            this._beep.unsubscribe();
            this._beep = null;
        }
        return super.pause(toggle);
    }

    stop() : number {
        if (this._beep){
            this._beep.unsubscribe();
            this._beep = null;
        }
        return super.stop();
    }

}