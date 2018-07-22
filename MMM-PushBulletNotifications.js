/* Magic Mirror
 * Module: MMM-PushBulletNotifications
 *
 * By Bas Knol
 * MIT Licensed.
 */

Module.register("MMM-PushBulletNotifications", {
	defaults: {
		accessToken: "", //PushBullet API Access Token
		numberOfNotifications: 3,
		filterTargetDeviceName: "", //Only show notification send to all devices or the filterd target device
        showNotificationsSentToAllDevices: true, //Show notifications to all devices
        onlyAllowCommandsFromSourceDevices: [],
        fetchLimitPushBullet: 50,
        showNotificationsOnLoad: true,
        showMessage: true,
        showIcons: true,
        showDateTime: true,
        localesDateTime: 'nl-NL',
        playSoundOnNotificationReceived: true,
        soundFile: 'modules/MMM-PushBulletNotifications/sounds/new-message.mp3', //Relative path to MagicMirror root
		maxMsgCharacters: 50,
		maxHeaderCharacters: 32
	},

    //Keep track of devices and pushes
	devices: [],
	pushes: [],

	start: function() {
		console.log("PushBulletNotifications module started!");
		
		this.loaded = false;
		this.sendSocketNotification("START", this.config);
		//this.originalHeader = this.data.header;		
	},

	getDom: function() {
		var wrapper = document.createElement("table");
		wrapper.className = "small";
		var self = this;

		if (this.pushes.length > 0) {

			// Only display how many notifications are specified by the config
            self.pushes.slice(0, this.config.numberOfNotifications).forEach(function (o) {                
                var header = o.sender_name;

				// Determine if the header texts need truncating
                if (header.length > this.config.maxHeaderCharacters) {
                    header = header.substring(0, this.config.maxHeaderCharacters) + "...";
				}

				var notificationWrapper = document.createElement("tr");
                notificationWrapper.className = "normal";

                //Set icon
                var icon = null;
                if (self.config.showIcons) {   
                    //Get device that has sent notification
                    var device = self.getDevice(o.source_device_iden);
                    var iconPath = "/modules/MMM-PushBulletNotifications/icons/";

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

                    icon = document.createElement("span");
                    icon.className = "icon";
                    icon.innerHTML = "<img src=\"" + iconPath + "\" width=\"24\" />";
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
					bodyContentWrapper.className = "normal xsmall message";
                    bodyContentWrapper.innerHTML = o.body.substring(0, self.config.maxMsgCharacters);
					bodyWrapper.appendChild(bodyContentWrapper);
					wrapper.appendChild(bodyWrapper);
				}
			});

            //Show module
			self.show();
		}
        else {
            //Hide module if we have no pushes to show
			self.hide();
		}
		return wrapper;
	},

	getScripts: function() {
		return [];
	},

	getStyles: function () {
		return [
			"MMM-PushBulletNotifications.css",
		];
	},

	socketNotificationReceived: function (notification, payload) {
        console.log(notification);
        //Received pushes
		if (notification === "PUSHES") {
			if (payload) {
				this.loaded = true;
				this.pushes = payload;				
			}
			this.updateDom();
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
                console.log(command.toLowerCase().trim());

                if (command.startsWith("say:")) {
                    var message = command.substring(4);
                    this.sendNotification('MMM-TTS', message);
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
});