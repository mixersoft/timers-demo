import { Component } from '@angular/core';

import { NavController } from 'ionic-angular';

import { Timer, TimerService } from '../../providers/timer-service';


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
  ) {
    this.createTimers()
  }

  createTimers(){

    const timerObserver = { 
      next: (o)=>{
        console.log(`timer, id=${o.timer.id}`,o);
        Object.assign( this.memo[o.timer.id] ,  this.getButtonStyles(o.timer) );
        if (o.action=='start' && o.timer == t1) setTimeout(repeatSub,1000)
        if (o.action=='alert') setTimeout(()=>{
          o.timer.complete()
        },1000)
      }
    }


    const t1 = this.timerSvc.set(4);
    const t2 = this.timerSvc.set(60);
    [t1,t2].forEach( o=>{
      this.timers.push(o);
      this.memo[o.id] = Object.assign({
        subscription: o.subscribe(timerObserver)
      }, this.getButtonStyles(o));
    });

    t2.chain(t1);

    t1.setAlert( (t:Timer)=>{
      console.info(`timer alert, id=${t.id}, duration=${t.getDuration()}`);
    })

    const repeatSub = ()=>{
      const anotherSub = t1.subscribe({
        next: (t)=>console.warn(`timer, id=${t.timer.id}`,t),
        complete: ()=>{
          console.warn(`timer COMPLETE`),
          anotherSub.unsubscribe();
        }
      })
    }

  }

  
  getButtonStyles(timer:Timer):any{
    if (timer.isRunning() && timer.check() > 0) return {
      icon: 'pause',
      color: 'primary',
      label: 'Pause',
      action: 'pause'
    }
    if (timer.isRunning() && timer.check() <= 0) return {
      icon:'stop',
      color: 'danger',
      label: 'Stop',
      action: 'stop'
    }
    if ( !timer.isDone() && timer.check() > 0 ) return {
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

  timerClick(timer:Timer) {
    
    const action = this.getButtonStyles(timer).action
    timer[action]();

  }

}
