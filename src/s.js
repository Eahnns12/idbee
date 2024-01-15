await mydb.transaction(["todos"], async ({ todos }) => {
  await todos.put({
    where: (value) => {
      if (value.userId === 1) {
        value.completed = true;

        return value;
      }
    },
  });
});
