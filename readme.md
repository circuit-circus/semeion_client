
# Semeion Server client

This node.js project handles the *client-side* things of the semeion network.

MQTT is used as the communication protocol.

## Install instructions
Clone project and install node modules.

Create a `config.js` file. It should look like the following:

    module.exports = {
      brokerIp : '',
      semeionId : ''
    }

Note: `semeionId` should be unique.

Run `sem_client.js` file.

Optional command-line arguments will overwrite the config file:
`-ip` The broker IP
`-id` The semeion client id
