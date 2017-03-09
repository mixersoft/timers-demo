import { Component } from '@angular/core';
import { Config, NavController, ToastController } from 'ionic-angular';
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
    , public toast: ToastController
  ) {
    this.timerSvc.setOnTick( this.timerCallbacks.onTick, 100 );
  }

  ionViewDidEnter(){
    console.log('ionViewDidEnter');
    const start = window['$dbg'].bootstrap;
    const msg = `bootstrap (ionViewDidEnter), elapsedMS=${Date.now() - start}`;
    console.log(msg);
    if (Settings.DEBUG){
      const toast = this.toast.create({
        message:  msg,
        duration: 3000
      });
      toast.present();
    }
  }

  /**
   * reload Timers from Storage, use 
   * `?ionicSkipReload=true` to force demoCreateTimers()
   */
  ionViewDidLoad(){
    // console.info('ionViewDidLoad');
    const skipReload : string = this.config.get('skipReload');
    if (skipReload){
      this.timerSvc.clearStorage();
      this.demoCreateTimers();
      return;
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
        if (Settings.DEBUG){
          const toast = this.toast.create({
            message:  "restoring Timers",
            duration: 3000,
            position: "top"
          });
          toast.present();
        }

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
      // console.log(`timer, id=${o.id} action=${TimerAction[o.action]}`,o);
      const timer = this.timerSvc.get(o.id);
      Object.assign( this.timerRenderAttrs[o.id] ,  this.getButtonStyles(timer) );
      if (o.action==TimerAction.Done) setTimeout(()=>{
        // o.timer.complete()
      },1000)
    },
    complete: ()=>{
      // TODO: animate remove timer
      const toRemove = this.timerSvc.getComplete();
      toRemove.forEach( (id)=>{
        this.removeTimer(id, true);
      })
      this.sortTimers();
    }
  }

  timerCallbacks = {
    onDone: (t:Timer)=>{
      console.info(`callback onDone() DONE, id=${t.id}, duration=${t.snapshot.duration}`);
    },
    onBeep: (t:Timer)=>{
      console.info(`callback onBeep() BEEP, id=${t.id}, remaining=${t.check()}`);
    },
    onTick: ()=>{
      this.sortTimers();
    }
  }

  sortTimers() {
    // TODO: sortBy multiple, nested properties
    // this.timers = _.sortBy(this.timers, ['snapshot.remaining', 'snapshot.duration']);
    this.snapshots = this.timers.map( (t)=>t.snap(1));
    this.snapshots = _.sortBy(this.snapshots, ['remaining', 'duration']);
  }

  removeTimer(id:string, deferSort:boolean=false){
    const i = this.timers.findIndex( (o)=>o.id == id )
    if (i > -1){
      const t = this.timers[i];
      console.warn("removing Timer.id=", t.id);
      this.timers.splice(i,1);
      if (deferSort===false){
        this.sortTimers();
      }
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
    const t1 = this.timerSvc.setTimer(6);
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
      o.setCallbacks(this.timerCallbacks);
    });
    

    t2.chain(t1);

    // t2.setCallbacks(this.timerCallbacks)

    // t1.setCallbacks({
    //   'onDone': this.timerCallbacks.onDone
    // })

    const repeatSub = (t1:Timer)=>{
      console.info("repeatSub for id=", t1.id);
      const anotherSub = t1.subscribe({
        next: (t)=>console.info(`repeatSub notified, id=${t.id}`,t),
        complete: ()=>{
          console.warn(`timer COMPLETE`),
          anotherSub.unsubscribe();
        }
      })
    }

    repeatSub(t1);

  }


  /**
   * connect Timer to view variables for proper rendering
   */
  renderTimer(timer:Timer){
    if (!timer) return;
    // connect timer to view
    timer.snap();
    this.timers.push(timer);
    
    // create and sort snapshots
    this.sortTimers();

    this.timerRenderAttrs[timer.id] = Object.assign({
      subscription: timer.subscribe(this.timerObserver)
    }, this.getButtonStyles(timer));
    
  }  

  /**
   * update Timer render properties on create and each TimerEvent
   */
  getButtonStyles(timer: Timer):any{
    if (!timer) return {}
    let timerAsJSON = timer.snapshot;
    if (timer.isRunning() && timerAsJSON.remaining > 0) return {
      icon: 'pause',
      color: 'primary',
      label: 'Pause',
      action: 'pause'
    }
    if (timer.isRunning() && timerAsJSON.remaining <= 0) return {
      icon: 'stop',
      color: 'danger',
      label: 'Dismiss',
      action: 'stop'
    }
    if ( !timer.isDone() && timerAsJSON.remaining > 0 ) return {
      icon: 'play',
      color: 'secondary',
      label: 'Start',
      action: 'start'
    }
    if ( timer.isDone()  ) return {
      icon: 'close',
      color: 'primary',
      label: 'Remove',
      action: 'complete'
    }
    return {
      icon: 'play',
      color: 'secondary',
      label: 'Start',
      action: 'start'
    }
  }

  timerClick(snapshot:TimerAttributes) {
    const timer: Timer = this.timerSvc.get(snapshot.id);
    const action = this.getButtonStyles(timer).action
    timer[action]();
    if (Settings.DEBUG){
      const toast = this.toast.create({
        message:  `${action}`,
        duration: 3000
      });
      toast.present();    
    }

  }

  resetTimers(){
    const result = this.timers.map((t)=>{
      t.complete();
    });
    this.timers = [];
    this.timerSvc.clearStorage();
    this.demoCreateTimers();
  }

  onPan(ev, snapshot){
    const timer = this.timerSvc.get(snapshot.id);
    if (timer.isRunning()) return;
    let snap = this.snapshots.find( (v)=>v.id == timer.id );
    return Object.assign(snap, timer.setByScrollWheel(ev).snap(1));
  }

}
