import { isType } from "./utils.js";

class IDBee {
  #dbName;
  #dbVersion;
  #dbStores;
  #isOpened;
  #isNameSet;
  #isVersionSet;
  #isStoresSet;

  constructor() {
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
   * @returns {IDBee} The IDBee instance for chaining.
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

    this.#dbName = name;
    this.#isNameSet = true;

    return this;
  }

  /**
   * Sets the database version.
   * @param {number} version - The version of the database.
   * @returns {IDBee} The IDBee instance for chaining.
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

    this.#dbVersion = version;
    this.#isVersionSet = true;

    return this;
  }

  /**
   * Sets the object stores for the database.
   * @param {object[]} stores - An array of object store specifications.
   * @param {string} stores[].name
   * @param {object} stores[].options
   * @param {string} stores[].options.keyPath
   * @param {boolean} stores[].options.autoIncrement
   * @param {object[]} stores[].indexes
   * @param {string} stores[].indexes[].name
   * @param {boolean} stores[].indexes[].unique
   * @param {boolean} stores[].indexes[].multiEntry
   * @returns {IDBee} The IDBee instance for chaining.
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

    this.#dbStores = stores;
    this.#isStoresSet = true;

    return this;
  }

  /**
   * Opens the database connection.
   * @param {object} [callbacks={}] - An object containing callback functions for the open operation.
   * @param {function} [callbacks.onsuccess] - Called when opening the database is successful.
   * @param {function} [callbacks.onerror] - Called when opening the database fails.
   * @param {function} [callbacks.onupgradeneeded] - Called when the database is being upgraded.
   * @param {function} [callbacks.onblocked] - Called when the open request is blocked.s
   * @returns {Promise<IDBee>} A promise that resolves to the IDBee instance once the database is opened.
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
      if (isType(this.#dbName, "Undefined")) {
        this.#dbName = "idb";
      }

      const request = this.idb.open(this.#dbName, this.#dbVersion);

      request.onsuccess = (event) => {
        callbacks.onsuccess?.(event);
        this.db = event.target.result;
        this.#isOpened = true;
        resolve(this);
      };

      request.onerror = (event) => {
        callbacks.onerror?.(event);
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const existingStores = Array.from(db.objectStoreNames);
        const idealStores = this.#dbStores.map(({ name }) => name);

        // Delete unnecessary store
        existingStores
          .filter((storeName) => !idealStores.includes(storeName))
          .forEach((storeName) => {
            db.deleteObjectStore(storeName);
          });

        if (!isType(this.#dbStores, "Array") || !this.#dbStores?.length) {
          this.#dbStores.push({ name: "app" });
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
          });

          // Create index for object store
          indexes.forEach(
            ({ name, keyPath = name, unique = false, multiEntry = false }) => {
              objectStore.createIndex(name, keyPath, { unique, multiEntry });
            }
          );
        });

        callbacks.onupgradeneeded?.(event);
      };

      request.onblocked = (event) => {
        callbacks.onblocked?.(event);
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

    this.#isOpened = false;
    this.db.close();
  }

  /**
   * Performs database operations within a transaction.
   * @param {Array<string>|Function} args - The store names or the transaction callback.
   * @returns {Promise<any>} A promise that resolves with the result of the transaction.
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
            /**
             * Adds a record to the given object store.
             * @param {object} options - The options for the add operation.
             * @param {any} options.key
             * @param {any} options.value
             */
            add: (options) => new Operations().add(store, options),
            /**
             * Gets records from the given object store.
             * @param {object} options - The options for the add operation.
             * @param {any} options.key
             * @param {any} options.index
             * @param {function} options.where
             * @param {object} options.query
             * @param {number} options.count
             * @param {string} options.direction
             */
            get: (options) => new Operations().get(store, options),
            /**
             * Puts a record in the given object store, updating it if it already exists.
             * @param {object} options - The options for the add operation.
             * @param {any} options.key
             * @param {any} options.index
             * @param {any} options.value
             * @param {function} options.where
             * @param {object} options.query
             * @param {string} options.direction
             */
            put: (options) => new Operations().put(store, options),
            /**
             * Deletes a record from the given object store.
             * @param {IDBObjectStore} store - The object store to delete the record from.
             * @param {object} options - The options for the add operation.
             * @param {any} options.key
             * @param {any} options.index
             * @param {function} options.where
             * @param {object} options.query
             * @param {string} options.direction
             */
            delete: (options) => new Operations().delete(store, options),
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
   * @returns {Promise<Event>} A promise that resolves to the event once the database is deleted.
   */
  delete() {
    if (!this.db) {
      throw new Error("Database is not open.");
    }

    return new Promise((resolve, reject) => {
      const request = this.idb.deleteDatabase(this.#dbName);

      request.onsuccess = (event) => {
        return resolve(event);
      };

      request.onerror = (event) => {
        return reject(event);
      };
    });
  }

  get info() {
    const info = {
      name: this.#dbName,
      version: this.#dbVersion,
      stores: this.#dbStores,
    };

    return info;
  }
}

/**
 * Operations class provides methods for IDBObjectStore operations like add, get, put, and delete.
 */
class Operations {
  /**
   * Adds a record to the given object store.
   * @param {IDBObjectStore} store - The object store to add the record to.
   * @param {object} options - The options for the add operation.
   * @returns {Promise<IDBValidKey>} A promise that resolves to the key of the added record.
   */
  add(store, options = {}) {
    const { key, value } = options;

    return new Promise((resolve, reject) => {
      const request = store.add(value, key);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
    });
  }

  /**
   * Gets records from the given object store.
   * @param {IDBObjectStore} store - The object store to query.
   * @param {object} options - The options for the get operation.
   * @returns {Promise<any>} A promise that resolves to the requested records.
   */
  get(store, options = {}) {
    const { key, index, where, query, count, direction } = options;

    return new Promise((resolve, reject) => {
      const action = index ? store.index(index) : store;

      const request = ((key, where, query, count, direction) => {
        if (!key && !where) {
          return action.getAll(this.#createRange(query), count);
        }

        if (key) {
          return action.get(key);
        }

        if (where) {
          if (!isType(where, "Function")) {
            throw new TypeError(`where must be a function`);
          }

          return action.openCursor(this.#createRange(query), direction);
        }
      })(key, where, query, count, direction);

      const cursorContainer = where ? [] : null;

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        if (!where) {
          return resolve(event.target.result);
        }

        const cursor = event.target.result;

        if (cursor) {
          const callbackResult = where(cursor.value);

          if (callbackResult) {
            cursorContainer.push(callbackResult);
          }

          cursor.continue();
        } else {
          return resolve(cursorContainer);
        }
      };
    });
  }

  /**
   * Puts a record in the given object store, updating it if it already exists.
   * @param {IDBObjectStore} store - The object store to put the record in.
   * @param {object} options - The options for the put operation.
   * @returns {Promise<IDBValidKey>} A promise that resolves to the key of the put record.
   */
  put(store, options = {}) {
    const { key, index, value, where, query, direction } = options;

    return new Promise((resolve, reject) => {
      const action = index ? store.index(index) : store;

      const request = ((key, value, where, query, direction) => {
        if (value && !where) {
          return action.put(value, key);
        }

        if (where) {
          if (!isType(where, "Function")) {
            throw new TypeError(`where must be a function`);
          }

          return action.openCursor(this.#createRange(query), direction);
        }
      })(key, value, where, query, direction);

      const cursorContainer = where ? [] : null;

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        if (!where) {
          return resolve(event.target.result);
        }

        const cursor = event.target.result;

        if (cursor) {
          const callbackResult = where(cursor.value);

          if (callbackResult) {
            const request = cursor.update(callbackResult);

            request.onerror = (event) => {
              reject(event.target.error);
            };

            request.onsuccess = () => {
              cursorContainer.push(request.result);
            };
          }

          cursor.continue();
        } else {
          return resolve(cursorContainer);
        }
      };
    });
  }

  /**
   * Deletes a record from the given object store.
   * @param {IDBObjectStore} store - The object store to delete the record from.
   * @param {object} options - The options for the delete operation.
   * @returns {Promise<void>} A promise that resolves when the record is deleted.
   */
  delete(store, options = {}) {
    const { key, index, where, query, direction } = options;

    return new Promise((resolve, reject) => {
      const action = index ? store.index(index) : store;

      const request = ((key, where, query, direction) => {
        if (key) {
          return action.delete(key);
        }

        if (where) {
          if (!isType(where, "Function")) {
            throw new TypeError(`where must be a function`);
          }

          return action.openCursor(this.#createRange(query), direction);
        }

        return action.clear();
      })(key, where, query, direction);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        if (!where) {
          return resolve(event.target.result);
        }

        const cursor = event.target.result;

        if (cursor) {
          const callbackResult = where(cursor.value);

          if (callbackResult === true) {
            const request = cursor.delete();

            request.onerror = (event) => {
              reject(event.target.error);
            };

            request.onsuccess = () => {};
          }

          cursor.continue();
        } else {
          return resolve();
        }
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

export default IDBee;
