import sys
from time import sleep
from smbus2 import SMBusWrapper
i2caddress = 0x08

# Get arguments from whatever is calling this script
dataToWrite = [-1]
if len(sys.argv) > 1:
    dataToWrite = sys.argv[1]

def writeData(address, offset, data):
    try:
        with SMBusWrapper(1) as bus:
            data = list(map(int,data))
            # Read a block of 'size' bytes from 'address', 'offset' 
            bus.write_i2c_block_data(address, offset, data)
            return "Writing data to I2C done."
    except:
        return("Unexpected I2C error:" + str(sys.exc_info()[0]))

# Give the I2C device time to settle
sleep(0.1)
i2cData = writeData(i2caddress, 98, dataToWrite)

if "error" not in i2cData:
    sys.stdout.write(i2cData)
else:
    sys.stderr.write(i2cData)

# Close python script and clean output
sys.stderr.flush()
sys.stdout.flush()
