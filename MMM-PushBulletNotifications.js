/* Magic Mirror
 * Module: MMM-PushBulletNotifications
 *
 * By Bas Knol
 * MIT Licensed.
 */

Module.register("MMM-PushBulletNotifications", {
    defaults: {
        accessToken: "", //PushBullet API Access Token
        endToEndPassword: null,
        numberOfNotifications: 3,
        filterTargetDeviceName: "", //Only show pushes send to all devices or the filterd target device
        showPushesSentToAllDevices: true, //Show pushes to all devices
        onlyAllowCommandsFromSourceDevices: [],
        fetchLimitPushBullet: 50,
        showPushes: true,
        showPushesOnLoad: true,
        showDismissedPushes: true,
        showMirroredNotifications: true,        
        onlyShowLastNotificationFromApplication: false,
        showIndividualNotifications: false,
        showSMS: true,
        showMessage: true,
        showIcons: true,
        showDateTime: true,
        localesDateTime: 'nl-NL',
        playSoundOnNotificationReceived: true,
        soundFile: 'modules/MMM-PushBulletNotifications/sounds/new-message.mp3', //Relative path to MagicMirror root
        maxMsgCharacters: 50,
        maxHeaderCharacters: 32,
        showModuleIfNoNotifications: true,
        noNotificationsMessage: "No new notifications",
        debugMode: false,
    },

    requiresVersion: "2.3.1", // Minimum required version of MagicMirror

    //Keep track of devices, pushes, ephemerals and notifications (=mix of pushes and ephemerals)
    devices: [],
    pushes: [],
    ephemerals: [],
    notifications: [],

    start: function () {
        console.log("PushBulletNotifications module started!");

        this.loaded = false;
        this.debugMode = this.config.debugMode;
        this.sendSocketNotification("START", this.config);
    },

    getDom: function () {
        var wrapper = document.createElement("table");
        wrapper.className = "small";
        var self = this;

        if (this.notifications.length > 0) {

            // Only display how many notifications are specified by the config
            self.notifications.slice(0, this.config.numberOfNotifications).forEach(function (o) {
                var header;

                switch (o.type.toLowerCase()) {
                    //Normal push
                    case "note":
                        header = o.sender_name;
                        break;

                    //Mirrored notification
                    case "mirror":
                        header = o.application_name + " - " + o.title;
                        break;

                    //SMS
                    case "sms_changed":
                        header = "SMS: " + o.notifications[0].title;
                        //Add body to object
                        o.body = o.notifications[0].body;
                        //Time received SMS
                        o.created = o.notifications[0].timestamp;

                        break;
                }

                // Determine if the header texts need truncating
                if (header.length > self.config.maxHeaderCharacters) {
                    header = header.substring(0, self.config.maxHeaderCharacters) + "...";
                }

                var notificationWrapper = document.createElement("tr");
                notificationWrapper.className = "normal";

                //Set icon
                var icon = null;
                if (self.config.showIcons) {
                    icon = document.createElement("span");
                    icon.className = "icon";

                    //Normal push (decide what icon to use based on device) or SMS
                    if (o.type === "note" || o.type === "sms_changed") {

                        //Get device that has sent notification
                        var device = self.getDevice(o.source_device_iden);
                        var iconPath = "/modules/MMM-PushBulletNotifications/icons/";

                        //Sometimes device is null because push does not contain a 'source_device_iden'
                        if (device == null) {
                            iconPath += 'message.png';
                        }
                        else {
                            //Set icon based on device
                            switch (device.icon) {
                                case "phone":
                                    iconPath += 'phone.png';
                                    break;
                                case "desktop":
                                    if (device.type == "windows") {
                                        iconPath += 'windows.png';
                                    }
                                    else {
                                        iconPath += 'desktop.png';
                                    }
                                    break;
                                case "system":
                                    iconPath += 'system.png';
                                    break;
                                default:
                                    iconPath += 'message.png';
                                    break;
                            }
                        }

                        icon.innerHTML = "<img src=\"" + iconPath + "\" width=\"24\" />";
                    }
                    else {
                        //Show icon that was passed in notification (ephemeral) as base64
                        icon.innerHTML = "<img src=\"data:image/png;base64, " + o.icon + "\" width=\"24\" />";
                    }
                }

                //Name of sender
                var nameWrapper = document.createElement("td");
                nameWrapper.className = "bright";
                nameWrapper.innerHTML = (icon != null) ? icon.outerHTML + header : header;

                notificationWrapper.appendChild(nameWrapper);
                wrapper.appendChild(notificationWrapper);

                //Show date time with message
                if (self.config.showDateTime) {
                    var dateTimeWrapper = document.createElement("tr");
                    var dateTimeContentWrapper = document.createElement("td");
                    dateTimeContentWrapper.className = "normal xsmall";

                    var date = new Date(o.created * 1000);
                    var dateTimeOptions = { hour12: false };

                    //Only show time for pushes sent 'today'
                    if (self.isSameDay(date, new Date())) {
                        dateTimeContentWrapper.innerHTML = date.toLocaleTimeString(self.config.localesDateTime, dateTimeOptions);
                    }
                    else {
                        dateTimeContentWrapper.innerHTML = date.toLocaleString(self.config.localesDateTime, dateTimeOptions);
                    }

                    dateTimeWrapper.appendChild(dateTimeContentWrapper);
                    wrapper.appendChild(dateTimeWrapper);
                }

                //Shoge message
                if (self.config.showMessage) {
                    var bodyWrapper = document.createElement("tr");
                    var bodyContentWrapper = document.createElement("td");

                    // Determine if the message texts need truncating
                    var message = o.body;
                    if (o.body.length > self.config.maxMsgCharacters) {
                        message = o.body.substring(0, self.config.maxMsgCharacters) + "...";
                    }

                    bodyContentWrapper.className = "normal xsmall message";
                    bodyContentWrapper.innerHTML = message;
                    bodyWrapper.appendChild(bodyContentWrapper);
                    wrapper.appendChild(bodyWrapper);
                }
            });

            //Show module
            self.show();
        }
        else if (!this.config.showModuleIfNoNotifications) {
            //Hide module if we have no notifications to show
            self.hide();
        }
        else {
            wrapper.innerHTML = this.translate(this.config.noNotificationsMessage);
            wrapper.className = "normal xsmall dimmed";
        }

        return wrapper;
    },

    getScripts: function () {
        return [];
    },

    getStyles: function () {
        return [
            "MMM-PushBulletNotifications.css",
        ];
    },

    setNotifications: function () {
        //Destructuring assignment - ES6
        this.notifications = [...new Set([...this.pushes, ...this.ephemerals])]; //Merge two array's and remove duplicates
        this.notifications.sort(function (a, b) { return b.created - a.created }); //Sort date desc        
    },

    addNotification: function (notification) {
        var self = this;
        for (var i = 0; i < self.ephemerals.length; i++) {
            var ephemeral = self.ephemerals[i];
            //Clean up ephemarals if we have a duplicate
            if ((ephemeral.package_name === notification.package_name && ephemeral.title === notification.title && ephemeral.body === notification.body) //Clean-up duplicates
                || (ephemeral.package_name === notification.package_name && ephemeral.title === notification.title && !self.config.showIndividualNotifications) //Individual notifications
                || (ephemeral.package_name === notification.package_name && self.config.onlyShowLastNotificationFromApplication)) { //Last notification from application
                self.ephemerals.splice(i, 1);
                i--;                
            }
        }

        this.ephemerals.push(notification);    
    },

    removeNotification: function (dismissal) {
        var self = this;
        for (var i = 0; i < self.ephemerals.length; i++) {
            var ephemeral = self.ephemerals[i];
            if ((ephemeral.package_name === dismissal.package_name && ephemeral.notification_id === dismissal.notification_id && ephemeral.notification_tag === dismissal.notification_tag) 
                || (dismissal.package_name === "sms" && ephemeral.type === "sms_changed")) {
                self.ephemerals.splice(i, 1);
                i--;                
            }
        }
    },

	socketNotificationReceived: function (notification, payload) {
        this.debug(notification);
        //Received pushes
		if (notification === "PUSHES") {
			if (payload) {				
                this.pushes = payload;		
                this.setNotifications();
                this.updateDom();
			}			
        }
        else if (notification === "FILE") {
            //Notifiy other modules there is a PushBullet file upload
            this.sendNotification("PUSHBULLET_FILE_UPLOAD", payload);
        }
        //Received Ephemeral (SMS or Mirrored Notifications)
        else if (notification === "SMS" || notification === "MIRROR") {
            if (payload) {                
                //Add created date, not available in ephemeral
                var now = new Date();
                payload.created = now.getTime() / 1000; //seconds  	                

                this.addNotification(payload);
                this.setNotifications();
                this.updateDom();
            }            
        }
        else if (notification === "DISMISSAL") {
            if (payload) {
                this.removeNotification(payload);
                this.setNotifications();
                this.updateDom();
            }
        }
        //Received devices
		else if(notification === "DEVICES") {
			if(payload) {
				this.loaded = true;
				this.devices = payload;
			}
        }
        //Commands
        else if (notification === "COMMAND") {
            var push = payload;
            if (push.body.startsWith("mm:")) {
                var command = push.body.substring(3);

                if (command.startsWith("say:")) {
                    var message = command.substring(4);
                    this.sendNotification('MMM-TTS', message);
                }
                else if (command.startsWith("hide module:")) {
                    var module = command.substring(command.indexOf(":") + 1);
                    this.setModuleVisibility(module, false);
                }
                else if (command.startsWith("show module:")) {
                    var module = command.substring(command.indexOf(":") + 1);
                    this.setModuleVisibility(module, true);
                }
                else {
                    switch (command.toLowerCase().trim()) {

                        case "hide all modules":
                            var options = { lockString: this.identifier };
                            var modules = MM.getModules();
                            modules.enumerate(function (module) {
                                module.hide(1000, null, options);
                            });
                            break;

                        case "show all modules":
                            var options = { lockString: this.identifier };
                            var modules = MM.getModules();
                            modules.enumerate(function (module) {
                                module.show(1000, null, options);
                            });
                            break;
                    }
                }
            }
        }
    },

    setModuleVisibility: function (moduleName, visible) {
        var options = { lockString: this.identifier };
        var modules = MM.getModules();
        modules.enumerate(function (module) {
            if (module.name === moduleName) {
                if (visible) {
                    module.show(1000, null, options);
                }
                else {
                    module.hide(1000, null, options);
                }
            }
        });
    },

    //Compare two date on same day
    isSameDay: function (d1, d2) {
        return d1.getFullYear() === d2.getFullYear()
            && d1.getDate() === d2.getDate()
            && d1.getMonth() === d2.getMonth();
    },

    //Get pushbullet device base on device iden
    getDevice: function (deviceIden) {      
        var device = null;
        if (this.devices != null && this.devices.length > 0 && deviceIden !== "") {
            for (var i = 0; i < this.devices.length; i++) {
                var d = this.devices[i];
                if (d != null && d.iden === deviceIden) { 
                    device = d;
                    break;
                }
            }
        }
        return device;
    },

    debug: function (message) {
        if (this.debugMode) {
            console.log(message);
        }
    }
});
