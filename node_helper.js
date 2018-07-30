/* Magic Mirror
 * Node Helper: MMM-PushBulletNotifications
 *
 * By Bas Knol
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var PushBullet = require("pushbullet"); //https://www.npmjs.com/package/pushbullet
var exec = require("child_process").exec;
var player = require('play-sound')(opts = { players: ['omxplayer'] })

module.exports = NodeHelper.create({

    //Start
    start: function () {
        this.pusher = null;
        this.connected = false;
        this.devices = [];
    },

    // Override socketNotificationReceived method.

	/* socketNotificationReceived(notification, payload)
	 * This method is called when a socket notification arrives.
	 *
	 * argument notification string - The identifier of the notification.
	 * argument payload mixed - The payload of the notification.
	 */
    socketNotificationReceived: function (notification, payload) {
        var self = this;

		if (notification === "START") {
			this.config = payload; // The payload is all of our configuration options
            console.log(notification + " received");

            //Check to see if already conencted, to avoid multiple streams
            if (!this.connected) {
                this.pushBulletListener(this.config); // Start up the PushBullet listener
            }

            //Get devices first
            this.getDevicesAsync(this.config, this.pusher).then(function (response) {
                //Load pushes on start if we need to
                if (self.config.showNotificationsOnLoad) {                
                    self.loadPushes(self.pusher, self.config, true);                
                }
            });                
		}
	},

    //Start listening to pushbullet
	pushBulletListener: function(config){
		this.pusher = new PushBullet(config.accessToken); // PushBulletAPI object
		var stream = this.pusher.stream();
		var self = this;

        //Connect
		stream.on('connect', function() {
			// stream has connected
            console.log("PushBullet connected");
            self.connected = true;
		});

        //Logs errors
        stream.on('error', function(error) {
                console.log("Push stream error");
                console.log(error);
        });

        /*PushBullet API
         * https://docs.pushbullet.com/#realtime-event-stream
         * 
         * Watch for normal pushes not Ephemerals. Tickle means something has changed on server, subtype tells what has changed.
         */ 
	    stream.on("tickle", function (type) {
            if (type === "push") {
                self.loadPushes(self.pusher, config, false);
		    }
		});

        stream.connect();
    },

    loadPushes: function (pusher, config, init) {
        var self = this;                
        
        //Get pushes and filter out 'command pushes' and check if a target device filter is configured
        self.getFilteredPushesAsync(pusher, config).then(function (result) {
            if (result != null && result.length > 0) {
                //Play a sound if we are not initiating
                if (!init) {
                    self.playSound(config);
                }

                //Sending pushes to mirror
                self.sendSocketNotification("PUSHES", result);
            }
        });
        
    },

    //Play sound
    playSound: function (config) {
        //Play a sound if configured
        if (config.soundFile != null && config.playSoundOnNotificationReceived) {
            player.play(config.soundFile, function (err) {
                if (err) console.log("Error:" + err);
            });
        }
    },

    //Get devices async
    getDevicesAsync: async function (config, pusher) {
        var self = this;
                
        //Only get devices if we did not already
        if (this.devices.length == 0) {
            var deviceOptions = {
                active: true,
                limit: 10
            };

            //Get devices
            await pusher.devices(deviceOptions, function (error, response) {
                if (error) {
                    console.log("Error fetching devices. " + error);
                }
                else {
                    //Save devices
                    self.devices = response.devices;

                    //Send devices to mirror
                    self.sendSocketNotification("DEVICES", response.devices);

                    //Add devices to array, filter if specified
                    /*for (var i = 0; i < response.devices.length; i++) {
                        var d = response.devices[i];
                        if (d != null && config.filterTargetDeviceName.toLowerCase() === d.nickname.toLowerCase()) {
                            devicesArr.push(d);
                            break;
                        }
                    }*/
                }
            });
        }
        else {            
            //Send devices to mirror
            self.sendSocketNotification("DEVICES", this.devices);
        }

        return this.devices;
	},
    
    //Get and filter pushes async
	getFilteredPushesAsync: async function(pusher, config) {
        var self = this;
        var pushes = [];		
        var cursor = null;

		//Max 3 fetch rounds
		for(var i=0; i<3;i++) {
            var response = await this.getPushesAsync(pusher, config, cursor);

            if (response != null && response.pushes != null && response.pushes.length > 0) {
                var responsePushes = response.pushes;                

                //Command Magic Mirror
                if (i == 0 && responsePushes[0].body.startsWith("mm:")) {
                    this.executeCommand(config, self.devices, responsePushes[0]);
                    break;
                }

				//Filter pushes if we need to                
                responsePushes = this.filterPushes(config, response.pushes, self.devices);				

				//Add pushes to return array
				responsePushes.forEach(function(p) {                                        
                    pushes.push(p);                    
				});

				//Are there more pushes (cursor?) and do we need to fetch more pushes?
                if(response.cursor != null && pushes.length < config.numberOfNotifications) {
                        cursor = response.cursor;
                }
                else {
                    //No more data to fetch
                    break;
                }
            }
		}

		return pushes;
	},

    //Get pushes aync
	getPushesAsync: async function(pusher, config, cursor) {
        var self = this;

        //Set fetch limit
		var fetchLimit = (config.fetchLimitPushBullet > 500) ? 500 : config.fetchLimitPushBullet;
		var result;

		//Get active pushes en set limit
        var historyOptions = {
            active: true,
            limit: fetchLimit, //max 500
        };

		//Limit in API request if we have no device filter
		if(config.filterTargetDeviceName === "") {
            historyOptions.limit = config.numberOfNotifications;
        }

        //Add cursor if we have one to fetch more pushes
		if(cursor != null) {
			historyOptions.cursor = cursor;
        }

        //Fetch pushes
        await pusher.history(historyOptions, function (error, response) {
            if(error) {
                console.log("Error fetching pushes. " + error);
            }
                        
            result = response;
        });

		return result;
	},

    //Filter pushes
    filterPushes: function(config, pushes, devices) {
        var filteredPushes = [];
        var responsePushes = [];

        //Get pushes that are sent to target device
        if(pushes.length > 0 && config.filterTargetDeviceName !== "") {
            var deviceIden = this.getDeviceIden(devices, config.filterTargetDeviceName);

            if(deviceIden !== "") {
                pushes.forEach(function (p) {
                    //Push is sent to specified target device  or sent to all devices (only when filter is specified)
                    if((p.target_device_iden === deviceIden) || (p.target_device_iden == undefined && config.showNotificationsSentToAllDevices)) {
                        filteredPushes.push(p);
                    }
                });
            }
			else {
				console.log("Failed to get device based on config.filterTargetDeviceName with value: "+config.filterTargetDeviceName);
				console.log("Cannot filter...returning all pushes");
				filteredPushes = pushes;
			}
        }
		else {
			//No pushes or filterTargetDeviceName
			filteredPushes = pushes;
        }

        //Filter out command pushes
        filteredPushes.forEach(function (p) {
            //Filter out command Magic Mirror
            if (!p.body.startsWith("mm:")) {
                responsePushes.push(p);
            }
        });

        return responsePushes;
    },

    //Get device Iden based on device (nick)name
    getDeviceIden: function(devices, deviceNickName){
        var iden = "";
        if(devices != null && devices.length > 0 && deviceNickName !== "") {
            for(var i=0; i<devices.length; i++){
                var d = devices[i];
                if(d != null && d.nickname.toLowerCase() === deviceNickName.toLowerCase()) {  //case insensitive compare
                    iden = d.iden;
                    break;
                }
            }
        }
        return iden;
    },

    executeCommand: function (config, devices, push) {
        var self = this;
        var allow = (config.onlyAllowCommandsFromSourceDevices == null || config.onlyAllowCommandsFromSourceDevices.length == 0);

        if (!allow) {
            config.onlyAllowCommandsFromSourceDevices.forEach(function (sourceDevice) {
                var deviceIden = self.getDeviceIden(devices, sourceDevice);
                if (deviceIden !== "" && deviceIden === push.source_device_iden) {
                    allow = true;
                }
            });
        }

        if (allow) {
            var opts = { timeout: 15000 };
            var command = push.body.substring(3);
            console.log(command.toLowerCase().trim());

            switch (command.toLowerCase().trim()) {
                case "shutdown":
                    exec("sudo shutdown -h now", opts, function (error, stdout, stderr) { self.checkForExecError(error, stdout, stderr); });
                    break;

                case "display on":
                    exec("vcgencmd display_power 1", opts, function (error, stdout, stderr) { self.checkForExecError(error, stdout, stderr); });
                    break;

                case "display off":
                    exec("vcgencmd display_power 0", opts, function (error, stdout, stderr) { self.checkForExecError(error, stdout, stderr); });
                    break;

                default:
                    self.sendSocketNotification("COMMAND", push);
                    break;
            }
        }
    },

    checkForExecError: function (error, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        if (error) {
            console.log(error);
            return;
        }
    },
});