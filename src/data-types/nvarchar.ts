import { DataType } from '../data-type';
import WritableTrackingBuffer from '../tracking-buffer/writable-tracking-buffer';

const NULL = (1 << 16) - 1;
const MAX = (1 << 16) - 1;
const UNKNOWN_PLP_LEN = Buffer.from([0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
const PLP_TERMINATOR = Buffer.from([0x00, 0x00, 0x00, 0x00]);

const NVarChar: { maximumLength: number } & DataType = {
  id: 0xE7,
  type: 'NVARCHAR',
  name: 'NVarChar',
  maximumLength: 4000,

  declaration: function (parameter) {
    const value = parameter.value as any; // Temporary solution. Remove 'any' later.

    let length;
    if (parameter.length) {
      length = parameter.length;
    } else if (value != null) {
      length = value.toString().length || 1;
    } else if (value === null && !parameter.output) {
      length = 1;
    } else {
      length = this.maximumLength;
    }

    if (length <= this.maximumLength) {
      return 'nvarchar(' + length + ')';
    } else {
      return 'nvarchar(max)';
    }
  },

  resolveLength: function (parameter) {
    const value = parameter.value as any; // Temporary solution. Remove 'any' later.
    if (parameter.length != null) {
      return parameter.length;
    } else if (value != null) {
      if (Buffer.isBuffer(value)) {
        return (value.length / 2) || 1;
      } else {
        return value.toString().length || 1;
      }
    } else {
      return this.maximumLength;
    }
  },

  writeTypeInfo: function (buffer, parameter) {
    if (buffer) {
      buffer.writeUInt8(this.id);
      if (parameter.length! <= this.maximumLength) {
        buffer.writeUInt16LE(parameter.length! * 2);
      } else {
        buffer.writeUInt16LE(MAX);
      }
      buffer.writeBuffer(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]));
      return;
    }

    const buff = Buffer.alloc(3);
    let offset = 0;
    offset = buff.writeUInt8(this.id, offset);

    if (parameter.length! <= this.maximumLength) {
      buff.writeUInt16LE(parameter.length! * 2, offset);
    } else {
      buff.writeUInt16LE(MAX, offset);
    }

    const buff2 = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);

    return Buffer.concat([buff, buff2], buff.length + buff2.length)
  },

  writeParameterData: function (buff, parameter, options, cb) {
    buff.writeBuffer(Buffer.concat(Array.from(this.generate(parameter, options))));
    cb();
  },

  generate: function* (parameter, options) {
    if (parameter.value != null) {
      let value = parameter.value;

      if (parameter.length! <= this.maximumLength) {
        let length;
        if (value instanceof Buffer) {
          length = value.length;

          const buffer = Buffer.alloc(2);
          buffer.writeUInt16LE(length, 0);
          yield buffer;

          yield value;
        } else {
          value = value.toString();
          length = Buffer.byteLength(value, 'ucs2');

          const buffer = Buffer.alloc(2);
          buffer.writeUInt16LE(length, 0);
          yield buffer;

          yield Buffer.from(value, 'ucs2');
        }
      } else {
        yield UNKNOWN_PLP_LEN;

        if (value instanceof Buffer) {
          const length = value.length;
          if (length > 0) {
            const buffer = Buffer.alloc(4);
            buffer.writeUInt32LE(length, 0);
            yield buffer;
            yield value
          }
        } else {
          value = value.toString();
          const length = Buffer.byteLength(value, 'ucs2');

          if (length > 0) {
            const buffer = Buffer.alloc(4);
            buffer.writeUInt32LE(length, 0);
            yield buffer;
            yield Buffer.from(value, 'ucs2');
          }
        }

        yield PLP_TERMINATOR;
      }
    } else if (parameter.length! <= this.maximumLength) {
      const buffer = Buffer.alloc(2);
      buffer.writeUInt16LE(NULL, 0);
      yield buffer;
    } else {
      const buffer = Buffer.alloc(8);
      let offset = buffer.writeUInt32LE(0xFFFFFFFF, 0);
      buffer.writeUInt32LE(0xFFFFFFFF, offset);
      yield buffer;
    }
  },

  validate: function (value): null | string | TypeError {
    if (value == null) {
      return null;
    }
    if (typeof value !== 'string') {
      if (typeof value.toString !== 'function') {
        return TypeError('Invalid string.');
      }
      value = value.toString();
    }
    return value;
  }
};

export default NVarChar;
module.exports = NVarChar;
