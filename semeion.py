import sys
from time import sleep
from smbus2 import SMBusWrapper
i2caddress = 0x08

def getData(address, offset, size):
    try:
        with SMBusWrapper(1) as bus:
            # Read a block of 'size' bytes from 'address', 'offset' 
            # print("Reading block " + str(offset) + " from address " + str(address) + " of size " + str(size))
            data = bus.read_i2c_block_data(address, offset, size)
            # print("Converting data to chars")
            data = list(map(chr,data))
            # print("Returning data")
            data = ''.join(data)
            return data
    except:
        return("Unexpected I2C error:", sys.exc_info()[0])

# Give the I2C device time to settle
sleep(0.1)
i2cData = getData(i2caddress, 99, 13)

if "error" not in i2cData:
	sys.stdout.write(i2cData)
else:
	sys.stderr.write(i2cData)

# Close python script and clean output
sys.stderr.flush()
sys.stdout.flush()
