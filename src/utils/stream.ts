import fs from 'fs';
import { v4 as uuid } from 'uuid';

class Stream {
  private fileStreams: Record<string, fs.WriteStream>;

  constructor() {
    this.fileStreams = {};
  }

  private newStream(collection: string): fs.WriteStream {
    const id = `./data/${collection}-${new Date().valueOf()}-${uuid()}.json`;
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data');
    }
    return fs.createWriteStream(id);
  }

  private async write(
    collection: string,
    element: string,
    options?: { close?: boolean }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let addLeadingComma = options?.close ? false : true;
      if (!this.fileStreams[collection]) {
        this.fileStreams[collection] = this.newStream(collection);
        this.fileStreams[collection].write('[');
        addLeadingComma = false;
      }

      this.fileStreams[collection].write(
        addLeadingComma ? `,${element}` : element,
        (err) => {
          if (err) {
            return reject(err);
          }
          return resolve();
        }
      );
    });
  }

  public async push(collection: string, element: object): Promise<void> {
    await this.write(collection, `${JSON.stringify(element)}`);
  }

  public async close(): Promise<void> {
    for (const collection of Object.keys(this.fileStreams)) {
      await this.write(collection, ']', { close: true });
      this.fileStreams[collection].close();
    }
  }

  public async getFileNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.readdir('./data', (err, files) => {
        if (err) {
          return reject(err);
        }
        return resolve(files);
      });
    });
  }

  public async getFile(name: string): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
      fs.readFile(`./data/${name}`, 'utf-8', (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(JSON.parse(data));
      });
    });
  }
}

export default Stream;
