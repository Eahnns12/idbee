import { isType } from "./utils.js";

/**
 * IDBee class to handle IndexedDB operations with an improved API.
 * @class
 */
class IDBee {
  #dbName;
  #dbVersion;
  #dbStores;
  #isOpened;
  #isNameSet;
  #isVersionSet;
  #isStoresSet;

  /**
   * Constructor for creating an IDBee instance.
   * @param {Object} [config] - Configuration object.
   * @param {boolean} [config.dev=false] - Whether enable debug logs.
   */
  constructor({ dev = false } = {}) {
    this.dev = dev;
    this.idb = window.indexedDB;
    this.db = null;
    this.#dbName;
    this.#dbVersion = 1;
    this.#dbStores = [];
    this.#isOpened = false;
    this.#isNameSet = false;
    this.#isVersionSet = false;
    this.#isStoresSet = false;
  }

  /**
   * Sets the database name.
   * @param {string} name - The name of the database.
   * @returns {IDBee} Current instance for chaining.
   * @throws {Error} If database already opened or name already set.
   */
  name(name) {
    if (this.#isOpened) {
      throw new Error("Cannot modify the builder after opening the database.");
    }

    if (this.#isNameSet) {
      throw new Error(
        "Database name has already been set. You cannot set it multiple times."
      );
    }

    if (!isType(name, "String")) {
      throw new TypeError("db name must be a string");
    }

    this.#log(`Database name set from "${this.dbName}" to "${name}".`);
    this.dbName = name;
    this.#isNameSet = true;

    return this;
  }

  /**
   * Sets the database version.
   * @param {number} version - The version number.
   * @returns {IDBee} Current instance for chaining.
   * @throws {Error} If database already opened or version already set.
   */
  version(version) {
    if (this.#isOpened) {
      throw new Error("Cannot modify the builder after opening the database.");
    }

    if (this.#isVersionSet) {
      throw new Error(
        "Database version has already been set. You cannot set it multiple times."
      );
    }

    if (!isType(version, "Number")) {
      throw new TypeError("db version must be a number");
    }

    this.#log(`Database version updated to ${version}.`);
    this.#dbVersion = version;
    this.#isVersionSet = true;

    return this;
  }

  /**
   * Defines the object stores.
   * @param {Object[]} stores - Object stores configuration.
   * @returns {IDBee} Current instance for chaining.
   * @throws {Error} If database already opened or stores already defined.
   */
  stores(stores) {
    if (this.#isOpened) {
      throw new Error("Cannot modify the builder after opening the database.");
    }

    if (this.#isStoresSet) {
      throw new Error(
        "Database stores has already been set. You cannot set it multiple times."
      );
    }

    if (!isType(stores, "Array")) {
      throw new TypeError("db stores must be a array");
    }

    this.#log(
      `Database store configuration updated to include: ${stores
        .map((store) => store.name)
        .join(", ")}.`
    );

    this.#log(`This will only apply when database init or version change.`);

    this.#dbStores = stores;
    this.#isStoresSet = true;

    return this;
  }

  /**
   * Opens the connection to database.
   * @param {Object} [callbacks] - Object containing event callbacks.
   * @returns {Promise<IDBee>} Promise resolved with IDBee instance.
   * @throws {Error} If database already opened.
   */
  open(callbacks = {}) {
    if (this.#isOpened) {
      throw new Error("Cannot open the database: it is already opened.");
    }

    if (!isType(callbacks, "Object")) {
      throw new TypeError(
        "The argument for the 'open' method must be an object containing callbacks."
      );
    }

    const acceptedCallbackNames = [
      "onsuccess",
      "onerror",
      "onupgradeneeded",
      "onblocked",
    ];

    Object.entries(callbacks).forEach(([callback, func]) => {
      if (!acceptedCallbackNames.includes(callback)) {
        throw new Error(`Invalid callback name: ${callback}`);
      }

      if (!isType(func, "Function")) {
        throw new TypeError(`callback must be a function`);
      }
    });

    return new Promise((resolve, reject) => {
      if (isType(this.dbName, "Undefined")) {
        this.#log(`No valid name provided for database`);
        this.#log(`Database will init with name "idb"`);
        this.dbName = "idb";
      }

      const request = this.idb.open(this.dbName, this.#dbVersion);

      request.onsuccess = (event) => {
        this.#log(`${this.dbName} open successfully`);
        this.#log(this.info);

        callbacks.onsuccess?.(event);
        this.db = event.target.result;
        resolve(this);
      };

      request.onerror = (event) => {
        this.#log(
          `${this.dbName} Failed to open database due to error: ${event.target.error.message}`
        );

        callbacks.onerror?.(event);
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        this.#log(`${this.dbName} upgrade...`);

        const db = event.target.result;
        const existingStores = Array.from(db.objectStoreNames);
        const idealStores = this.#dbStores.map(({ name }) => name);

        // Delete unnecessary store
        existingStores
          .filter((storeName) => !idealStores.includes(storeName))
          .forEach((storeName) => {
            db.deleteObjectStore(storeName);
            this.#log(`objectStore: "${storeName}" deleted`);
          });

        if (!isType(this.#dbStores, "Array") || !this.#dbStores?.length) {
          this.#log(
            `No valid store definitions provided for database "${this.dbName}".`
          );
          this.#log(`This will create store "app" automayically`);

          this.#dbStores.push({ name: "app" });

          //   throw new Error("No available store exists");
        }

        // Create or update stores
        this.#dbStores.forEach((store) => {
          const { name, options = {}, indexes = [] } = store;

          if (!isType(options, "Object")) {
            throw new Error(
              `Store "${name}" has invalid options. Expected options to be an object.`
            );
          }

          if (!isType(indexes, "Array")) {
            throw new Error(
              `Store "${name}" has invalid indexes definition. Expected indexes to be an array.`
            );
          }

          let objectStore;

          if (!existingStores.includes(name)) {
            const { keyPath = "id", autoIncrement = keyPath === "id" } =
              options;

            objectStore = db.createObjectStore(name, {
              keyPath,
              autoIncrement,
            });

            this.#log(
              `objectStore: "${name}" created with keyPath: ${keyPath} & autoIncrement: ${autoIncrement}`
            );
          } else {
            objectStore = event.target.transaction.objectStore(name);
          }

          objectStore.transaction.onerror = (event) =>
            reject(event.target.error);

          objectStore.transaction.onabort = (event) =>
            reject(event.target.error);

          // Delete all remaining index
          Array.from(objectStore.indexNames).forEach((indexName) => {
            objectStore.deleteIndex(indexName);
            this.#log(`index: "${indexName}" deleted`);
          });

          // Create index for object store
          indexes.forEach(
            ({ name, keyPath = name, unique = false, multiEntry = false }) => {
              objectStore.createIndex(name, keyPath, { unique, multiEntry });
              this.#log(
                `index: "${name}" created with unique: ${unique} & multiEntry: ${multiEntry}`
              );
            }
          );
        });

        callbacks.onupgradeneeded?.(event);
      };
    });
  }

  /**
   * Closes the database connection.
   */
  close() {
    if (!this.db) {
      throw new Error("The database connection is not open or already closed");
    }

    this.#log(`${this.dbName} closed.`);

    this.db.close();
  }

  /**
   * Performs a database transaction.
   * @param {string[]} [storeNames] - Object store names to operate on in transaction.
   * @param {Function} callback - Async transaction callback function.
   * @returns {Promise} Promise resolved when transaction completes.
   */
  transaction(...args) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        throw new Error("Database is not open.");
      }

      let [selectedStoreNames, callback] =
        typeof args[0] === "function" ? [null, args[0]] : args;

      if (callback && !isType(callback, "AsyncFunction")) {
        throw new TypeError(
          "Transaction callback must be an asynchronous function."
        );
      }

      const storeNames =
        selectedStoreNames ?? Array.from(this.db.objectStoreNames);

      const transaction = this.db.transaction(storeNames, "readwrite");

      const objectStores = ((transaction, storeNames) => {
        const stores = {};

        for (const name of storeNames) {
          const store = transaction.objectStore(name);
          stores[name] = {
            add: (data) => new Operations().add(store, data),
            get: (data) => new Operations().get(store, data),
            put: (data) => new Operations().put(store, data),
            delete: (data) => new Operations().delete(store, data),
          };
        }

        return stores;
      })(transaction, storeNames);

      if (callback) {
        callback(objectStores)
          .then(resolve)
          .catch(reject)
          .finally(() => transaction.commit());
      }

      transaction.oncomplete = () => resolve(storeNames);
      transaction.onerror = (event) => reject(event.target.error);
      transaction.onabort = (event) => reject(event.target.error);
    });
  }

  /**
   * Deletes the database.
   * @returns {Promise} Promise resolved when database is deleted.
   */
  delete() {
    if (!this.db) {
      throw new Error("Database is not open.");
    }

    return new Promise((resolve, reject) => {
      const request = this.idb.deleteDatabase(this.dbName);

      request.onsuccess = (event) => {
        return resolve(event);
      };

      request.onerror = (event) => {
        return reject(event);
      };
    });
  }

  /**
   * Logs a message if the library is in development mode.
   * @param {string} message - The message to log.
   */
  #log(message) {
    if (this.dev) {
      if (typeof message !== "string") {
        console.log(`%c***`, "color: #FFAC9A;");
        console.log(message);
        console.log(`%c***`, "color: #FFAC9A;");
      } else {
        console.log(`%c[IDBee] ${message}`, "color: #FFAC9A;");
      }
    }
  }

  get info() {
    const info = {
      name: this.dbName,
      version: this.#dbVersion,
      stores: this.#dbStores,
    };

    return info;
  }
}

class Operations {
  constructor() {}

  add(store, args) {
    const { key, value } = args;
    return this.#handleRequest(store.add(value, key));
  }

  get(store, args = {}) {
    const get = new OperationChainHandler((store, args) => {
      const { key, index, where } = args;

      if (
        isType(key, "Undefined") ||
        !isType(index, "Undefined") ||
        !isType(where, "Undefined")
      ) {
        return false;
      }

      return new Promise((resolve, reject) => {
        const request = store.get(key);

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    });

    const getAll = new OperationChainHandler((store, args) => {
      const { key, index, where, query, count } = args;

      if (
        !isType(key, "Undefined") ||
        !isType(index, "Undefined") ||
        !isType(where, "Undefined")
      ) {
        return false;
      }

      return new Promise((resolve, reject) => {
        const request = store.getAll(this.#createRange(query), count);

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    });

    const indexGet = new OperationChainHandler((store, args) => {
      const { key, index, where } = args;

      if (
        isType(key, "Undefined") ||
        isType(index, "Undefined") ||
        !isType(where, "Undefined")
      ) {
        return false;
      }

      return new Promise((resolve, reject) => {
        const request = store.index(index).get(key);

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    });

    const indexGetAll = new OperationChainHandler((store, args) => {
      const { key, index, where, query, count } = args;

      if (
        !isType(key, "Undefined") ||
        isType(index, "Undefined") ||
        !isType(where, "Undefined")
      ) {
        return false;
      }

      return new Promise((resolve, reject) => {
        const request = store
          .index(index)
          .getAll(this.#createRange(query), count);

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    });

    const cursorGet = new OperationChainHandler((store, args) => {
      const { key, index, where, query, direction } = args;

      if (
        !isType(key, "Undefined") ||
        !isType(index, "Undefined") ||
        isType(where, "Undefined")
      ) {
        return false;
      }

      if (!isType(where, "Function")) {
        throw new TypeError(`where must be a function`);
      }

      return new Promise((resolve, reject) => {
        const request = store.openCursor(this.#createRange(query), direction);

        const result = [];

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          const cursor = event.target.result;

          if (cursor) {
            const callbackResult = where(cursor.value);

            if (callbackResult) {
              result.push(callbackResult);
            }

            cursor.continue();
          } else {
            resolve(result);
          }
        };
      });
    });

    const indexCursorGet = new OperationChainHandler((store, args) => {
      const { key, index, where, query, direction } = args;

      if (
        !isType(key, "Undefined") ||
        isType(index, "Undefined") ||
        isType(where, "Undefined")
      ) {
        return false;
      }

      if (!isType(where, "Function")) {
        throw new TypeError(`where must be a function`);
      }

      return new Promise((resolve, reject) => {
        const request = store
          .index(index)
          .openCursor(this.#createRange(query), direction);

        const result = [];

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          const cursor = event.target.result;

          if (cursor) {
            const callbackResult = where(cursor.value);

            if (callbackResult) {
              result.push(callbackResult);
            }

            cursor.continue();
          } else {
            resolve(result);
          }
        };
      });
    });

    get.next(getAll);
    getAll.next(indexGet);
    indexGet.next(indexGetAll);
    indexGetAll.next(cursorGet);
    cursorGet.next(indexCursorGet);

    const result = get.run(store, args);

    return result === false ? undefined : result;
  }

  put(store, args = {}) {
    const put = new OperationChainHandler((store, args) => {
      const { key, value, where } = args;

      if (isType(value, "Undefined") || !isType(where, "Undefined")) {
        return false;
      }

      return new Promise((resolve, reject) => {
        const request = store.put(value, key);

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    });

    const cursorUpdate = new OperationChainHandler((store, args) => {
      const { value, index, where, query, direction } = args;

      if (
        !isType(value, "Undefined") ||
        !isType(index, "Undefined") ||
        isType(where, "Undefined")
      ) {
        return false;
      }

      if (!isType(where, "Function")) {
        throw new TypeError(`where must be a function`);
      }

      return new Promise((resolve, reject) => {
        const request = store.openCursor(this.#createRange(query), direction);

        const result = [];

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          const cursor = event.target.result;

          if (cursor) {
            const callbackResult = where(cursor.value);

            if (callbackResult) {
              const request = cursor.update(callbackResult);

              request.onerror = (event) => {
                reject(event.target.error);
              };

              request.onsuccess = () => {
                result.push(request.result);
              };
            }

            cursor.continue();
          } else {
            resolve(result);
          }
        };
      });
    });

    const indexCursorUpdate = new OperationChainHandler((store, args) => {
      const { index, value, where, query, direction } = args;

      if (
        !isType(value, "Undefined") ||
        isType(index, "Undefined") ||
        isType(where, "Undefined")
      ) {
        return false;
      }

      if (!isType(where, "Function")) {
        throw new TypeError(`where must be a function`);
      }

      return new Promise((resolve, reject) => {
        const request = store
          .index(index)
          .openCursor(this.#createRange(query), direction);

        const result = [];

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          const cursor = event.target.result;

          if (cursor) {
            const callbackResult = where(cursor.value);

            if (callbackResult) {
              const request = cursor.update(callbackResult);

              request.onerror = (event) => {
                reject(event.target.error);
              };

              request.onsuccess = () => {
                result.push(request.result);
              };
            }

            cursor.continue();
          } else {
            resolve(result);
          }
        };
      });
    });

    put.next(cursorUpdate);
    cursorUpdate.next(indexCursorUpdate);

    const result = put.run(store, args);

    return result === false ? undefined : result;
  }

  delete(store, args = {}) {
    const remove = new OperationChainHandler((store, args) => {
      const { key, index, where } = args;

      if (
        isType(key, "Undefined") ||
        !isType(index, "Undefined") ||
        !isType(where, "Undefined")
      ) {
        return false;
      }

      return new Promise((resolve, reject) => {
        const request = store.delete(key);

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    });

    const cursorDelete = new OperationChainHandler((store, args) => {
      const { value, index, where, query, direction } = args;

      if (
        !isType(value, "Undefined") ||
        !isType(index, "Undefined") ||
        isType(where, "Undefined")
      ) {
        return false;
      }

      if (!isType(where, "Function")) {
        throw new TypeError(`where must be a function`);
      }

      return new Promise((resolve, reject) => {
        const request = store.openCursor(this.#createRange(query), direction);

        const result = [];

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          const cursor = event.target.result;

          if (cursor) {
            const callbackResult = where(cursor.value);

            if (callbackResult === true) {
              const request = cursor.delete();

              console.log(request);

              request.onerror = (event) => {
                reject(event.target.error);
              };

              request.onsuccess = () => {
                result.push(request.source.key);
              };
            }

            cursor.continue();
          } else {
            resolve(result);
          }
        };
      });
    });

    const indexCursorDelete = new OperationChainHandler((store, args) => {
      const { index, value, where, query, direction } = args;

      if (
        !isType(value, "Undefined") ||
        isType(index, "Undefined") ||
        isType(where, "Undefined")
      ) {
        return false;
      }

      if (!isType(where, "Function")) {
        throw new TypeError(`where must be a function`);
      }

      return new Promise((resolve, reject) => {
        const request = store
          .index(index)
          .openCursor(this.#createRange(query), direction);

        const result = [];

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          const cursor = event.target.result;

          if (cursor) {
            const callbackResult = where(cursor.value);

            if (callbackResult === true) {
              const request = cursor.delete();

              request.onerror = (event) => {
                reject(event.target.error);
              };

              request.onsuccess = () => {
                result.push(request.source.key);
              };
            }

            cursor.continue();
          } else {
            resolve(result);
          }
        };
      });
    });

    const clear = new OperationChainHandler((store, args) => {
      const { key, index, where } = args;

      if (
        !isType(key, "Undefined") ||
        !isType(index, "Undefined") ||
        !isType(where, "Undefined")
      ) {
        return false;
      }

      return new Promise((resolve, reject) => {
        const request = store.clear();

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      });
    });

    remove.next(cursorDelete);
    cursorDelete.next(indexCursorDelete);
    indexCursorDelete.next(clear);

    const result = remove.run(store, args);

    return result === false ? undefined : result;
  }

  #handleRequest(request) {
    return new Promise((resolve, reject) => {
      request.onerror = (event) => {
        reject(event.target.error);
      };
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
    });
  }

  #createRange(query = {}) {
    const { start, end, only } = query;

    if (!isType(only, "Undefined")) {
      return IDBKeyRange.only(only);
    }

    if (!isType(start, "Undefined") && !isType(end, "Undefined")) {
      return IDBKeyRange.bound(start, end);
    }

    if (!isType(start, "Undefined")) {
      return IDBKeyRange.lowerBound(start);
    }

    if (!isType(end, "Undefined")) {
      return IDBKeyRange.upperBound(end);
    }
  }
}

class OperationChainHandler {
  constructor(currentRequest) {
    this.currentRequest = currentRequest;
    this.nextRequest = null;
  }

  next(handler) {
    this.nextRequest = handler;
  }

  run(store, data) {
    const result = this.currentRequest(store, data);

    if (result) {
      return result;
    } else if (this.nextRequest) {
      return this.nextRequest.run(store, data);
    } else {
      return false;
    }
  }
}

export default IDBee;
