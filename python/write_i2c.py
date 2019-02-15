import sys
from time import sleep
from smbus2 import SMBusWrapper
i2caddress = 0x08

# Get arguments from whatever is calling this script
climaxWrite = -1
if len(sys.argv) > 1:
    climaxWrite = sys.argv[1]

offsetToWrite = 98
if len(sys.argv) > 2:
    offsetToWrite = sys.argv[2]

settingsWrite = [0]
if len(sys.argv) > 3:
    settingsWrite = sys.argv[3]

# 98 is climax writing
# 97 is settings writing

def writeData(address, offset, data):
    try:
        with SMBusWrapper(1) as bus:
            if offset == 98:
                data = int(data)
            else:
                data = list(map(int, data.split(',')))
            # Read a block of 'size' bytes from 'address', 'offset' 
            bus.write_i2c_block_data(address, int(offset), data)
            return "Writing data to I2C done."
    except:
        return("Unexpected I2C error:" + str(sys.exc_info()[0]))

# Give the I2C device time to settle
sleep(0.1)
i2cData = ""
if offsetToWrite == 98:
    i2cData = writeData(i2caddress, offsetToWrite, climaxWrite)
else:
    i2cData = writeData(i2caddress, offsetToWrite, settingsWrite)

if "error" not in i2cData:
    sys.stdout.write(i2cData)
else:
    sys.stderr.write(i2cData)

# Close python script and clean output
sys.stderr.flush()
sys.stdout.flush()
