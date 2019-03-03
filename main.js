/**
 *
 * sunnyportal adapter
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.sunnyportal.0
const adapter = new utils.Adapter('sunnyportal');

const request = require('request');
const util = require('util')
const prettyMs = require('pretty-ms');

function format(fmt, ...args) {
    if (!fmt.match(/^(?:(?:(?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{[0-9]+\}))+$/)) {
        throw new Error('invalid format string.');
    }
    return fmt.replace(/((?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{([0-9]+)\})/g, (m, str, index) => {
        if (str) {
            return str.replace(/(?:{{)|(?:}})/g, m => m[0]);
        } else {
            if (index >= args.length) {
                throw new Error('argument index is out of range in format');
            }
            return args[index];
        }
    });
}

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

adapter.on('stateChange', function (id, state) {
    // only process if state was command.
    if (!id || !state || state.ack) {
        return;
    }
    var l = id.split('.');
});

function create_indicator(name, description, value) {
    adapter.getObject(name, function(err, obj) { 
        if (!obj) {
            adapter.setObject(name, {
                type: 'state',
                common: {
                    name: description,
                    role: 'state',
                    type: "boolean",
                    "read":  true,
                    "write": false
                    },
                native: {}
            });
            adapter.setState(name, value, true);
        }
    });
    adapter.setState(name, value, true);
}

function main() {
    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    adapter.log.info('config username: ' + adapter.config.username);
    adapter.log.info('config password: ' + adapter.config.password);
    adapter.log.info('config plant OID: ' + adapter.config.plantoid);

    // in this all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    setup();
}

var jar = request.jar();
const url = 'https://sunnyportal.com';
var timer = 0;

function reset() {
    if (timer != 0) {
        clearInterval(timer);
        timer = 0;
    } 
    setTimeout(setup, 5*1000);
}

function homemanager(httpResponse) {
    var HOMEMANAGER_URL = '/homemanager';
    var requestOpts = {
        headers: {
            'Referer' : 'https://www.sunnyportal.com/FixedPages/HoManLive.aspx',
            "DNT" : 1,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest'
        },
        // Service does not have a valid cert
        strictSSL : false,
        jar : jar
    };

    var d = new Date();
    var n = d.getTime();

    request.get(url + HOMEMANAGER_URL + '?t=' + n, requestOpts, function (err, httpResponse, body) {
        if (err) {
            adapter.log.debug('request failed:', err);
            reset();
            return;
        }
            
        try {
            var obj = JSON.parse(body);
        } catch (error) {
            adapter.log.debug('error in JSON!');
            reset();
            return;
        }

        adapter.log.debug(JSON.stringify(obj));
        create_indicator('infos', 'info messages', null);
        obj.InfoMessages.forEach(function(element, index) {
            adapter.log.info("info[" + index + "] " + element);
            create_indicator('infos.' + index, 'info message ' + index, element);
        });
        create_indicator('warnings', 'warning messages', null);
        obj.WarningMessages.forEach(function(element, index) {
            adapter.log.info("warning[" + index + "] " + element);
            create_indicator('warnings.' + index, 'warning message ' + index, element);
        });
        create_indicator('errors', 'error messages', null);
        obj.ErrorMessages.forEach(function(element, index) {
            adapter.log.info("errors[" + index + "]" + element);
            create_indicator('errors.' + index, 'error message ' + index, element);
        });


        create_indicator('total_consumption', 'total consumption', obj.TotalConsumption);
        create_indicator('grid_consumption', 'grid consumption', obj.GridConsumption);
        create_indicator('self_consumption', 'self consumption', obj.SelfConsumption);
        create_indicator('self_consumption_quote', 'self consumption quote', obj.SelfConsumptionQuote);
        create_indicator('autarky_quote', 'autarky quote', obj.AutarkyQuote);
        if (!obj.Timestamp) {
            adapter.log.debug('no data!');
            reset();
            return;
        }
        create_indicator('last_update', 'time of last update', obj.Timestamp.DateTime);

        if (timer == 0) {
            timer = setInterval(homemanager, (adapter.config.interval >= 15) ? adapter.config.interval * 1000 : 15*1000);
        }
    });
}

function setup() {
    login(homemanager);
}

function login(callback) {
    var LOGIN_URL = '/Templates/Start.aspx';
    
    var username = adapter.config.username;
    var password = adapter.config.password;
    var plantOID = adapter.config.plantoid;
    
    var requestOpts = {
        headers: {
            'SunnyPortalPageCounter' : 0,
            'plantOid': plantOID,
            'Origin' : url,
            'Referer' : ' https://www.sunnyportal.com/Templates/Start.aspx',
            "DNT" : 1,
            'Content-Type' : "application/x-www-form-urlencoded",
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
        },
        form : {
            __EVENTTARGET : '',
            __EVENTARGUMENT: '',
            ctl00$ContentPlaceHolder1$Logincontrol1$LoginBtn : 'Anmelden',
            ctl00$ContentPlaceHolder1$Logincontrol1$txtPassword : password,
            ctl00$ContentPlaceHolder1$Logincontrol1$txtUserName : username,
            ctl00$ContentPlaceHolder1$Logincontrol1$ServiceAccess: 'true',
            ctl00$ContentPlaceHolder1$Logincontrol1$RedirectURL:  '',
            ctl00$ContentPlaceHolder1$Logincontrol1$RedirectPlant:  '',
            ctl00$ContentPlaceHolder1$Logincontrol1$RedirectPage:  '',
            ctl00$ContentPlaceHolder1$Logincontrol1$RedirectDevice:  '',
            ctl00$ContentPlaceHolder1$Logincontrol1$RedirectOther:  '',
            ctl00$ContentPlaceHolder1$Logincontrol1$PlantIdentifier:  '',
        },
        // Service does not have a valid cert
        strictSSL : false,
        jar : jar
    };
    
    request.post(url + LOGIN_URL, requestOpts, function (err, httpResponse, body) {
        if (err) {
            adapter.log.debug('login failed, retrying in 5 sec: ', err);
            setTimeout(setup, 5*1000);
            return ;
        }
        callback();
    });
}
