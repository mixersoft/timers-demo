import { Observable, Subject, Subscription } from "rxjs";
import { Timer } from './timer'
import * as _ from 'lodash';
import * as moment from 'moment';

import { 
    // interfaces
    optTimer, optBeepTimer, Duration, BeepInterval,  
    // classes   
    // methods
    parseDurationMS, 
    TimerAction       
} from './timer-service';



/**
 * BeepTimer
 * - adds 'beep' events to Observable
 */
export class BeepTimer extends Timer {
    protected beepInterval: BeepInterval;
    protected onBeep: (timer:Timer)=>void; 

    private _beep: Subscription;

    constructor(id: string, opt:optBeepTimer = {}) {
        super(id, opt);
        const validKeys = ['beepInterval', 'onBeep'];
        const options = _.pick(opt, validKeys);
        _.each( options, (v,k)=>{
            this[k] = v;
        });
    }

    getBeepInterval(options:BeepInterval = {}) : [number, number] {
        let interval: number;
        let {initial, frequency, duration} = options;
        let initialDelay : number = parseDurationMS(initial) || 0;
        let adjDuration = this.duration - interval;
        if (frequency)
            interval = adjDuration/frequency
        else if (duration) {
            interval = parseDurationMS(duration);
        }
        if (interval && adjDuration < interval) {
            console.warn('WARNING: checkpoint interval is invalid. ignoring.')
        }
        return [initialDelay, interval];    // in MS
    }

    scheduleBeep() {
        let remaining: number = this.remaining || this.duration;
        const timerElapsed = this.duration - (remaining);
        const [initialDelay, beepInterval] = this.getBeepInterval(this.beepInterval);
        let actualDelay: number = initialDelay - timerElapsed;
        if (actualDelay < 0){
            actualDelay = beepInterval - (((this.duration-initialDelay) - remaining) % beepInterval);
        }
        if (actualDelay < remaining) {
            //  add a separate alarm to fire when timer reaches 0
            this._beep = Observable.timer(actualDelay, beepInterval).subscribe( ()=>{
                // console.log(this.duration - this.check(true), initialDelay);
                const elapsed = (this.duration - this.check(true)) - 5 // add 5ms slop
                this._subject.next( {
                    action: TimerAction.Beep,
                    value: elapsed < initialDelay ? initialDelay : beepInterval,
                    id: this.id
                } );
                
                if (beepInterval < this.remaining) this._beep.unsubscribe();
                // call onBeep callback
                if (this.onBeep) this.onBeep(this);
            });
        }
    }

    /**
     * set callback, called when Timer.remaining == 0
     * @param {[key:string]: (timer:Timer)=>void}, key=[onBeep]
     */
    setCallbacks( callbacks: {[key:string]: (timer:Timer)=>void} ){
        super.setCallbacks(callbacks);
        this.onBeep = callbacks['onBeep'] || undefined;
    }    

    start() : Timer {
        if (this._isComplete) return this;
        if (this._isDone)  return this;
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