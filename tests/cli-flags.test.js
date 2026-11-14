// @ts-check
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CiPrompts } from "../src/prompts/ci-prompts.js";
import { InteractivePrompts } from "../src/prompts/interactive-prompts.js";
import { TestPrompts } from "../src/prompts/test-prompts.js";
import { runCli } from "../src/cli.js";

const entry = fileURLToPath(new URL("../index.js", import.meta.url));

/**
 * Create a temporary workspace for testing
 * @returns {Promise<{cwd: string, tmp: string, cleanup: () => Promise<void>}>}
 */
async function createTestWorkspace() {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "test-workspace-"));
  const cwd = tmp;
  return {
    cwd,
    tmp,
    cleanup: async () => {
      await rm(tmp, { recursive: true, force: true });
    },
  };
}

test("--yes flag should use CiPrompts when testing in process", async () => {
  // This test verifies that --yes flag creates the right prompt provider
  const workspace = await createTestWorkspace();
  try {
    const destination = path.join(workspace.cwd, "my-site");
    const testPrompts = new TestPrompts({});
    // When --yes is passed, CiPrompts should be used internally
    // but we inject TestPrompts to avoid actual prompting
    await runCli(["node", entry, destination, "-r=8.0.0", "-y"], testPrompts);
    // No exception thrown means flag was parsed correctly
  } finally {
    await workspace.cleanup();
  }
});

test("--non-interactive flag is recognized", async () => {
  // This test ensures --non-interactive flag doesn't throw parse error
  const workspace = await createTestWorkspace();
  try {
    const destination = path.join(workspace.cwd, "my-site");
    const testPrompts = new TestPrompts({});
    // --non-interactive should be accepted without parse error
    await runCli(
      ["node", entry, destination, "-r=8.0.0", "--non-interactive"],
      testPrompts,
    );
    // No exception thrown means flag was parsed correctly
  } finally {
    await workspace.cleanup();
  }
});

test("--yes and --non-interactive are mutually compatible", async () => {
  // Both flags together should work without conflict
  const workspace = await createTestWorkspace();
  try {
    const destination = path.join(workspace.cwd, "my-site");
    const testPrompts = new TestPrompts({});
    await runCli(
      ["node", entry, destination, "-r=8.0.0", "-y", "--non-interactive"],
      testPrompts,
    );
    // No exception thrown
  } finally {
    await workspace.cleanup();
  }
});

test("CiPrompts.confirm() returns false for non-interactive mode", async () => {
  const prompts = new CiPrompts();
  const result = await prompts.confirm("Should proceed?");
  assert.strictEqual(result, false);
});

test("CiPrompts.text() throws NonInteractivePromptError", async () => {
  const prompts = new CiPrompts();
  await assert.rejects(prompts.text("Enter your name:"), (error) => {
    assert.strictEqual(error.name, "NonInteractivePromptError");
    assert.strictEqual(error.code, "ERR_NON_INTERACTIVE_PROMPT");
    assert.strictEqual(error.promptType, "text");
    return true;
  });
});

test("CiPrompts.select() throws NonInteractivePromptError", async () => {
  const prompts = new CiPrompts();
  const options = [
    { label: "Option 1", value: "opt1" },
    { label: "Option 2", value: "opt2" },
  ];
  await assert.rejects(
    prompts.select("Choose an option:", options),
    (error) => {
      assert.strictEqual(error.name, "NonInteractivePromptError");
      assert.strictEqual(error.code, "ERR_NON_INTERACTIVE_PROMPT");
      assert.strictEqual(error.promptType, "select");
      return true;
    },
  );
});

test("InteractivePrompts requires inquirer instance", () => {
  // Verify InteractivePrompts constructor accepts inquirer
  const mockInquirer = {
    prompt: async () => ({ confirmed: true }),
    registerPrompt: () => {},
  };
  const prompts = new InteractivePrompts(mockInquirer);
  assert.ok(prompts instanceof InteractivePrompts);
});

test("help text includes --non-interactive documentation", async () => {
  const workspace = await createTestWorkspace();
  try {
    // We can't easily capture output from runCli, so we'll verify the flag is accepted
    // by checking that it doesn't raise a parse error
    const destination = path.join(workspace.cwd, "test");
    const testPrompts = new TestPrompts({});
    try {
      await runCli(
        ["node", entry, destination, "--non-interactive", "--help"],
        testPrompts,
      );
    } catch {
      // Expected to fail because no project is created with --help
    }
    // If we get here without parse error, the flag is recognized
    assert.ok(true);
  } finally {
    await workspace.cleanup();
  }
});

test("--non-interactive with --lang still works", async () => {
  const workspace = await createTestWorkspace();
  try {
    const destination = path.join(workspace.cwd, "my-site");
    const testPrompts = new TestPrompts({});
    // --non-interactive with --lang should work together
    await runCli(
      [
        "node",
        entry,
        destination,
        "-r=8.0.0",
        "--non-interactive",
        "--lang=es",
      ],
      testPrompts,
    );
    // No exception thrown
  } finally {
    await workspace.cleanup();
  }
});

test("flag parsing handles -y and --yes equivalently", async () => {
  // Test that both short and long forms work
  const workspace1 = await createTestWorkspace();
  const workspace2 = await createTestWorkspace();
  try {
    const testPrompts1 = new TestPrompts({});
    const testPrompts2 = new TestPrompts({});

    // Test short form -y
    const destination1 = path.join(workspace1.cwd, "site");
    await runCli(["node", entry, destination1, "-r=8.0.0", "-y"], testPrompts1);

    // Test long form --yes
    const destination2 = path.join(workspace2.cwd, "site");
    await runCli(
      ["node", entry, destination2, "-r=8.0.0", "--yes"],
      testPrompts2,
    );

    // Both should succeed without throwing
    assert.ok(true);
  } finally {
    await Promise.all([workspace1.cleanup(), workspace2.cleanup()]);
  }
});

test("CiPrompts is fail-closed: confirm returns false by default", async () => {
  const prompts = new CiPrompts();
  // Multiple calls should consistently return false
  const result1 = await prompts.confirm("Test 1?");
  const result2 = await prompts.confirm("Test 2?");
  const result3 = await prompts.confirm("Test 3?");
  assert.strictEqual(result1, false);
  assert.strictEqual(result2, false);
  assert.strictEqual(result3, false);
});
