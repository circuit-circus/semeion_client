import sys
from time import sleep
from lib.smbus2 import SMBusWrapper

# What is the address of the device we're trying to write
i2caddress = 0x08

# Get arguments from whatever is calling this script

# Used when we want to trigger a climax.
# Actually doesn't matter what this is set to, since the Arduino just looks at the offset
climaxWrite = -1
if len(sys.argv) > 1:
    climaxWrite = sys.argv[1]

# offset defines which "part" of the i2c code to use
# For this implementation, we have two parts:
# 96 is for setting the climax state
# 95 is for writing new settings to the Arduino
offsetToWrite = 96
if len(sys.argv) > 2:
    offsetToWrite = sys.argv[2]

# Used when we want to change the settings of the Arduino
# Note that this is an array
settingsWrite = [0]
if len(sys.argv) > 3:
    settingsWrite = sys.argv[3]

# Attempts to write some data via i2c with the given parameters
def writeData(address, offset, data):
    try:
        with SMBusWrapper(1) as bus:
            # If we're writing climax, parse into an int
            if offset == 96:
                data = int(data)
            # If we're writing settings, parse into an array
            else:
                data = list(map(int, data.split(',')))
            # Write a 'data' to 'address', with 'offset'
            bus.write_i2c_block_data(address, int(offset), data)
            # Everything went great, so let the calling function know
            return "Writing data to I2C done."
    # Catch any errors and return that instead
    except:
        return("Unexpected I2C error:" + str(sys.exc_info()[0]))

# Give the I2C device time to settle by sleeping
# Just a safety precaution, and can be adjusted
sleep(0.1)

# Declare where we save our i2c response
i2cData = ""

# Use the two different types of data for different offsets
if offsetToWrite == 96:
    i2cData = writeData(i2caddress, offsetToWrite, climaxWrite)
else:
    i2cData = writeData(i2caddress, offsetToWrite, settingsWrite)

# If we don't get an error, just write our message to standard output, else standard error
if "error" not in i2cData:
    sys.stdout.write(i2cData)
else:
    sys.stderr.write(i2cData)

# Close python script and clean the output streams
sys.stderr.flush()
sys.stdout.flush()