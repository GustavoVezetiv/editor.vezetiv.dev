import assert from "node:assert/strict";
import test from "node:test";
import { AttemptOperationQueue } from "./attemptOperationQueue";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

test("fila preserva a ordem de chamadas mesmo quando a primeira operação é lenta", async () => {
  const queue = new AttemptOperationQueue();
  const order: string[] = [];
  const slow = queue.run("attempt-1", async () => {
    order.push("save-a:start");
    await wait(20);
    order.push("save-a:end");
  });
  const fast = queue.run("attempt-1", async () => {
    order.push("save-b");
  });
  await Promise.all([slow, fast]);
  assert.deepEqual(order, ["save-a:start", "save-a:end", "save-b"]);
});

test("save antigo termina antes do novo e não vence o estado final", async () => {
  const queue = new AttemptOperationQueue();
  let remote = "";
  const oldSave = queue.run("attempt-1", async () => {
    await wait(15);
    remote = "antigo";
  });
  const newSave = queue.run("attempt-1", async () => {
    remote = "novo";
  });
  await Promise.all([oldSave, newSave]);
  assert.equal(remote, "novo");
});

test("verificação termina antes da conclusão na mesma tentativa", async () => {
  const queue = new AttemptOperationQueue();
  const order: string[] = [];
  const verify = queue.run("attempt-1", async () => {
    order.push("verify:start");
    await wait(15);
    order.push("verify:end");
  });
  const complete = queue.run("attempt-1", async () => {
    order.push("complete");
  });
  await Promise.all([verify, complete]);
  assert.deepEqual(order, ["verify:start", "verify:end", "complete"]);
});
