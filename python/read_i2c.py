import sys
from time import sleep
from lib.smbus2 import SMBusWrapper
i2caddress = 0x08

# Get arguments from whatever is calling this script
dataSize = 5
if len(sys.argv) > 1:
    dataSize = int(sys.argv[1])

offsetToRead = 99
if len(sys.argv) > 2:
    offsetToRead = int(sys.argv[2])

# 99 is climax read
# 98 is settings read

def getData(address, offset, size):
    try:
        with SMBusWrapper(1) as bus:
            # Read a block of 'size' bytes from 'address', 'offset' 
            # print("Reading block " + str(offset) + " from address " + str(address) + " of size " + str(size))
            data = bus.read_i2c_block_data(address, offset, size)
            return data
    except:
        return("Unexpected I2C error:" + str(sys.exc_info()[0]))

# Give the I2C device time to settle
sleep(2)
i2cData = getData(i2caddress, offsetToRead, dataSize)

if "error" not in i2cData:
    sys.stdout.write(str(i2cData))
else:
    sys.stderr.write(str(i2cData))

# Close python script and clean output
sys.stderr.flush()
sys.stdout.flush()
