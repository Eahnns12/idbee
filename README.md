# IDBee :honeybee:

A lightweight, Promise-Based Wrapper designed to simplify the use of JavaScript's IndexedDB, making client-side database operations more intuitive.

## Quick Start

Create a new database instance, open a connection, and perform transactions:

```javascript
import IDBee from "idbee";

// Create a new database instance
const mydb = new IDBee();

// Open a connection with default settings
// Defaults: db name "idb", store name "app", store keyPath "id"
await mydb.open();

// Perform transactions
const result = await mydb.transaction(async ({ app }) => {
  await app.add({ value: { todo: "hello world" } });
  return await app.get();
});

// Output the result
console.log(result); // Outputs: [{todo: 'hello world', id: 1}]
```

## Installation

To install IDBee, run the following command in your project directory:

```bash
npm install IDBee
```

## Configuration

### Setting the Database Name

Specify the name of your database using the name method.

| Arguments | Type     | Default | Required |
| --------- | -------- | ------- | -------- |
| `name`    | `String` |         |          |

```javascript
mydb.name("mydb");
```

### Specifying the Version

Set the version of your database. IndexedDB uses versions to manage schema changes.

| Arguments | Type     | Default | Required |
| --------- | -------- | ------- | -------- |
| `version` | `Number` | `1`     |          |

```javascript
mydb.version(1);
```

### Defining Object Stores and Indexes

Configure object stores with their respective key paths, auto-increment settings, and any indexes.

| Arguments                        | Type       | Default | Required |
| -------------------------------- | ---------- | ------- | -------- |
| `stores`                         | `Object[]` | `[]`    |          |
| `stores[].name`                  | `String`   |         |          |
| `stores[].options`               | `Object`   |         |          |
| `stores[].options.keyPath`       | `String`   | `id`    |          |
| `stores[].options.autoIncrement` | `Boolean`  | `true`  |          |
| `stores[].indexes`               | `Object[]` |         |          |
| `stores[].indexes[].name`        | `String`   |         |          |
| `stores[].indexes[].unique`      | `Boolean`  | `false` |          |
| `stores[].indexes[].multiEntry`  | `Boolean`  | `false` |          |

```javascript
mydb.stores([
  {
    name: "users",
    // Defaults: options: { keyPath: "id", autoIncrement: true },
    indexes: [{ name: "firstName" }, { name: "age" }],
  },
  {
    name: "todos",
    options: { keyPath: null, autoIncrement: true },
    indexes: [
      { name: "userId" },
      { name: "todo" },
      { name: "tags", multiEntry: true },
    ],
  },
]);
```

## Connecting to IndexedDB

Establish a connection to your IndexedDB and handle various database events with custom callbacks.

| Arguments                   | Type       | Default | Required |
| --------------------------- | ---------- | ------- | -------- |
| `callbacks`                 | `Object`   | `{}`    |          |
| `callbacks.onsuccess`       | `Function` |         |          |
| `callbacks.onerror`         | `Function` |         |          |
| `callbacks.onupgradeneeded` | `Function` |         |          |
| `callbacks.onblocked`       | `Function` |         |          |

```javascript
await mydb.open({
  onsuccess: (event) => {
    console.log("Database connected successfully.");
  },
  onerror: (event) => {
    console.error("An error occurred while connecting to the database.");
  },
  onupgradeneeded: (event) => {
    console.log("Database upgrade is required.");
  },
  onblocked: (event) => {
    console.warn("Database connection is blocked.");
  },
});
```

## Handling Transactions

Transactions allow you to execute a series of database operations as a single unit.

| Arguments  | Type       | Default | Required |
| ---------- | ---------- | ------- | -------- |
| `stores`   | `String[]` |         |          |
| `callback` | `Function` |         | `true`   |

```javascript
const result = await mydb.transaction();
// Outputs: ["users", "todos"]

await mydb.transaction(["users"], async (stores) => {
  const { users } = stores;

  return { success: true };
});
// Outputs: { success: true };
```

## Adding Data

Transactions provide a straightforward way to add data to your object stores.

| Arguments | Type     | Default | Required |
| --------- | -------- | ------- | -------- |
| `options` | `Object` | `{}`    |          |
| `key`     | `Any`    |         |          |
| `value`   | `Object` |         | `true`   |

```javascript
await mydb.transaction(async ({ users, todos }) => {
  const userId = await users.add({
    value: {
      firstName: "Terry",
      lastName: "Medhurst",
      age: 50,
    },
  });
  // Outputs: 1

  const todoList = [
    {
      userId: userId,
      todo: "Go for a run",
      tags: ["health", "fitness"],
    },
    {
      userId: userId,
      todo: "Learn a new language",
      tags: ["education", "self-improvement"],
    },
  ];

  // Add multiple todo items for the user
  for (const todo of todoList) {
    await todos.add({
      value: todo,
    });
  }
});
```

## Retrieving Data

Transactions provide a straightforward way to add data to your object stores.

| #   | Key  | Value                                                                                  |
| --- | ---- | -------------------------------------------------------------------------------------- |
| 0   | `1`  | `{ userId: 1, todo: "Go for a run", tags: ["health", "fitness"] }`                     |
| 1   | `2`  | `{ userId: 1, todo: "Learn a new language", tags: ["education", "self-improvement"] }` |
| 2   | `3`  | `{ userId: 5, todo: "Cook a new recipe", tags: ["cooking", "food"] }`                  |
| 3   | `4`  | `{ userId: 3, todo: "Write a journal entry", tags: ["reflection", "writing"] }`        |
| 4   | `5`  | `{ userId: 5, todo: "Paint a landscape", tags: ["creativity", "art"] }`                |
| 5   | `6`  | `{ userId: 2, todo: "Plan a weekend trip", tags: ["travel", "adventure"] }`            |
| 6   | `7`  | `{ userId: 8, todo: "Visit a museum", tags: ["culture", "learning"] }`                 |
| 7   | `8`  | `{ userId: 5, todo: "Start a blog", tags: ["writing", "technology"] }`                 |
| 8   | `9`  | `{ userId: 9, todo: "Practice meditation", tags: ["mindfulness", "health"] }`          |
| 9   | `10` | `{ userId: 4, todo: "Organize a meetup", tags: ["social", "networking"] }`             |

### Get One

| Arguments       | Type     | Default | Required |
| --------------- | -------- | ------- | -------- |
| `options`       | `Object` | `{}`    |          |
| `options.key`   | `Any`    |         | `true`   |
| `options.index` | `Any`    |         |          |

```javascript
await mydb.transaction(["todos"], async ({ todos }) => {
  await todos.get({ key: 1 });
  // Outputs: { userId: 1, todo: "Go for a run", tags: ["health", "fitness"] }

  await todos.get({ index: "userId", key: 5 });
  // Outputs: { userId: 5, todo: "Cook a new recipe", tags: ["cooking", "food"] }
});
```

### Get All

| Arguments             | Type     | Default | Required |
| --------------------- | -------- | ------- | -------- |
| `options`             | `Object` | `{}`    |          |
| `options.index`       | `Any`    |         |          |
| `options.query`       | `Object` |         |          |
| `options.query.start` | `Any`    |         |          |
| `options.query.end`   | `Any`    |         |          |
| `options.query.only`  | `Any`    |         |          |
| `options.count`       | `Number` |         |          |

```javascript
await mydb.transaction(["todos"], async ({ todos }) => {
  await todos.get();
  // Outputs: [{ 1 ... 10 }]

  await todos.get({ query: { start: 3 } });
  // Outputs: [{ 3 ... 10 }]

  await todos.get({ index: "userId" });
  // Outputs: [{ 1 ... 10 }] sort by userId

  await todos.get({ index: "userId", query: { start: 7, end: 10 } });
  // Outputs: [
  //   { userId: 8, todo: "Visit a museum", tags: ["culture", "learning"] }
  //   { userId: 9, todo: "Practice meditation", tags: ["mindfulness", "health"] }
  // ]

  await todos.get({ index: "tags", query: { only: "health" } });
  // Outputs: [
  //   { userId: 1, todo: "Go for a run", tags: ["health", "fitness"] }
  //   { userId: 9, todo: "Practice meditation", tags: ["mindfulness", "health"] }
  // ]

  await todos.get({ index: "userId", query: { only: 5 }, count: 2 });
  // Outputs: [
  //   { userId: 5, todo: "Cook a new recipe", tags: ["cooking", "food"] }
  //   { userId: 5, todo: "Paint a landscape", tags: ["creativity", "art"] }
  // ]
});
```

### Cursor

| Arguments             | Type       | Default | Required |
| --------------------- | ---------- | ------- | -------- |
| `options`             | `Object`   | `{}`    |          |
| `options.where`       | `Function` |         | `true`   |
| `options.index`       | `Any`      |         |          |
| `options.query`       | `Object`   |         |          |
| `options.query.start` | `Any`      |         |          |
| `options.query.end`   | `Any`      |         |          |
| `options.query.only`  | `Any`      |         |          |
| `options.direction`   | `String`   |         |          |

```javascript
await mydb.transaction(["todos"], async ({ todos }) => {
  await todos.get({
    where: (value) => {
      if (value.userId === 5) {
        return value;
      }
    },
    direction: "prev",
  });
  // Outputs: [
  //   { userId: 5, todo: "Start a blog", tags: ["writing", "technology"] }
  //   { userId: 5, todo: "Paint a landscape", tags: ["creativity", "art"] }
  //   { userId: 5, todo: "Cook a new recipe", tags: ["cooking", "food"] }
  // ]

  await todos.get({
    index: "userId",
    where: (value) => (value.userId === 5 ? value : null),
    direction: "nextunique",
  });
  // Outputs: [
  //   { userId: 5, todo: "Cook a new recipe", tags: ["cooking", "food"] }
  // ]
});
```
