# Semeion Server client

This node.js project handles the *client-side* things of the semeion network.

MQTT is used as the communication protocol.

## Install instructions

1. Clone project and install node modules.

2. Create a config.js file. It should include the following:

var configs = {
  brokerIp : '',
  semeionId : ''
}

semeionId should be unique.

3. Run sem_client.js file.
Optional command-line arguments will overwrite the config file:
-ip - The broker IP
-id - The semeion client id