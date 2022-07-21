import fs from 'fs';
import { v4 as uuid } from 'uuid';

const MAX_FILE_SIZE = 157286400; // 150Mb

class Stream {
  private fileStreams: Record<string, fs.WriteStream>;
  private fileStreamSizes: Record<string, number>;

  constructor() {
    this.fileStreams = {};
    this.fileStreamSizes = {};
    if (fs.existsSync('./data')) {
      fs.rmSync('./data', { recursive: true });
    }
    fs.mkdirSync('./data');
  }

  private newStream(collection: string): Promise<fs.WriteStream> {
    collection = collection.replace('-', '_');
    return new Promise((resolve) => {
      fs.readdir('./data', (err, files) => {
        const collectionFiles = files.filter((file) =>
          file.startsWith(collection)
        );
        const id = `./data/${collection}-${
          collectionFiles.length
        }-${new Date().valueOf()}-${uuid()}.json`;
        resolve(fs.createWriteStream(id));
      });
    });
  }

  private async write(
    collection: string,
    element: string,
    options?: { close?: boolean }
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        let addLeadingComma = options?.close ? false : true;

        if (!options?.close && this.fileStreamSizes[collection] > MAX_FILE_SIZE) {
          await this.fileStreams[collection].write(']', (err) => {
            if (err) return Promise.reject(err);
            Promise.resolve();
          });
          this.fileStreams[collection].close();
          this.fileStreams[collection] = undefined;
          this.fileStreamSizes[collection] = 0;
        }

        if (!this.fileStreams[collection]) {
          this.fileStreams[collection] = await this.newStream(collection);
          this.fileStreamSizes[collection] = 0;
          await this.fileStreams[collection].write('[', (err) => {
            if (err) return Promise.reject(err);
            Promise.resolve();
          });
          addLeadingComma = false;
        }

        await this.fileStreams[collection].write(
          addLeadingComma ? `,\n${element}` : `${element}`,
          (err) => {
            if (err) return Promise.reject(err);
            Promise.resolve();
          }
        );
        this.fileStreamSizes[collection] += Buffer.from(element).length;
        resolve();
      } catch (err) {
        reject(err);
      }
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
