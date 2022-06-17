import fs from 'fs';
import { v4 as uuid } from 'uuid';

class Stream {
  private fileStream: fs.WriteStream;
  private type: 'node' | 'edge';
  private lastObjectWritten: object;

  constructor(type: 'node' | 'edge') {
    this.type = type;
  }

  private newStream(): fs.WriteStream {
    const id = `./data/${this.type}-${new Date().valueOf()}-${uuid()}.json`;
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data');
    }
    return fs.createWriteStream(id);
  }

  private write(data: string) {
    if (!this.fileStream) {
      this.fileStream = this.newStream();
      this.fileStream.write('[');
    }

    this.fileStream.write(data);
  }

  public push(data: object) {
    if (this.lastObjectWritten) {
      this.write(`${JSON.stringify(this.lastObjectWritten)},`);
    }

    this.lastObjectWritten = data;
  }

  public close() {
    if (this.fileStream) {
      if (this.lastObjectWritten) {
        this.write(`${JSON.stringify(this.lastObjectWritten)}`);
      }
      this.write(']');
      this.fileStream.close();
    }
  }
}

export default Stream;
