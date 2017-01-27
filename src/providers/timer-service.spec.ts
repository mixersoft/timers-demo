import { fakeAsync, tick } from '@angular/core/testing';
import { TimerService } from './timer-service';

let timerSvc = null;

describe('TimerService', () => {
 
    beforeEach(() => {
      timerSvc = new TimerService();
    });

    // afterEach(function() {
    // });

    it('is created', () => {
      expect(timerSvc).toBeTruthy();
    });
 
    it('should be set to 10 seconds', () => {
      let timer = timerSvc.set(10);
      expect(timer.check()).toEqual(10);
      expect(timer.isRunning()).toBeFalsy();
    });

    it('should create unique default timer ids', () => {
      let range = [0,1,2,3,4,5,6,7]
      let timers = range.map(()=>timerSvc.set(10));
      expect(timers.length).toEqual(range.length);
      let obj = {};
      timers.forEach(o=>(obj[o.id]=1));
      expect(Object.keys(obj).length).toEqual(range.length);
      
      // get timer by Id
      let id = timers[ 3 ].id;
      expect(timerSvc.get(id).id).toEqual(id);
    });

    it('should start, pause, stop', () => {
      let timer = timerSvc.set(10);
      expect(timer.check()).toEqual(10);
      expect(timer.isRunning()).toBeFalsy();
      timer.start();
      expect(timer.isRunning()).toBeTruthy();
      timer.pause();
      expect(timer.isRunning()).toBeFalsy();
      expect(timer.isDone()).toBeFalsy();
      timer.start();
      expect(timer.isRunning()).toBeTruthy();
      timer.stop();
      expect(timer.isRunning()).toBeFalsy();
      expect(timer.isDone()).toBeTruthy();
    });


    /**
     * to be completed
     * - need to figure out how to test async methods correctly
     */
    it('should be run for 3 seconds', fakeAsync(() => {
      let timer = timerSvc.set(10);
      timer.start();
      // wait 3 seconds
      timer.pause();
      // expect(timer.check()).toBeCloseTo(7);
      expect(timer.isRunning()).toBeFalsy();
    }));

    it('it should emit values to subscribers', () => {
      let timer = timerSvc.set(10);
      let subscriber = timer.subscribe((o)=>{console.log(o)})
      timer.start()
      // wait
      timer.pause()
      // eait
      timer.stop()
      expect(timerSvc).toBeTruthy();
    });

    it('is should emit values to subscribers', () => {
      let timer = timerSvc.set(10);
      let subscriber = timer.subscribe((o)=>{console.log(o)})
      expect(timerSvc).toBeTruthy();
    });

    it('is should `tick` if one or more timers are running', () => {
      let timer1 = timerSvc.set(10);
      let timer2 = timerSvc.set(20);
      // check timerSvc._tickIntervalHandler 
      // angular2 zone should run change detection everytime setInterval() fires
      expect(timerSvc._tickIntervalHandler).toBeFalsy();
      timer1.start();
      expect(timerSvc._tickIntervalHandler).toBeTruthy();
      timer2.start(); timer1.pause(); 
      expect(timerSvc._tickIntervalHandler).toBeTruthy();
      timer2.pause();
      expect(timerSvc._tickIntervalHandler).toBeFalsy();
    });


    it('it should stop running timer and emit `complete` ', () => {
      let timer = timerSvc.set(10);
      let subscriber = timer.subscribe({
        complete: ()=>{console.log("Observable complete")}
      })
      timer.start();
      timer.complete();
      // delete TimerService reference to timer
      expect(timerSvc.get(timer.id)).toBeNull();

      expect(timer.isRunning()).toBeFalsy();
      timer.set(10).start();
      expect(timer.isRunning()).toBeFalsy();

      // make sure consumers unsubscribe to timer
      // and remove all references
      
    });


 
})
