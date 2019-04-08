import sys
from time import sleep
from lib.smbus2 import SMBusWrapper

# What is the address of the device we're trying to read
i2caddress = 0x08

# Get arguments from whatever is calling this script
# dataSize is the amount of bytes we expect to get from the Arduino
# If not set correctly, can cause i2c errors
dataSize = 5
if len(sys.argv) > 1:
    dataSize = int(sys.argv[1])

# offset defines which "part" of the i2c code to use
# For this implementation, we have two parts:
# 99 is for reading the climax state
# 98 is for reading the settings
offsetToRead = 99
if len(sys.argv) > 2:
    offsetToRead = int(sys.argv[2])

# Attempts to read the i2c data with the given parameters
def getData(address, offset, size):
    try:
        with SMBusWrapper(1) as bus:
            # Read a block of 'size' bytes from 'address', 'offset' 
            # print("Reading block " + str(offset) + " from address " + str(address) + " of size " + str(size))
            data = bus.read_i2c_block_data(address, offset, size)
            return data
    except:
        return("Unexpected I2C error:" + str(sys.exc_info()[0]))

# Give the I2C device time to settle by sleeping
# Just a safety precaution, and can be adjusted
sleep(.5)

# Save the data we get in a variable
i2cData = getData(i2caddress, offsetToRead, dataSize)

# If we don't get an error, just write it to standard output, else standard error
if "error" not in i2cData:
    sys.stdout.write(str(i2cData))
else:
    sys.stderr.write(str(i2cData))

# Close python script and clean the output streams
sys.stderr.flush()
sys.stdout.flush()