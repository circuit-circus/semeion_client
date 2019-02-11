

# Semeion Server client

This node.js project handles the *client-side* things of the semeion network.

MQTT is used as the communication protocol.

## Install instructions
Clone the project, open it in the terminal and cd into it.

Install the node modules dependencies by running `npm install`.

Create a `configs.js` file. It should look like the following:

    module.exports = {
      serverHostname : '',
      semeionId : ''
    }
*serverHostname* is the hostname of the broker (e.g. sempi01.local) and *semeionId* is a unique number (written as a string) between 1-15.

Now you're ready to go! ✨ Run `npm start` to start the client.

The script's optional command-line arguments will overwrite the config file:
`-hn` The server hostname
`-id` The semeion client id

Use the command line arguments like this:

`npm start -- -hn sempi02.local`