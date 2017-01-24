# Project Config

```
# ionic start [project_name] --v2
# init git repo
```
## install Testbed test config
> https://www.joshmorony.com/introduction-to-testing-ionic-2-applications-with-testbed/
> https://github.com/joshuamorony/ionic2-testbed/blob/master/package.json

add to `package.json` for ionic2@RC5 dependencies

```
  "devDependencies": {
    "@ionic/app-scripts": "1.0.0",
    "@types/jasmine": "^2.5.40",
    "@types/node": "^7.0.0",
    "angular-cli": "^1.0.0-beta.25.5",
    "codecov": "^1.0.1",
    "jasmine-core": "^2.5.2",
    "jasmine-spec-reporter": "^3.2.0",
    "karma": "^1.4.0",
    "karma-chrome-launcher": "^2.0.0",
    "karma-cli": "^1.0.1",
    "karma-jasmine": "^1.1.0",
    "karma-mocha-reporter": "^2.2.1",
    "karma-remap-istanbul": "^0.4.0",
    "ts-node": "^2.0.0",
    "tslint": "^4.3.1",
    "tslint-eslint-rules": "^3.2.3",
    "typescript": "2.0.9"
  },
```

install testing dependencies
```
npm install

# initialize karma
karma init karma.conf.js
# choose all defaults, then edit karma.config.js
```
