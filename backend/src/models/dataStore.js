import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dataFile = fileURLToPath(new URL("../../data/db.json", import.meta.url));
const dataDir = fileURLToPath(new URL("../../data", import.meta.url));

const defaultDb = {
  users: [],
  pipelines: []
};

class DataStore {
  async ensure() {
    await mkdir(dataDir, { recursive: true });

    try {
      await readFile(dataFile, "utf8");
    } catch (error) {
      await this.write(defaultDb);
    }
  }

  async read() {
    await this.ensure();
    const raw = await readFile(dataFile, "utf8");
    return raw ? JSON.parse(raw) : structuredClone(defaultDb);
  }

  async write(db) {
    await mkdir(dataDir, { recursive: true });
    await writeFile(dataFile, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    return db;
  }

  async update(mutator) {
    const db = await this.read();
    const nextDb = (await mutator(db)) || db;
    await this.write(nextDb);
    return nextDb;
  }
}

export const dataStore = new DataStore();

