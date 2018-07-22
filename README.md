# MMM-PushBulletNotifications
This [MagicMirror²](https://github.com/MichMich/MagicMirror/) module displays phone notifications via the PushBullet API.
Use this module to display notifications, send (some) commands to your Magic Mirror or make your Magic Mirror speak out loud.

Inspired by the [PushBulletNotes](https://github.com/maliciousbanjo/PushBulletNotes) module created by GitHub user [maliciousbanjo](https://github.com/maliciousbanjo)
and the [Phone Notification Mirror](https://github.com/ronny3050/phone-notification-mirror) module created by GitHub user [ronny3050](https://github.com/ronny3050)

## Dependencies / Requirements

### PushBullet
This module uses PushBullet (https://www.npmjs.com/package/pushbullet). [PushBullet](https://www.pushbullet.com) can be installed on your phone or computer. 
This module uses the [Realtime Event Stream](https://docs.pushbullet.com/#realtime-event-stream) with normal pushes (no ephemerals).

The PushBullet API documentation can be found here (https://docs.pushbullet.com/). To use the API you need an API Access Token. 
This Access Token can be created in your PushBullet account under [settings](https://www.pushbullet.com/#settings). 
The PushBullet API Access Token has to be set in the configuration for this module to work (see configuration options).

#### Magic Mirror device
Create 'Magic Mirror' as a device in PushBullet to be able to send messages to your Magic Mirror using this curl command:
````
curl --header 'Access-Token: <your_access_token_here>'
	 --header 'Content-Type: application/json'
	 --data-binary '{"app_version":1,"manufacturer":"<your_name>","model":"Magic Mirror","nickname":"Magic Mirror","push_token":"","icon":"system"}' 
	 --request POST https://api.pushbullet.com/v2/devices
````
Replace <your_access_token_here> with the Access Token created in PushBullet en replace <your_name> with your name.

This device can be set as filter (see configuration options) to show only notifications send to this device.

### Other
- [Play-sound](https://www.npmjs.com/package/play-sound) package is used to play a sound when a notification is received.
- The module [MMM-TTS](https://github.com/fewieden/MMM-TTS) of GitHub user [fewieden](https://github.com/fewieden) is used for offline Text-To-Speech. See installation instructions [here](https://github.com/fewieden/MMM-TTS)

## Installation
In your terminal, go to your MagicMirror's Module folder:
````
cd ~/MagicMirror/modules
````

Clone this repository:
````
git clone https://github.com/basknol/MMM-PushBulletNotifications.git
````

Go to the MMM-PushBulletNotifications folder:
````
cd MMM-PushBulletNotifications
````

Install necessary dependencies:
````
npm install
````

## Using the module

To use this module, add it to the modules array in the `config/config.js` file:
````javascript
modules: [
	{
		module: 'MMM-PushBulletNotifications',
		header: 'Notifications',
		position: 'bottom_right',	// This can be any of the regions.		
		config: {
			// See 'Configuration options' for more information.
			accessToken: "", //PushBullet API Access Token
			numberOfNotifications: 3,
			filterTargetDeviceName: "",
			showNotificationsSentToAllDevices: true,
			onlyAllowCommandsFromSourceDevices: [],
			fetchLimitPushBullet: 50,
			showNotificationsOnLoad: true,
			showMessage: true,
			showIcons: true,
			showDateTime: true,
			localesDateTime: 'nl-NL',
			playSoundOnNotificationReceived: true,
			soundFile: 'modules/MMM-PushBulletNotifications/sounds/new-message.mp3',			
			maxMsgCharacters: 50,
			maxHeaderCharacters: 32
		}
	}
]
````

## Configuration options

The following properties can be configured:

<table width="100%">
	<!-- why, markdown... -->
	<thead>
		<tr>
			<th>Option</th>
			<th width="100%">Description</th>
		</tr>
	<thead>
	<tbody>	
		<tr>
			<td><code>accessToken</code></td>
			<td>PushBullet API Access Token. This Access Token can be created in your PushBullet account under [settings](https://www.pushbullet.com/#settings)<br />				
				<br />This value is <b>REQUIRED</b>
			</td>
		</tr>		
		<tr>
			<td><code>numberOfNotifications</code></td>
			<td>Integer value, the number of notifications to show on the Magic Mirror.<br />
				<br /><b>Example:</b> <code>5</code>
				<br /><b>Default value:</b> <code>3</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>      
		<tr>
			<td><code>filterTargetDeviceName</code></td>
			<td>String value, only show notifications that are send to this PushBullet device.<br />
				<br /><b>Example:</b> <code>Magic Mirror</code>
				<br /><b>Default value:</b> <code>empty string</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr> 
		<tr>
			<td><code>showNotificationsSentToAllDevices</code></td>
			<td>Boolean value, show notifications to all devices in PushBullet (=true). This option is only used if the option 'filterTargetDeviceName' is filled in.<br />				
				<br /><b>Possible values:</b> <code>true</code> or <code>false</code>
				<br /><b>Default value:</b> <code>true</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>onlyAllowCommandsFromSourceDevices</code></td>
			<td>Array value containing strings. If this array is empty commands from every device is allowed.<br />Each string should be the nickname of a PushBullet device. To get a list of devices from the API run the curl command: <code>curl --header 'Access-Token: <your_access_token_here>' https://api.pushbullet.com/v2/devices </code><br />
				<br />Commands should be prefixed with 'mm:'. A list of command currently supported.
				<ul>
					<li>mm:shutdown</li>
					<li>mm:hide all modules</li>
					<li>mm:show all modules</li>
					<li>mm:display off</li>
					<li>mm:display on</li>
					<li>mm:say:Hello World (this requires that the <a href="https://github.com/fewieden/MMM-TTS">MMM-TTS</a> is installed)</li>
				</ul>
				<br /><b>Example:</b> <code>['MY-PC', 'My iPhone']</code>
				<br /><b>Default value:</b> empty array <code>[]</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
        <tr>
			<td><code>fetchLimitPushBullet</code></td>
			<td>Integer value, option to limit the number of notifications are fetched from PushBullet<br />
				<br /><b>Example:</b> <code>20</code>
				<br /><b>Default value:</b> <code>50</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>    
		<tr>
			<td><code>showNotificationsOnLoad</code></td>
			<td>Boolean value, load notifications from PushBullet when this module is loaded (=true). Otherwise notifications are load when send to PushBullet<br />				
				<br /><b>Possible values:</b> <code>true</code> or <code>false</code>
				<br /><b>Default value:</b> <code>true</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>    
		<tr>
			<td><code>showMessage</code></td>
			<td>Boolean value, show the PushBullet notification content<br />				
				<br /><b>Possible values:</b> <code>true</code> or <code>false</code>
				<br /><b>Default value:</b> <code>true</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>showIcons</code></td>
			<td>Boolean value, show icon based on source device (desktop, phone, system icon)<br />				
				<br /><b>Possible values:</b> <code>true</code> or <code>false</code>
				<br /><b>Default value:</b> <code>true</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>showDateTime</code></td>
			<td>Boolean value, show date and time of when notification was created<br />				
				<br /><b>Possible values:</b> <code>true</code> or <code>false</code>
				<br /><b>Default value:</b> <code>true</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>localesDateTime</code></td>
			<td>String value, specify the language whose formatting conventions for date and time should be used. (See [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString) for details.<br />
				<br /><b>Example:</b> <code>en-US</code>
				<br /><b>Default value:</b> <code>nl-NL</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>playSoundOnNotificationReceived</code></td>
			<td>Boolean value, play a sound when a notification is received.<br />				
				<br /><b>Possible values:</b> <code>true</code> or <code>false</code>
				<br /><b>Default value:</b> <code>true</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>soundFile</code></td>
			<td>String value, path to the sound file that has to be played when a notification is received.<br />
				<br /><b>Example:</b> <code>'modules/MMM-PushBulletNotifications/sounds/new-message.mp3'</code>
				<br /><b>Default value:</b> <code>'modules/MMM-PushBulletNotifications/sounds/new-message.mp3'</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>maxMsgCharacters</code></td>
			<td>String value, the maximum number of characters to show from the notification body.<br />
				<br /><b>Example:</b> <code>75</code>
				<br /><b>Default value:</b> <code>50</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
		<tr>
			<td><code>maxHeaderCharacters</code></td>
			<td>String value, the maximum number of characters to show from the notification header. The header shows the sender's name.<br />
				<br /><b>Example:</b> <code>20</code>
				<br /><b>Default value:</b> <code>32</code>
				<br />This value is <b>OPTIONAL</b>
			</td>
		</tr>
    </tbody>
</table>