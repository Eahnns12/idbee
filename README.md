# <span style="color: #985b10 ">ID</span><span style="color: #f6e000">Bee</span>

:honeybee: :honeybee: :honeybee: :honeybee: :honeybee:

<!-- ## Installation

To install IDBee, run the following command in your project directory:

```bash
npm install IDBee
``` -->

## Importing IDBee

Import IDBee into your JavaScript file:

```javascript
import IDBee from "idbee";
```

### Initializing IDBee

Create an instance of IDBee, and define your database's name, version, and object stores:

```javascript
// Create an instance of IDBee with debug mode enabled
const mydb = new IDBee({ dev: true });

// Define the database name, version and stores
await mydb
  .name("file")
  .version(1)
  .stores([
    {
      name: "metadata",
      options: { keyPath: "id", autoIncrement: true }, // default & recommended setting
      indexes: [{ name: "uuid", unique: true }, { name: "fileName" }],
    },
    {
      name: "blob",
      options: { keyPath: "id", autoIncrement: false },
    },
  ]);
```

## Transactions

Start a transaction with the defined object stores:

```javascript
// Start transaction
const result = await mydb.transaction(); // Returns store names ["metadata", "blod"]
```

## Adding Data

Use a transaction to add data to the object stores:

```javascript
await mydb.transaction(async ({ metadata, blod }) => {
  const id = await metadata.add({ fileName: file.fileName });

  await blod.add({ id, file: file });
});
```

coming soon...

<!-- ## Retrieving Data

Retrieve data from the object stores:

```javascript
const result = await mydb.transaction(["metadata"], async ({ metadata }) => {
  const getAll = await metadata.get();
  const getAllByIndexName = await metadata.get({ index: "fileName" });
  const getByKeyPath = await metadata.get(3);
  const getByIndexValue = await metadata.get({
    fileName: "Eloquent JavaScript",
  });

  return getAll;
});
``` -->
