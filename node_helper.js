/* Magic Mirror
 * Node Helper: MMM-PushBulletNotifications
 *
 * By Bas Knol
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var PushBullet = require("pushbullet"); //https://www.npmjs.com/package/pushbullet
var exec = require("child_process").exec;
var player = require('play-sound')(opts = { players: ['omxplayer'] });
var https = require('https');

module.exports = NodeHelper.create({

    //Start
    start: function () {
        this.pusher = null;
        this.connected = false;
        this.devices = [];
        this.debugMode = false;
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
            this.debugMode = this.config.debugMode;
            this.info(notification + " received");

            //Check if old config values are used, log warning
            if (!this.connected) {
                if (this.config.showNotificationsOnLoad !== undefined) {
                    this.warning("[Obsolete] The configuration option 'showNotificationsOnLoad' is no longer used and renamed to 'showPushesOnLoad'");
                    this.config.showPushesOnLoad = this.config.showNotificationsOnLoad;
                }

                if (this.config.showNotificationsSentToAllDevices !== undefined) {
                    this.warning("[Obsolete] The configuration option 'showNotificationsSentToAllDevices' is no longer used and renamed to 'showPushesSentToAllDevices'");
                    this.config.showPushesSentToAllDevices = this.config.showPushesSentToAllDevices;
                }
            }

            //Check to see if already connected, to avoid multiple streams
            if (!this.connected) {
                this.pushBulletListener(this.config); // Start up the PushBullet listener
            }

            //Get devices first
            this.getDevicesAsync(this.config, this.pusher).then(function (response) {
                //Load pushes on start if we need to
                if (self.config.showPushesOnLoad) {
                    self.loadPushes(self.pusher, self.config, true);
                }
            });
		}
	},

    //Start listening to pushbullet
	pushBulletListener: function(config){
		this.pusher = new PushBullet(config.accessToken); // PushBulletAPI object
        const self = this;
        this.pusher.me(function(error, user) {
            // needed to call me() to gather user iden
            if (config.endToEndPassword !== null) {
                self.pusher.enableEncryption(config.endToEndPassword, user.iden);
            }

            const stream = self.pusher.stream();

            //Connect
            stream.on('connect', function() {
                // stream has connected
                self.info("PushBullet connected");
                self.connected = true;
            });

            //Logs errors
            stream.on('error', function (error) {
                self.error("Push stream error: "+error);
            });

            //Watch for normal pushes if configured
            if (config.showPushes) {
                /*PushBullet API
                 * https://docs.pushbullet.com/#realtime-event-stream
                 *
                 * Watch for normal pushes not Ephemerals. Tickle means something has changed on server, subtype tells what has changed.
                 */
                stream.on("tickle", function (type) {
                    self.debug("tickle received: " + type);
                    if (type === "push") {
                        self.loadPushes(self.pusher, config, false);
                    }
                });
            }

            //Watch for mirrored notifications or SMS (ephemerals)
            if (config.showMirroredNotifications || config.showSMS) {
                /*
                 * Ephemerals
                 */
                stream.on("push", function (push) {
                    self.json(push, "Ephemeral received");
                    if (push.type === "mirror" && config.showMirroredNotifications) {
                        self.debug("Mirrored Notification received, sending to mirror");

                        self.playSound(config);

                        //Sending mirrored notification to mirror
                        self.sendSocketNotification("MIRROR", push);
                    }
                    else if (push.type === "sms_changed" && config.showSMS) {
                        self.debug("SMS received, sending to mirror");

                        //Do we have the info to display the SMS inside notifications, otherwise ignore it. Sometimes empty, not sure why
                        if (push.notifications.length > 0) {
                            self.playSound(config);

                            //Sending SMS to mirror
                            self.sendSocketNotification("SMS", push);
                        }
                    }
                    else if (push.type === "dismissal") {
                        self.debug("Dismissal received, sending to mirror");

                        //Sending dismissal to mirror
                        self.sendSocketNotification("DISMISSAL", push);
                    }
                });
            }

            //Show a warning if the config is probably not setup correctly
            if (!config.showMirroredNotifications && !config.showSMS && !config.showPushes) {
                self.warning("Please check the MMM-PushBulletNotifications module configuration. At least one of these properties must be set to true to be able to show notifications: showPushes, showMirroredNotifications or showSMS");
            }

            //Connect the stream
            stream.connect();
        });
    },

    loadPushes: function (pusher, config, init) {
        var self = this;

        //Get pushes and filter out 'command pushes' and check if a target device filter is configured
        self.getFilteredPushesAsync(pusher, config, init).then(function (result) {
            if (result != null) {
                //Play a sound if we are not initiating and we have still pushes to show (=update) (otherwise sound is also played on dismiss of pushes)
                if (!init && result.length > 0) {
                    self.playSound(config);
                }

                //Sending pushes to mirror
                self.sendSocketNotification("PUSHES", result);
            }
        });

    },

    //Play sound
    playSound: function (config) {
        var self = this;
        //Play a sound if configured
        if (config.soundFile != null && config.playSoundOnNotificationReceived) {
            player.play(config.soundFile, function (err) {
                if (err) {
                    self.error("Play sound:" + err);
                }
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
                    self.error("Error fetching devices. " + error);
                }
                else {
                    //Save devices
                    self.devices = response.devices;

                    //Send devices to mirror
                    self.sendSocketNotification("DEVICES", response.devices);
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
	getFilteredPushesAsync: async function(pusher, config, init) {
        var self = this;
        var pushes = [];
        var cursor = null;

		//Max 3 fetch rounds
		for(var i=0; i<3;i++) {
            var response = await this.getPushesAsync(pusher, config, cursor);
            self.json(response, "Responses");

            if (response != null && response.pushes != null && response.pushes.length > 0) {
                var responsePushes = response.pushes;

                //Command Magic Mirror (execute if push starts with mm:)(do not execute on initializing, starting mirror)
                if (!init && i == 0 && responsePushes[0].body != null && responsePushes[0].body.startsWith("mm:")) {
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
            else {
                //No pushes...stop trying...
                break;
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

        //Add cursor if we have one, to fetch more pushes
		if(cursor != null) {
			historyOptions.cursor = cursor;
        }

        //Fetch pushes
        await pusher.history(historyOptions, function (error, response) {
            if (error) {
                self.error("Error fetching pushes. " + error);
            }

            result = response;
        });

		return result;
	},

    //Filter pushes
    filterPushes: function(config, pushes, devices) {
        var self = this;
        var filteredPushes = [];
        var responsePushes = [];

        //Get pushes that are sent to target device
        if (pushes.length > 0 && config.filterTargetDeviceName !== "") {
            self.debug("Filtering by target device name specified in config: " + config.filterTargetDeviceName);
            var deviceIden = this.getDeviceIden(devices, config.filterTargetDeviceName);

            if(deviceIden !== "") {
                pushes.forEach(function (p) {
                    //Push is sent to specified target device or sent to all devices (only when filter is specified)
                    if ((p.target_device_iden === deviceIden)                     
                        || (p.target_device_iden == undefined && config.showPushesSentToAllDevices && config.filterTargetDeviceNameMode === "strict")) {                        
                            filteredPushes.push(p);
                    }
                    //Only filter if on target device name if push contains info about devices
                    else if (p.target_device_iden == null && config.filterTargetDeviceNameMode === "simple") {
                        filteredPushes.push(p);
                    }
                });
            }
            else {
                self.warning("Failed to get device based on config.filterTargetDeviceName with value: " + config.filterTargetDeviceName);
				self.info("Cannot filter...returning all pushes");
				filteredPushes = pushes;
			}
        }
        else
        {
            //No pushes or filterTargetDeviceName
            filteredPushes = pushes;
        }

        //Filter pushes by senders name
        if (filteredPushes.length > 0 && config.filterBySenders.length > 0) {
            self.debug("Filtering by senders specified in config...");
            var filteredPushesBySender = [];
            filteredPushes.forEach(function (p) {
                for (var i = 0; i < config.filterBySenders.length; i++) {
                    var s = config.filterBySenders[i];                    
                    //Check if push is from specific sender
                    if (s != null && p.sender_name != null && s.toLowerCase() === p.sender_name.toLowerCase()) {  //case insensitive compare
                        //Add push to filteredPushesBySender list
                        filteredPushesBySender.push(p);
                    }
                    //Only filter on sender name if push contains info about the sender
                    /*else if (p.sender_name == null && config.filterBySendersMode === "simple") {
                        filteredPushesBySender.push(p);
                    }*/
                }
            });

            //Set filteredPushes
            filteredPushes = filteredPushesBySender;
        }

        //Filter out command pushes
        filteredPushes.forEach(function (p) {
            //Filter out command Magic Mirror
            if (p.type === 'note' && p.body != null && !p.body.startsWith("mm:")) { //For now only accept type 'note'.

                //Do not show dismissed pushes if showDimissedPushes is set to false
                if (!(!config.showDismissedPushes && p.dismissed)) {
                    if (p.active) { //Do not show deleted pushes
                        responsePushes.push(p);
                    }
                }
            }
            else if (p.type === 'file' /*&& p.file_type.startsWith("image")*/) {
                self.debug("Push with file received: " + p.file_name);

                //Do not show dismissed pushes if showDimissedPushes is set to false
                if (!(!config.showDismissedPushes && p.dismissed)) {
                    if (p.active) { //Do not show deleted pushes

                        //Send file payload to mirror
                        self.sendSocketNotification('FILE', p);
                    }
                }
            }
            else if (p.type === 'link' && p.body != null) {
                //Do not show dismissed pushes if showDimissedPushes is set to false
                if (!(!config.showDismissedPushes && p.dismissed)) {
                    if (p.active) { //Do not show deleted pushes
                        responsePushes.push(p);
                    }
                }
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
            self.info("Command received: " + push.body);
            var opts = { timeout: 15000 };
            var command = push.body.substring(3);

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

                case "play sound":
                    player.play(config.soundFile, function (err) {
                        if (err) {
                            self.error("Play sound:" + err);
                        }
                    });
                    break;

                default:
                    self.sendSocketNotification("COMMAND", push);
                    break;
            }
        }
    },

    checkForExecError: function (error, stdout, stderr) {
        this.debug(stdout);
        if (stderr) {
            this.error(stderr);
        }
        if (error) {
            this.error(error);
            return;
        }
    },

    /*Logging*/
    json: function (json, message) {
        if (message) {
            this.log("debug", message);
        }
        this.log("json", json);
    },
    debug: function (message) {
        this.log("debug", message);
    },
    info: function (message) {
        this.log("info", message);
    },
    warning: function (message) {
        this.log("warning", message);
    },
    error: function (message) {
        this.log("error", message);
    },
    log: function (type, message) {
        var currentTime = new Date();
        var now = currentTime.toLocaleTimeString('en-US', { hour12: false }) + "." + currentTime.getMilliseconds();
        switch (type.toLowerCase()) {
            case "json":
                if (this.debugMode) {
                    console.log(message);
                }
                break;
            case "debug":
                if (this.debugMode) {
                    console.log("["+this.name+"][Debug] " + now + " - " + message);
                }
                break;

            default:
            case "info":
                console.log("["+this.name+"][Info] " + now + " - " + message);
                break;

            case "warning":
                console.log("["+this.name+"][Warning] " + now + " - " + message);
                break;

            case "error":
                console.log("["+this.name+"][Error] " + now + " - " + message);
                break;

        }
    }
});
