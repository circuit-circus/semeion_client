import sys
from time import sleep
from smbus2 import SMBusWrapper
i2caddress = 0x08

def getData(address, offset, size):
    try:
        with SMBusWrapper(1) as bus:
            # Read a block of 'size' bytes from 'address', 'offset' 
            data = bus.read_i2c_block_data(address, offset, size)
            data = list(map(chr,data))
            data = ''.join(data)
            return data
    except:
        return ' Oops! I2C Error!'

# Give the I2C device time to settle
sleep(0.1)
print(getData(i2caddress, 99, 5))
sys.stdout.flush()