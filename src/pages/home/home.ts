import { Component } from '@angular/core';
import { Config, NavController } from 'ionic-angular';
import { Storage } from '@ionic/storage';
import * as _ from 'lodash';

import { Settings } from '../../providers/settings';
import { TimerAction, TimerEvent, BeepTimer, Timer, TimerAttributes, TimerService } from '../../providers/index';


@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  TICK_INTERVAL = 500;    // milliseconds
  timers: Timer[] = [];
  snapshots: Array<TimerAttributes> = [];
  /**
   * cache render attrs for each Timer, update on each TimerEvent
   */
  timerRenderAttrs: {[key:string]:any} = {};

  private RESTORE_EXPIRED_TIMERS = true;
  private RESTORE_EXPIRED_TIMER_LIMIT = 5*60*1000;

  constructor(
    public navCtrl: NavController
    , public timerSvc: TimerService
    , public storage: Storage
    , public config: Config
    , public settings: Settings
  ) {
    const self = this;
    const tick = function(){
      this.timers = _.sortBy(this.timers, ['remaining', 'duration']);
      self.snapshots = self.timers.map( (t)=>t.snap(true)  );
      return;
    }

    this.timerSvc.setOnTick( tick, 100 );
  }

  /**
   * reload Timers from Storage, use 
   * `?ionicSkipReload=true` to force demoCreateTimers()
   */
  ionViewDidLoad(){
    const skipReload : string = this.config.get('skipReload');
    if (skipReload){
      this.timerSvc.clearStorage();
      return this.demoCreateTimers();
    }

    this.settings.load()
    .then( (settings)=>{
      ['RESTORE_EXPIRED_TIMERS', 'RESTORE_EXPIRED_TIMER_LIMIT'].forEach( (k)=>{
        this[k] = settings[k];
      })
      return this.timerSvc.loadTimersFromStorage()
    })
    .then( (serializedTimers)=>{
        // clearStorage before restoring timers
        this.timerSvc.clearStorage();

        Object.keys(serializedTimers).forEach(
          (id)=>{
            let timer = this.restoreTimer(serializedTimers[id]);
            this.renderTimer(timer);
          }
        )
        // check if all restored timers have expired
        if (this.timers.length == 0) 
          return Promise.reject(undefined);
    })
    .catch( ()=>{
      this.demoCreateTimers();
    })
  }

  /**
   * observers for Timer.subscribe()
   */
  timerObserver = { 
    next: (o:TimerEvent)=>{
      console.log(`timer, id=${o.id} action=${TimerAction[o.action]}`,o);
      const timer = this.timerSvc.get(o.id);
      Object.assign( this.timerRenderAttrs[o.id] ,  this.getButtonStyles(timer) );
      if (o.action==TimerAction.Done) setTimeout(()=>{
        // o.timer.complete()
      },1000)
    }
  }

  timerCallbacks = {
    onDone: (t:Timer)=>{
      console.info(`callback onDone() DONE, id=${t.id}, duration=${t.getDuration()}`);
    },
    onBeep: (t:Timer)=>{
      console.info(`callback onBeep() BEEP, id=${t.id}, remaining=${t.check()}`);
    }
  }

  /**
   * restore timer from timer.toJSON(), 
   * use to restore timers from Storage
   */
  restoreTimer(timerAsJSON: TimerAttributes) : Timer {
    timerAsJSON.duration /= 1000;
    if (timerAsJSON.expires) {
      timerAsJSON.remaining = timerAsJSON.expires - Date.now();
      const isExpired = timerAsJSON.remaining < 0;
      if (isExpired && !this.RESTORE_EXPIRED_TIMERS ) {
        return;
      }
      if (isExpired && -1*timerAsJSON.remaining > this.RESTORE_EXPIRED_TIMER_LIMIT) {
        return;
      }
    }

    // re-create stored timer
    const timer = this.timerSvc.create(timerAsJSON.className, timerAsJSON);
    if (timer instanceof BeepTimer)
      timer.setCallbacks(this.timerCallbacks);
    // restart running timer, force restart if timerAsJSON.remaining < 0
    if (timerAsJSON.expires) timer.start(true);
    return timer;
  }


  demoCreateTimers(){
    const t1 = this.timerSvc.setTimer(60);
    const t2 = this.timerSvc.create('BeepTimer', {
      'minutes':1,
      'beepInterval': {
        // initial: { seconds: 2},
        duration: { seconds: 10}
      }
    });
    const t3 = this.timerSvc.setTimer(10);
    const t4 = this.timerSvc.setTimer(20*60);

    [t1,t2,t3,t4].forEach( o=>{
      this.renderTimer(o);
    });
    

    t2.chain(t1);

    t2.setCallbacks(this.timerCallbacks)

    t1.setCallbacks({
      'onDone': this.timerCallbacks.onDone
    })

    const repeatSub = ()=>{
      const anotherSub = t1.subscribe({
        next: (t)=>console.info(`2nd timer1 subscr, id=${t.id}`,t),
        complete: ()=>{
          console.warn(`timer COMPLETE`),
          anotherSub.unsubscribe();
        }
      })
    }

  }


  /**
   * connect Timer to view variables for proper rendering
   */
  renderTimer(timer:Timer){
    if (!timer) return;
    // connect timer to view
    timer.snap(true);
    this.timers.push(timer);
    this.timers = _.sortBy(this.timers, ['remaining', 'duration']);
    this.snapshots = this.timers.map( t=>t.snap(true) );
    this.timerRenderAttrs[timer.id] = Object.assign({
      subscription: timer.subscribe(this.timerObserver)
    }, this.getButtonStyles(timer));
    
  }  

  /**
   * update Timer render properties on create and each TimerEvent
   */
  getButtonStyles(timer: Timer):any{
    // if (!timer) return {}
    let timerAsJSON = timer.toJSON();
    if (timer.isRunning() && timerAsJSON.remaining > 0) return {
      icon: 'pause',
      color: 'primary',
      label: 'Pause',
      action: 'pause'
    }
    if (timer.isRunning() && timerAsJSON.remaining <= 0) return {
      icon:'stop',
      color: 'danger',
      label: 'Stop',
      action: 'stop'
    }
    if ( !timer.isDone() && timerAsJSON.remaining > 0 ) return {
      icon:'play',
      color: 'secondary',
      label: 'Start',
      action: 'start'
    }
    return {
      icon:'play',
      color: 'primary',
      label: 'Reset',
      action: 'set'
    }
  }

  timerClick(snapshot:TimerAttributes) {
    const timer: Timer = this.timerSvc.get(snapshot.id);
    const action = this.getButtonStyles(timer).action
    timer[action]();

  }

}
