import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Storage } from '@ionic/storage';

import { TimerAction, TimerEvent, Timer, TimerAttributes, TimerService } from '../../providers/index';


@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  timers: Timer[] = [];
  memo: {[key:string]:any} = {};

  constructor(
    public navCtrl: NavController
    , public timerSvc: TimerService
    , public storage: Storage
  ) {
    this.timerSvc.loadTimers().then(
      (serializedTimers)=>{
        console.info(serializedTimers);
        Object.keys(serializedTimers).forEach(
          (id)=>{
            let timerAsJSON = serializedTimers[id];
            timerAsJSON.duration /= 1000;
            if (timerAsJSON.expires) {
              timerAsJSON.remaining = timerAsJSON.expires - Date.now();
              if (timerAsJSON.remaining < 0) return;
            }

            // re-create stored timer
            const timer = this.timerSvc.create('Timer', timerAsJSON);
            // restart running timer
            if (timerAsJSON.expires) timer.start();

            // persist Timer for HomePage
            this.timers.push(timer);
            this.memo[timer.id] = Object.assign({
              subscription: timer.subscribe(this.timerObserver)
            }, this.getButtonStyles(timer));
          }
        )
        if (this.timers.length == 0) 
          return Promise.reject(undefined);
      }
    ).catch( ()=>{
      this.createTimers();
    })
  }

  timerObserver = { 
    next: (o:TimerEvent)=>{
      console.log(`timer, id=${o.id} action=${TimerAction[o.action]}`,o);
      const timer = this.timerSvc.get(o.id);
      Object.assign( this.memo[o.id] ,  this.getButtonStyles(timer) );
      if (o.action==TimerAction.Done) setTimeout(()=>{
        // o.timer.complete()
      },1000)
    }
  }

  createTimers(){

    const t1 = this.timerSvc.setTimer(4);
    const t2 = this.timerSvc.create('BeepTimer', {
      'minutes':3,
      'beepInterval': {
        initial: { seconds: 2},
        duration: { seconds: 5}
      }
    });
    [t1,t2].forEach( o=>{
      this.timers.push(o);
      this.memo[o.id] = Object.assign({
        subscription: o.subscribe(this.timerObserver)
      }, this.getButtonStyles(o));
    });

    t2.chain(t1);

    t2.setCallbacks({
      'onDone':(t:Timer)=>{
        console.info(`timer2 onDone() DONE, id=${t.id}, duration=${t.getDuration()}`);
      },
      'onBeep':(t:Timer)=>{
        console.info(`timer2 onBeep() BEEP, id=${t.id}, remaining=${t.check()}`);
      }
    })

    t1.setCallbacks({
      'onDone': (t:Timer)=>{
        console.info(`timer onDone() DONE, id=${t.id}, duration=${t.getDuration()}`);
      }
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
