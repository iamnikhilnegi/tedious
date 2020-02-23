import { DataType } from '../data-type';

const MAX = (1 << 16) - 1;
const UNKNOWN_PLP_LEN = Buffer.from([0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
const PLP_TERMINATOR = Buffer.from([0x00, 0x00, 0x00, 0x00]);

const VarBinary: { maximumLength: number } & DataType = {
  id: 0xA5,
  type: 'BIGVARBIN',
  name: 'VarBinary',
  maximumLength: 8000,

  declaration: function(parameter) {
    const value = parameter.value as any; // Temporary solution. Remove 'any' later.
    let length;
    if (parameter.length) {
      length = parameter.length;
    } else if (value != null) {
      length = value.length || 1;
    } else if (value === null && !parameter.output) {
      length = 1;
    } else {
      length = this.maximumLength;
    }

    if (length <= this.maximumLength) {
      return 'varbinary(' + length + ')';
    } else {
      return 'varbinary(max)';
    }
  },

  resolveLength: function(parameter) {
    const value = parameter.value as any; // Temporary solution. Remove 'any' later.
    if (parameter.length != null) {
      return parameter.length;
    } else if (value != null) {
      return value.length;
    } else {
      return this.maximumLength;
    }
  },

  generateTypeInfo: function(parameter) {
    const buffer = Buffer.alloc(3);
    buffer.writeUInt8(this.id, 0);

    if (parameter.length! <= this.maximumLength) {
      buffer.writeUInt16LE(this.maximumLength, 1);
    } else {
      buffer.writeUInt16LE(MAX, 1);
    }

    return buffer;
  },

  generateParameterLength(parameter, options) {
    if (parameter.value == null) {
      if (parameter.length! <= this.maximumLength) {
        return Buffer.from([0xFF, 0xFF]);
      } else {
        return Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
      }
    }

    let value = parameter.value;

    let length;
    if (value instanceof Buffer) {
      length = value.length;
    } else {
      value = value.toString();
      length = Buffer.byteLength(value, 'ucs2');
    }

    if (parameter.length! <= this.maximumLength) {
      const buffer = Buffer.alloc(2);
      buffer.writeUInt16LE(length, 0);
      return buffer;
    } else { // writePLPBody
      return UNKNOWN_PLP_LEN;
    }
  },

  * generateParameterData(parameter, options) {
    if (parameter.value == null) {
      return;
    }

    let value = parameter.value;

    if (parameter.length! <= this.maximumLength) {
      if (value instanceof Buffer) {
        yield value;
      } else {
        yield Buffer.from(value.toString(), 'ucs2');
      }
    } else { // writePLPBody
      let length;

      if (value instanceof Buffer) {
        length = value.length;
      } else {
        value = value.toString();
        length = Buffer.byteLength(value, 'ucs2');
      }

      if (length > 0) {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(length, 0);
        yield buffer;

        if (value instanceof Buffer) {
          yield value;
        } else {
          yield Buffer.from(value, 'ucs2');
        }
      }

      yield PLP_TERMINATOR;
    }
  },

  validate: function(value): Buffer | null | TypeError {
    if (value == null) {
      return null;
    }
    if (!Buffer.isBuffer(value)) {
      return new TypeError('Invalid buffer.');
    }
    return value;
  }
};

export default VarBinary;
module.exports = VarBinary;
