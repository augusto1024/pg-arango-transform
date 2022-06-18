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

  private async write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.fileStream) {
        this.fileStream = this.newStream();
        this.fileStream.write('[');
      }

      this.fileStream.write(data, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  public async push(data: object) {
    if (this.lastObjectWritten) {
      await this.write(`${JSON.stringify(this.lastObjectWritten)},`);
    }

    this.lastObjectWritten = data;
  }

  public async close() {
    await this.write(JSON.stringify(this.lastObjectWritten));
    await this.write(']');
    this.fileStream.close();
  }

  public async getFileNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.readdir('./data', (err, files) => {
        if (err) {
          return reject(err);
        }
        return resolve(files.filter(file => file.startsWith(this.type)));
      });
    })
  }

  public async getFile(name: string): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
      fs.readFile(`./data/${name}`, 'utf-8', (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(JSON.parse(data));
      })
    })
  }
}

export default Stream;
