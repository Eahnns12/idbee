import { isExpectedType } from "./utils.js";

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

    if (!isExpectedType(name, "String")) {
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

    if (!isExpectedType(version, "Number")) {
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

    if (!isExpectedType(stores, "Array")) {
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

    if (!isExpectedType(callbacks, "Object")) {
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

      if (!isExpectedType(func, "Function")) {
        throw new TypeError(`callback must be a function`);
      }
    });

    return new Promise((resolve, reject) => {
      if (isExpectedType(this.dbName, "Undefined")) {
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

        if (
          !isExpectedType(this.#dbStores, "Array") ||
          !this.#dbStores?.length
        ) {
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

          if (!isExpectedType(options, "Object")) {
            throw new Error(
              `Store "${name}" has invalid options. Expected options to be an object.`
            );
          }

          if (!isExpectedType(indexes, "Array")) {
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
          indexes.forEach(({ name, keyPath = name, unique = false }) => {
            objectStore.createIndex(name, keyPath, { unique });
            this.#log(`index: "${name}" created with unique: ${unique}`);
          });
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

      if (callback && !isExpectedType(callback, "AsyncFunction")) {
        throw new TypeError(
          "Transaction callback must be an asynchronous function."
        );
      }

      const storeNames =
        selectedStoreNames ?? Array.from(this.db.objectStoreNames);

      const transaction = this.db.transaction(storeNames, "readwrite");

      const objectStores = new IDBeeCRUDBuilder(
        transaction,
        storeNames
      ).build();

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

/**
 * Builder class for CRUD operations.
 * @private
 */
class IDBeeCRUDBuilder {
  /**
   * @param {IDBTransaction} transaction - The transaction object.
   * @param {string[]} storeNames - Object store names.
   */
  constructor(transaction, storeNames) {
    this.transaction = transaction;
    this.storeNames = storeNames;
    this.objectStores = {};
  }

  build() {
    for (const name of this.storeNames) {
      const store = this.transaction.objectStore(name);
      this.objectStores[name] = this.buildObjectStore(store);
    }

    return this.objectStores;
  }

  buildObjectStore(store) {
    return {
      add: (data) => new Operations().add(store, data),
      get: (data) => new Operations().get(store, data),
      put: (data) => new Operations().put(store, data),
      delete: (data) => new Operations().delete(store, data),
    };
  }
}

/**
 * Class that performs CRUD operations.
 * @private
 */
class Operations {
  constructor() {}

  add(store, data) {
    return this.#handleRequest(store.add(data));
  }

  get(store, data) {
    const availableIndexes = Array.from(store.indexNames);

    if (isExpectedType(data, "Undefined")) {
      return this.#handleRequest(store.getAll());
    } else if (
      isExpectedType(data, "Number") ||
      isExpectedType(data, "String")
    ) {
      return this.#handleRequest(store.get(data));
    } else if (isExpectedType(data, "Object")) {
      if (!availableIndexes.length) {
        throw new Error("No indexes available");
      }

      if (Object.keys(data).length !== 1) {
        throw new Error("Object must have only one property");
      }

      const queryKey = Object.keys(data)[0];
      const queryValue = data[queryKey];

      if (!["index", ...availableIndexes].some((key) => key === queryKey)) {
        throw new Error(
          "Object key must be 'index' or the index name that initialized"
        );
      }

      if (queryKey === "index") {
        return this.#handleRequest(store.index(queryValue).getAll());
      }

      if (availableIndexes.some((key) => key === queryKey)) {
        return this.#handleRequest(store.index(queryKey).get(queryValue));
      }
    }
  }

  put(store, data) {
    return this.#handleRequest(store.put(data));
  }

  delete(store, data) {
    if (isExpectedType(data, "Undefined")) {
      return this.#handleRequest(store.clear());
    }

    return this.#handleRequest(store.delete(data));
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
}

export default IDBee;
