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

    it('should be run for 3 seconds', fakeAsync(() => {
      let timer = timerSvc.set(10);
      timer.start();
      tick(3000);
      timer.pause();
      expect(timer.isRunning()).not.toBeTruthy();
      expect(timer.check()).toBeCloseTo(7);

    }));
 
})
